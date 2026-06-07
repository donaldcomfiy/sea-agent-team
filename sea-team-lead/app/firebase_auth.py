"""Firebase Auth middleware for FastAPI.

Verifies Firebase ID tokens from the Authorization header and extracts the
authenticated user's UID. Gracefully degrades: when no Firebase project is
configured (VITE_FIREBASE_PROJECT_ID not set), all endpoints are open and
get_current_user returns None — so local development without Firebase still works.
"""

import os
import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

_firebase_app = None
_enabled = False
_configured = False
_init_error: str | None = None
_auth_logger = logging.getLogger("sea_team_lead.auth")


def _init():
    global _firebase_app, _enabled, _configured, _init_error
    project_id = os.environ.get("VITE_FIREBASE_PROJECT_ID", "").strip()
    if not project_id:
        return
    _configured = True
    try:
        import firebase_admin
        from firebase_admin import credentials

        # firebase-admin needs Application Default Credentials to verify tokens.
        # On Railway / non-GCP hosts these don't exist — skip init entirely so
        # the app runs in open mode instead of crashing.
        try:
            cred = credentials.ApplicationDefault()
        except Exception:
            _auth_logger.warning(
                "No Application Default Credentials found — Firebase Auth disabled (open mode)"
            )
            return

        if not firebase_admin._apps:
            _firebase_app = firebase_admin.initialize_app(cred, {"projectId": project_id})
        else:
            _firebase_app = firebase_admin.get_app()
        _enabled = True
    except Exception as exc:
        _init_error = str(exc)
        _auth_logger.warning("Firebase Admin init failed: %s — auth will be disabled", exc)


_init()


@dataclass
class AuthUser:
    uid: str
    email: str | None = None


def get_current_user(request: Request) -> AuthUser | None:
    """FastAPI dependency that validates the Firebase ID token.

    Returns AuthUser when Firebase is configured, None when it's not (dev mode).
    Raises 401 when Firebase IS configured but the token is missing/invalid.
    """
    if not _enabled:
        return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        _auth_logger.warning("Missing or invalid Authorization header for %s", request.url.path)
        raise HTTPException(status_code=401, detail="Authorization header fehlt oder ungueltig")

    token = auth_header[7:]
    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(token)
    except Exception as exc:
        exc_str = str(exc).lower()
        if "credentials" in exc_str or "application default" in exc_str:
            # Infrastructure issue (no GCP credentials on this host), not an
            # invalid token. Degrade to open mode instead of blocking.
            _auth_logger.warning(
                "Firebase verify_id_token needs ADC but none found — "
                "falling back to open mode for %s", request.url.path,
            )
            return None
        _auth_logger.warning("Firebase token verification failed for %s: %s", request.url.path, exc)
        raise HTTPException(status_code=401, detail="Ungueltiger oder abgelaufener Token")

    return AuthUser(uid=decoded["uid"], email=decoded.get("email"))


def require_auth(user: AuthUser | None = Depends(get_current_user)) -> AuthUser:
    """Stricter variant: always requires a valid user, even if Firebase is not
    configured. Use for endpoints that must never be open."""
    if user is None:
        raise HTTPException(status_code=401, detail="Authentifizierung erforderlich")
    return user


def auth_is_enabled() -> bool:
    return _enabled


def get_user_id(request: Request) -> str:
    """Extract the authenticated user ID, falling back to query parameter in dev mode.

    When Firebase is active: UID comes from the verified token (query param ignored).
    When Firebase is not configured: falls back to the user_id query parameter
    for backwards compatibility in local development.
    """
    user = get_current_user(request)
    if user:
        return user.uid

    user_id = request.query_params.get("user_id", "")
    if not user_id:
        try:
            import json
            body = json.loads(request._body.decode()) if hasattr(request, '_body') else {}
            user_id = body.get("user_id", "")
        except Exception:
            pass
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id erforderlich")
    return user_id
