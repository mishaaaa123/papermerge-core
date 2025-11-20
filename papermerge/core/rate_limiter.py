from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

try:
    from papermerge.core.config import settings as _settings
except Exception:  # pragma: no cover - triggered only outside runtime
    _settings = None  # type: ignore[assignment]


def _auth_or_ip_identifier(request):
    """
    Identify the caller for rate limiting purposes.

    Prefers the Authorization header (per-user/token) and falls back to IP.
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)

    authorization = request.headers.get("authorization")
    if authorization:
        # Normalize header because limits compares keys as plain strings.
        return authorization.strip()

    return get_remote_address(request)


def _build_download_limit_string() -> str:
    """Return SlowAPI/limits-compatible string, e.g. '1 per 60 seconds'."""
    max_per_user = (
        getattr(_settings, "papermerge__downloads__max_per_user", 1)
        if _settings
        else 1
    )
    window_seconds = (
        getattr(_settings, "papermerge__downloads__time_window_seconds", 60)
        if _settings
        else 60
    )
    return f"{max_per_user} per {window_seconds} seconds"


storage_uri = getattr(_settings, "papermerge__redis__url", None) if _settings else None
limiter_enabled = bool(storage_uri)

limiter = Limiter(
    key_func=_auth_or_ip_identifier,
    default_limits=[],
    storage_uri=storage_uri or "memory://",
    enabled=limiter_enabled,
)

DOWNLOAD_RATE_LIMIT = _build_download_limit_string()

