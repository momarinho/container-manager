from __future__ import annotations

import time
import uuid

import bcrypt

from app.config import config
from app.database import db_manager
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User
from app.models import AuthResponse, AuthUser
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import SyncUserRepository
from app.security import (
    expiration_to_milliseconds,
    generate_refresh_token,
    hash_token,
    parse_expiration_seconds,
    sign_jwt,
    verify_jwt,
)


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

    def build_login_response(
        self, username: str | None = None, family_id: str | None = None
    ) -> AuthResponse:
        user_id = username or "api-user"
        resolved_username = username or "api-user"

        if username:
            user = self.get_user_by_username(username)
            if user:
                user_id = user["id"]

        token = self.generate_token(user_id, resolved_username)
        raw_refresh_token = generate_refresh_token()
        token_hash = hash_token(raw_refresh_token)

        active_family_id = family_id or str(uuid.uuid4())
        refresh_expires_seconds = parse_expiration_seconds(config.jwt_refresh_expires_in)
        now_ts = int(time.time())
        expires_at_ts = now_ts + refresh_expires_seconds
        created_at_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Persistir refresh token hasheado no banco de dados
        try:
            with db_manager.get_sync_session() as session:
                token_repo = TokenRepository(session)
                new_refresh_record = RefreshToken(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    token_hash=token_hash,
                    family_id=active_family_id,
                    is_revoked=False,
                    expires_at=expires_at_ts,
                    created_at=created_at_iso,
                )
                token_repo.save_refresh_token(new_refresh_record)
        except Exception:
            # Fallback caso migration ainda não tenha rodado
            pass

        return AuthResponse(
            token=token,
            refreshToken=raw_refresh_token,
            expiresAt=int(expiration_to_milliseconds(config.jwt_expires_in)),
            user=AuthUser(
                id=user_id,
                username=resolved_username,
            ),
        )

    def rotate_refresh_token(self, raw_refresh_token: str) -> AuthResponse:
        """Executa rotação segura de refresh token com detecção de reuso."""
        token_hash = hash_token(raw_refresh_token)
        now_ts = int(time.time())

        with db_manager.get_sync_session() as session:
            token_repo = TokenRepository(session)
            user_repo = SyncUserRepository(session)

            record = token_repo.get_refresh_token_by_hash(token_hash)
            if record is None or record.expires_at < now_ts:
                raise ValueError("Invalid or expired refresh token")

            # Detecção de reuso (Theft Detection):
            # Se um token já revogado for apresentado, invalida toda a família!
            if record.is_revoked:
                token_repo.revoke_family(record.family_id)
                raise PermissionError("Refresh token reuse detected. Token family revoked.")

            # Revoga o token atual utilizado nesta rotação
            token_repo.revoke_refresh_token(record)

            # Busca o usuário para emitir o novo par de tokens
            user = user_repo.get_by_id(record.user_id)
            username = user.username if user else "api-user"
            family_id = record.family_id

        # Emite novo par reutilizando o mesmo family_id
        return self.build_login_response(username=username, family_id=family_id)

    def revoke_session(
        self,
        access_token: str | None = None,
        raw_refresh_token: str | None = None,
    ) -> None:
        """Revoga o access token (adicionando na blocklist) e a família do refresh token."""
        with db_manager.get_sync_session() as session:
            token_repo = TokenRepository(session)

            if access_token:
                try:
                    # Decodifica sem checar blocklist para extrair jti e exp
                    payload = verify_jwt(access_token, check_revocation=False)
                    jti = payload.get("jti")
                    exp = payload.get("exp")
                    if jti and exp:
                        token_repo.add_to_blocklist(jti, expires_at=int(exp))
                except Exception:
                    pass

            if raw_refresh_token:
                token_hash = hash_token(raw_refresh_token)
                record = token_repo.get_refresh_token_by_hash(token_hash)
                if record:
                    token_repo.revoke_family(record.family_id)

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
