from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.config import config

_UNIT_SECONDS = {
    "s": 1,
    "m": 60,
    "h": 3600,
    "d": 86400,
    "w": 604800,
}


def _parse_expiration_seconds(expiration: str) -> int:
    if not expiration:
        return 3600

    unit = expiration[-1]
    if unit not in _UNIT_SECONDS:
        return 3600

    try:
        value = int(expiration[:-1])
    except ValueError:
        return 3600

    return value * _UNIT_SECONDS[unit]


def expiration_to_milliseconds(expiration: str) -> int:
    return _parse_expiration_seconds(expiration) * 1000


def sign_jwt(payload: dict[str, Any]) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=_parse_expiration_seconds(config.jwt_expires_in)
    )
    token_payload = {
        **payload,
        "exp": expires_at,
    }
    return jwt.encode(token_payload, config.jwt_secret, algorithm="HS256")


def verify_jwt(token: str) -> dict[str, Any]:
    try:
        decoded = jwt.decode(token, config.jwt_secret, algorithms=["HS256"])
        return decoded if isinstance(decoded, dict) else {}
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid token") from exc


def get_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    return authorization[7:].strip() or None


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
