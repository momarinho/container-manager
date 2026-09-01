from __future__ import annotations

import time
import uuid

import bcrypt

from app.config import config
from app.database import db_manager
from app.db.models.user import User
from app.models import AuthResponse, AuthUser
from app.repositories.user_repository import SyncUserRepository
from app.security import expiration_to_milliseconds, sign_jwt, verify_jwt


class AuthService:
    def get_user_by_username(self, username: str) -> dict | None:
        with db_manager.get_sync_session() as session:
            repo = SyncUserRepository(session)
            user = repo.get_by_username(username)
            return user.to_dict() if user else None

    def validate_credentials(
        self,
        username: str | None = None,
        password: str | None = None,
        api_token: str | None = None,
    ) -> bool:
        if api_token:
            return api_token in config.api_tokens

        if username and password:
            user = self.get_user_by_username(username)
            if not user:
                return False
            pwd_hash_str = user["password_hash"]
            return bcrypt.checkpw(password.encode("utf-8"), pwd_hash_str.encode("utf-8"))

        return False

    def generate_token(self, user_id: str, username: str) -> str:
        return sign_jwt({"userId": user_id, "username": username})

    def build_login_response(self, username: str | None = None) -> AuthResponse:
        user_id = username or "api-user"
        resolved_username = username or "api-user"

        if username:
            user = self.get_user_by_username(username)
            if user:
                user_id = user["id"]

        token = self.generate_token(user_id, resolved_username)
        return AuthResponse(
            token=token,
            expiresAt=int(expiration_to_milliseconds(config.jwt_expires_in)),
            user=AuthUser(
                id=user_id,
                username=resolved_username,
            ),
        )

    def verify_token(self, token: str) -> dict[str, str] | None:
        try:
            payload = verify_jwt(token)
            return {
                "userId": str(payload["userId"]),
                "username": str(payload["username"]),
            }
        except (KeyError, ValueError):
            return None

    def list_users(self) -> list[dict]:
        with db_manager.get_sync_session() as session:
            repo = SyncUserRepository(session)
            users = repo.list_all()
            return [u.to_dict() for u in users]

    def create_user(self, username: str, password_plain: str) -> dict:
        if not username or not password_plain:
            raise ValueError("Username and password are required")
        with db_manager.get_sync_session() as session:
            repo = SyncUserRepository(session)
            if repo.get_by_username(username):
                raise ValueError("User already exists")

            user_id = str(uuid.uuid4())
            password_hash = bcrypt.hashpw(
                password_plain.encode("utf-8"), bcrypt.gensalt(rounds=10)
            ).decode("utf-8")
            created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            new_user = User(
                id=user_id,
                username=username,
                password_hash=password_hash,
                created_at=created_at,
            )
            repo.create(new_user)
            return {"id": user_id, "username": username, "created_at": created_at}

    def delete_user(self, username: str) -> bool:
        if username == "alice":
            raise ValueError("Cannot delete default admin user 'alice'")

        with db_manager.get_sync_session() as session:
            repo = SyncUserRepository(session)
            return repo.delete_by_username(username)


auth_service = AuthService()
