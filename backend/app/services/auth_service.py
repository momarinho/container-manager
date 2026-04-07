from __future__ import annotations

from dataclasses import dataclass

import bcrypt

from app.config import config
from app.security import expiration_to_milliseconds, sign_jwt, verify_jwt


@dataclass(frozen=True)
class StoredUser:
    id: str
    username: str
    password_hash: bytes


class AuthService:
    def __init__(self) -> None:
        self._users = {
            "alice": StoredUser(
                id="u1",
                username="alice",
                password_hash=bcrypt.hashpw(
                    b"password123",
                    bcrypt.gensalt(rounds=10),
                ),
            )
        }

    def validate_credentials(
        self,
        username: str | None = None,
        password: str | None = None,
        api_token: str | None = None,
    ) -> bool:
        if api_token:
            return api_token in config.api_tokens

        if username and password:
            user = self._users.get(username)
            if not user:
                return False
            return bcrypt.checkpw(password.encode("utf-8"), user.password_hash)

        return False

    def generate_token(self, user_id: str, username: str) -> str:
        return sign_jwt({"userId": user_id, "username": username})

    def build_login_response(self, username: str | None = None) -> dict[str, object]:
        user_id = username or "api-user"
        resolved_username = username or "api-user"
        token = self.generate_token(user_id, resolved_username)
        return {
            "token": token,
            "expiresAt": int(expiration_to_milliseconds(config.jwt_expires_in)),
            "user": {
                "id": user_id,
                "username": resolved_username,
            },
        }

    def verify_token(self, token: str) -> dict[str, str] | None:
        try:
            payload = verify_jwt(token)
            return {
                "userId": str(payload["userId"]),
                "username": str(payload["username"]),
            }
        except (KeyError, ValueError):
            return None


auth_service = AuthService()
