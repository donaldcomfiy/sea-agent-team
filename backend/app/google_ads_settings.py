# Runtime configuration store for the Google Ads connection, so credentials can
# be entered/tested from the settings page instead of only via .env.
#
# Precedence: a user-scoped saved settings file overrides .env (env stays the
# base/default, so existing .env setups keep working). Secrets are NEVER
# returned to the frontend in plaintext — get_public() exposes them only as
# "<field>_set" booleans.
#
# Storage: data/google_ads_settings/<user>.json (gitignored). For Cloud Run
# prefer env vars / Secret Manager (the local FS is ephemeral and per-instance).

import json
import os
import re
import threading

from app.user_context import get_current_user_id

_BASE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "google_ads_settings",
)
_LEGACY_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "google_ads_settings.json",
)

# Logical config fields and the .env names they seed from.
FIELDS = (
    "developer_token",
    "client_id",
    "client_secret",
    "refresh_token",
    "login_customer_id",
    "customer_id",
)
SECRET_FIELDS = frozenset({"developer_token", "client_secret", "refresh_token"})
_ENV = {
    "developer_token": "GOOGLE_ADS_DEVELOPER_TOKEN",
    "client_id": "GOOGLE_ADS_CLIENT_ID",
    "client_secret": "GOOGLE_ADS_CLIENT_SECRET",
    "refresh_token": "GOOGLE_ADS_REFRESH_TOKEN",
    "login_customer_id": "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "customer_id": "GOOGLE_ADS_CUSTOMER_ID",
}

_lock = threading.Lock()


def _sanitize(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", value)[:128] or "_"


def _resolve_user_id(user_id: str | None = None) -> str | None:
    uid = (user_id or get_current_user_id() or "").strip()
    return uid or None


def _allow_env_fallback(user_id: str | None = None) -> bool:
    uid = _resolve_user_id(user_id)
    return uid in (None, "local-dev")


def _settings_path(user_id: str | None = None) -> str | None:
    uid = _resolve_user_id(user_id)
    if not uid:
        return None
    return os.path.join(_BASE_DIR, _sanitize(uid) + ".json")


def _read_json(path: str | None) -> dict:
    if not path:
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _write_json(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_config(user_id: str | None = None) -> dict:
    """Full effective config (including secrets) for internal client use.
    For real user-scoped requests the user's file is authoritative. The global
    .env fallback remains only for contexts without a bound user and for the
    local-dev account, so one authenticated user's credentials can never become
    another user's default by accident.

    When no user_id is available we intentionally skip any shared on-disk file,
    so unaffiliated/background contexts never bleed one user's credentials into
    another account. The legacy flat file remains only as a manual migration
    source, not an implicit runtime fallback.
    """
    file_cfg = _read_json(_settings_path(user_id))
    use_env = _allow_env_fallback(user_id)
    out = {}
    for field in FIELDS:
        val = file_cfg.get(field) or (os.environ.get(_ENV[field], "") if use_env else "")
        out[field] = (val or "").strip()
    return out


def get_public(user_id: str | None = None) -> dict:
    """Frontend-safe view: secret fields only as a '<field>_set' boolean,
    non-secret IDs as their actual value."""
    cfg = get_config(user_id)
    pub: dict = {}
    for field in FIELDS:
        if field in SECRET_FIELDS:
            pub[f"{field}_set"] = bool(cfg[field])
        else:
            pub[field] = cfg[field]
    return pub


def clear_oauth(user_id: str | None = None) -> dict:
    """Wipe the OAuth grant — clears the refresh_token from the saved settings
    file. Non-secret IDs (client_id, customer_id, login_customer_id) and the
    other secrets (developer_token, client_secret) are kept so the user can
    re-connect with the same setup. Called by /google-ads/disconnect after
    revoking the token at Google's end."""
    path = _settings_path(user_id)
    if not path:
        return get_public(user_id)
    with _lock:
        file_cfg = _read_json(path)
        if "refresh_token" in file_cfg:
            file_cfg.pop("refresh_token", None)
        _write_json(path, file_cfg)
    return get_public(user_id)


def update(updates: dict, user_id: str | None = None) -> dict:
    """Persist provided fields to the settings file. For secret fields an empty
    value means 'keep the existing secret' (so the frontend can leave masked
    fields blank). Non-secret fields are written as given (empty clears them)."""
    path = _settings_path(user_id)
    if not path:
        raise ValueError("Kein user_id fuer user-spezifische Google-Ads-Einstellungen verfuegbar")
    with _lock:
        file_cfg = _read_json(path)
        for field in FIELDS:
            if field not in updates:
                continue
            val = (updates.get(field) or "").strip()
            if field in SECRET_FIELDS and not val:
                continue  # blank secret -> keep what's already stored
            file_cfg[field] = val
        _write_json(path, file_cfg)
    return get_public(user_id)


def legacy_settings_present() -> bool:
    return os.path.isfile(_LEGACY_FILE)
