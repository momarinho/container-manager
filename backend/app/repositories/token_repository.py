from __future__ import annotations

import time
import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models.refresh_token import RefreshToken
from app.db.models.token_blocklist import TokenBlocklist


class TokenRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def save_refresh_token(self, token: RefreshToken) -> None:
        self.session.add(token)
        self.session.commit()

    def get_refresh_token_by_hash(self, token_hash: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        return self.session.execute(stmt).scalar_one_or_none()

    def revoke_refresh_token(self, token: RefreshToken) -> None:
        token.is_revoked = True
        self.session.commit()

    def revoke_family(self, family_id: str) -> None:
        stmt = (
            update(RefreshToken).where(RefreshToken.family_id == family_id).values(is_revoked=True)
        )
        self.session.execute(stmt)
        self.session.commit()

    def add_to_blocklist(self, jti: str, expires_at: int, token_type: str = "access") -> None:
        existing = self.session.execute(
            select(TokenBlocklist).where(TokenBlocklist.jti == jti)
        ).scalar_one_or_none()
        if existing is None:
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            block_entry = TokenBlocklist(
                id=str(uuid.uuid4()),
                jti=jti,
                token_type=token_type,
                revoked_at=now_iso,
                expires_at=expires_at,
            )
            self.session.add(block_entry)
            self.session.commit()

    def is_jti_blocked(self, jti: str) -> bool:
        stmt = select(TokenBlocklist).where(TokenBlocklist.jti == jti)
        entry = self.session.execute(stmt).scalar_one_or_none()
        return entry is not None
