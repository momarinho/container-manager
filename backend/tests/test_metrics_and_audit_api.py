from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

# Configura ambiente de testes antes dos imports da aplicação
os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_PATH"] = "test_database.db"

import httpx

from app import main
from app.database import db_manager
from app.security import sign_jwt
from app.services.audit_service import AuditService


class MetricsAndAuditApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        db_manager.init_db()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app),
            base_url="http://testserver",
        )
        self.test_user = {"id": "user-audit-1", "username": "auditor"}
        self.auth_token = sign_jwt(
            {"userId": self.test_user["id"], "username": self.test_user["username"]}
        )
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}

    async def asyncTearDown(self) -> None:
        await self.client.aclose()

    async def test_prometheus_metrics_endpoint(self) -> None:
        """Valida que /metrics retorna formato OpenMetrics/Prometheus com métricas do sistema."""
        # Fornece mock do docker_service para contagem de containers
        mock_docker = MagicMock()
        mock_docker.list_containers.return_value = [
            {"id": "c1", "state": "running"},
            {"id": "c2", "state": "stopped"},
        ]
        original_get_docker = main.get_docker_service
        main.get_docker_service = lambda: mock_docker
        try:
            response = await self.client.get("/metrics")
            self.assertEqual(response.status_code, 200)
            content = response.text
            self.assertIn("containermaster_http_requests_total", content)
            self.assertIn("containermaster_containers_count", content)
            self.assertIn('state="running"', content)
            self.assertIn('state="stopped"', content)
        finally:
            main.get_docker_service = original_get_docker

    async def test_audit_log_recording_and_query(self) -> None:
        """Valida gravação e recuperação de eventos de auditoria."""
        # Registra uma ação de auditoria
        await AuditService.log_action(
            user_id="user-123",
            username="alice",
            action="CONTAINER_START",
            resource_type="container",
            resource_id="container-abc",
            client_ip="192.168.1.50",
            details="Container started manually",
            status="SUCCESS",
        )

        # Consulta via serviço
        logs = await AuditService.list_audit_logs(limit=10, action="CONTAINER_START")
        self.assertTrue(len(logs) >= 1)
        found = next(
            (log_item for log_item in logs if log_item["resourceId"] == "container-abc"), None
        )
        self.assertIsNotNone(found)
        self.assertEqual(found["action"], "CONTAINER_START")
        self.assertEqual(found["username"], "alice")
        self.assertEqual(found["status"], "SUCCESS")

        # Consulta via API /api/audit-logs
        response = await self.client.get(
            "/api/audit-logs",
            headers=self.auth_headers,
            params={"action": "CONTAINER_START"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertTrue(len(data.get("data", [])) >= 1)

    async def test_container_action_generates_audit_log(self) -> None:
        """Valida que parar um container via API gera automaticamente um registro de auditoria."""
        mock_docker = MagicMock()
        mock_docker.stop_container.return_value = None
        original_get_docker = main.get_docker_service
        main.get_docker_service = lambda: mock_docker
        try:
            response = await self.client.post(
                "/api/containers/target-container-99/stop",
                headers=self.auth_headers,
            )
            self.assertEqual(response.status_code, 200)

            # Verifica que a auditoria gravou CONTAINER_STOP
            logs = await AuditService.list_audit_logs(
                limit=5,
                action="CONTAINER_STOP",
            )
            found = next(
                (log_item for log_item in logs if log_item["resourceId"] == "target-container-99"),
                None,
            )
            self.assertIsNotNone(found)
            self.assertEqual(found["username"], "auditor")
            self.assertEqual(found["status"], "SUCCESS")
        finally:
            main.get_docker_service = original_get_docker


if __name__ == "__main__":
    unittest.main()
