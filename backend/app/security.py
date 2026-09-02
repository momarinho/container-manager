from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
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


def parse_expiration_seconds(expiration: str) -> int:
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
    return parse_expiration_seconds(expiration) * 1000


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def sign_jwt(
    payload: dict[str, Any],
    expires_in: str | None = None,
    token_type: str = "access",
) -> str:
    expires_seconds = parse_expiration_seconds(expires_in or config.jwt_expires_in)
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_seconds)
    token_payload = {
        "jti": str(uuid.uuid4()),
        "type": token_type,
        **payload,
        "exp": expires_at,
    }
    return jwt.encode(token_payload, config.jwt_secret, algorithm="HS256")


def is_token_revoked(jti: str) -> bool:
    try:
        from app.database import db_manager
        from app.repositories.token_repository import TokenRepository

        with db_manager.get_sync_session() as session:
            repo = TokenRepository(session)
            return repo.is_jti_blocked(jti)
    except Exception:
        return False


def verify_jwt(token: str, check_revocation: bool = True) -> dict[str, Any]:
    try:
        decoded = jwt.decode(token, config.jwt_secret, algorithms=["HS256"])
        if not isinstance(decoded, dict):
            raise ValueError("Invalid token payload")

        if check_revocation and "jti" in decoded and is_token_revoked(decoded["jti"]):
            raise ValueError("Token has been revoked")

        return decoded
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid token") from exc


def get_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    return authorization[7:].strip() or None


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()
