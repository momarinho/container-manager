from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    family_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    def to_dict(self) -> dict[str, str | int | bool]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token_hash": self.token_hash,
            "family_id": self.family_id,
            "is_revoked": self.is_revoked,
            "expires_at": self.expires_at,
            "created_at": self.created_at,
        }
