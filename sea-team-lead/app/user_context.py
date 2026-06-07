"""Request-scoped user context for per-user integrations.

The FastAPI layer sets the active user id for authenticated requests so deeper
modules (Google Ads settings, campaign builder tools during /run_sse, etc.) can
resolve the current account without threading user ids through every function.
"""

from contextvars import ContextVar, Token

_current_user_id: ContextVar[str | None] = ContextVar("sea_team_lead_current_user_id", default=None)


def set_current_user_id(user_id: str | None) -> Token:
    return _current_user_id.set((user_id or "").strip() or None)


def reset_current_user_id(token: Token) -> None:
    _current_user_id.reset(token)


def get_current_user_id() -> str | None:
    return _current_user_id.get()
