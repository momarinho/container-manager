from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String, nullable=False, index=True)
    action: Mapped[str] = mapped_column(String, nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    resource_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    client_ip: Mapped[str] = mapped_column(String, default="unknown", nullable=False)
    details: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String, default="SUCCESS", nullable=False)
    timestamp: Mapped[str] = mapped_column(String, nullable=False, index=True)

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "username": self.username,
            "action": self.action,
            "resourceType": self.resource_type,
            "resourceId": self.resource_id,
            "clientIp": self.client_ip,
            "details": self.details,
            "status": self.status,
            "timestamp": self.timestamp,
        }
