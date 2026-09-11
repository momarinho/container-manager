import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.services.metrics_client import MetricsClient


class MetricsClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_container_metrics_success(self) -> None:
        client = MetricsClient(base_url="http://test-agent:9090")
        mock_data = [{"id": "c1", "name": "pmac-app", "cpu_percent": 1.5, "memory_mb": 120.0}]

        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "count": 1,
            "data": mock_data,
        }

        with patch("httpx.AsyncClient.get", return_value=mock_response):
            metrics = await client.get_container_metrics()
            self.assertEqual(len(metrics), 1)
            self.assertEqual(metrics[0]["name"], "pmac-app")
            self.assertEqual(metrics[0]["cpu_percent"], 1.5)

    async def test_get_container_metrics_handles_connection_error(self) -> None:
        client = MetricsClient(base_url="http://offline-agent:9090")

        with patch(
            "httpx.AsyncClient.get",
            side_effect=httpx.ConnectError("Connection refused"),
        ):
            metrics = await client.get_container_metrics()
            self.assertEqual(metrics, [])
