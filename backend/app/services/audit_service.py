from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy import desc, select

from app.database import db_manager
from app.db.models.audit_log import AuditLog
from app.utils.logger import logger


class AuditService:
    @staticmethod
    async def log_action(
        user_id: str,
        username: str,
        action: str,
        resource_type: str,
        resource_id: str,
        client_ip: str = "unknown",
        details: str = "",
        status: str = "SUCCESS",
    ) -> dict[str, Any]:
        """Grava uma entrada de log de auditoria de forma assíncrona."""
        now_iso = datetime.datetime.now(datetime.UTC).isoformat()
        log_id = str(uuid.uuid4())

        async with db_manager.get_async_session() as session:
            try:
                entry = AuditLog(
                    id=log_id,
                    user_id=user_id,
                    username=username,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    client_ip=client_ip,
                    details=details,
                    status=status,
                    timestamp=now_iso,
                )
                session.add(entry)
                await session.commit()
                logger.info(
                    f"Audit event recorded: action={action} user={username} resource={resource_type}:{resource_id} status={status}"
                )
                return entry.to_dict()
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to record audit log: {e}")
                return {
                    "id": log_id,
                    "userId": user_id,
                    "username": username,
                    "action": action,
                    "resourceType": resource_type,
                    "resourceId": resource_id,
                    "clientIp": client_ip,
                    "details": details,
                    "status": status,
                    "timestamp": now_iso,
                }

    @staticmethod
    def log_action_sync(
        user_id: str,
        username: str,
        action: str,
        resource_type: str,
        resource_id: str,
        client_ip: str = "unknown",
        details: str = "",
        status: str = "SUCCESS",
    ) -> dict[str, Any]:
        """Grava uma entrada de log de auditoria usando a sessão síncrona (ex: WebSockets)."""
        now_iso = datetime.datetime.now(datetime.UTC).isoformat()
        log_id = str(uuid.uuid4())

        try:
            with db_manager.get_sync_session() as session:
                entry = AuditLog(
                    id=log_id,
                    user_id=user_id,
                    username=username,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    client_ip=client_ip,
                    details=details,
                    status=status,
                    timestamp=now_iso,
                )
                session.add(entry)
                session.commit()
                logger.info(
                    f"Audit event recorded (sync): action={action} user={username} resource={resource_type}:{resource_id}"
                )
                return entry.to_dict()
        except Exception as e:
            logger.error(f"Failed to record audit log sync: {e}")
            return {
                "id": log_id,
                "userId": user_id,
                "username": username,
                "action": action,
                "resourceType": resource_type,
                "resourceId": resource_id,
                "clientIp": client_ip,
                "details": details,
                "status": status,
                "timestamp": now_iso,
            }

    @staticmethod
    async def list_audit_logs(
        limit: int = 100,
        offset: int = 0,
        user_id: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """Lista os registros de auditoria com paginação e filtros opcionais."""
        async with db_manager.get_async_session() as session:
            stmt = select(AuditLog).order_by(desc(AuditLog.timestamp))

            if user_id:
                stmt = stmt.where(AuditLog.user_id == user_id)
            if action:
                stmt = stmt.where(AuditLog.action == action)
            if resource_type:
                stmt = stmt.where(AuditLog.resource_type == resource_type)

            stmt = stmt.limit(limit).offset(offset)
            result = await session.execute(stmt)
            logs = result.scalars().all()
            return [log.to_dict() for log in logs]


audit_service = AuditService()
