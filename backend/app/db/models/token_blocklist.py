from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    jti: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    token_type: Mapped[str] = mapped_column(String, default="access", nullable=False)
    revoked_at: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    def to_dict(self) -> dict[str, str | int]:
        return {
            "id": self.id,
            "jti": self.jti,
            "token_type": self.token_type,
            "revoked_at": self.revoked_at,
            "expires_at": self.expires_at,
        }
