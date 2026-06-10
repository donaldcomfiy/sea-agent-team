# Server-side OAuth "Connect with Google" flow for the Google Ads connection,
# so the user only enters client_id + client_secret and clicks "Connect" — the
# refresh token is fetched and stored automatically (same UX as n8n), instead of
# pasting one in by hand.
#
# Flow: build_auth_url() -> user authorizes at Google -> Google redirects to the
# callback with ?code -> exchange_code() swaps it for a refresh token (needs
# access_type=offline + prompt=consent) and persists it via the settings store.

import time
import urllib.parse
from secrets import token_urlsafe

import requests

from app.google_ads_settings import get_config, update

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/drive.file"

# Pending CSRF states -> {redirect_uri, user_id, ts}. In-memory is fine for a
# single-node dev/hackathon deploy; entries expire after 10 minutes.
_pending: dict[str, dict] = {}
_STATE_TTL = 600


def _gc() -> None:
    now = time.time()
    for state in [s for s, v in _pending.items() if now - v["ts"] > _STATE_TTL]:
        _pending.pop(state, None)


def build_auth_url(redirect_uri: str, user_id: str) -> str:
    """Build the Google OAuth consent URL for the stored client_id. Stores the
    state + redirect_uri so the callback can verify and reuse them exactly."""
    _gc()
    client_id = get_config(user_id).get("client_id", "")
    if not client_id:
        raise ValueError("Client-ID fehlt - bitte zuerst Client-ID und Secret speichern.")
    state = token_urlsafe(24)
    _pending[state] = {"redirect_uri": redirect_uri, "user_id": user_id, "ts": time.time()}
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",   # required to receive a refresh token
        "prompt": "consent",        # force a refresh token even on re-consent
        "include_granted_scopes": "true",
        "state": state,
    }
    return AUTH_ENDPOINT + "?" + urllib.parse.urlencode(params)


def exchange_code(code: str, state: str) -> None:
    """Exchange the authorization code for tokens and persist the refresh token.
    Uses the redirect_uri stored under the state so it matches the auth request
    byte-for-byte (Google requires an exact match)."""
    pending = _pending.pop(state, None)
    if not pending:
        raise ValueError("Ungueltiger oder abgelaufener Anmeldevorgang. Bitte erneut verbinden.")
    user_id = str(pending.get("user_id") or "").strip()
    if not user_id:
        raise ValueError("Dem OAuth-Flow fehlt die Nutzerzuordnung. Bitte erneut verbinden.")
    cfg = get_config(user_id)
    if not cfg.get("client_id") or not cfg.get("client_secret"):
        raise ValueError("Client-ID/Secret fehlen.")
    resp = requests.post(
        TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "redirect_uri": pending["redirect_uri"],
            "grant_type": "authorization_code",
        },
        timeout=(10, 20),
    )
    if resp.status_code != 200:
        # Surface Google's error description but never echo secrets.
        detail = ""
        try:
            body = resp.json()
            detail = body.get("error_description") or body.get("error") or ""
        except Exception:
            detail = resp.text[:200]
        raise ValueError(f"Token-Austausch fehlgeschlagen ({resp.status_code}): {detail}")
    refresh_token = resp.json().get("refresh_token")
    if not refresh_token:
        raise ValueError(
            "Kein refresh_token erhalten. Tipp: das Konto vorher unter "
            "myaccount.google.com/permissions vom Zugriff trennen und erneut verbinden "
            "(Google gibt den Refresh-Token nur bei erneuter Zustimmung heraus)."
        )
    update({"refresh_token": refresh_token}, user_id)
