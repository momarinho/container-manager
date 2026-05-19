import asyncio
import os
import unittest
from unittest.mock import Mock, patch

import httpx
os.environ.setdefault("JWT_SECRET", "0123456789abcdef0123456789abcdef")

from app import main


class MainApiTests(unittest.TestCase):
    @staticmethod
    async def _run_sync(func, *args, **kwargs):
        return func(*args, **kwargs)

    @classmethod
    def setUpClass(cls) -> None:
        login_response = cls.request(
            "POST",
            "/api/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        body = login_response.json()
        cls.token = body["data"]["token"]

    @staticmethod
    async def _request_async(
        method: str,
        path: str,
        **kwargs: object,
    ) -> httpx.Response:
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.request(method, path, **kwargs)

    @classmethod
    def request(cls, method: str, path: str, **kwargs: object) -> httpx.Response:
        with patch.object(main.asyncio, "to_thread", side_effect=cls._run_sync):
            return asyncio.run(cls._request_async(method, path, **kwargs))

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def test_health_endpoint_returns_standard_success_payload(self) -> None:
        response = self.request("GET", "/health")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["success"], True)
        self.assertEqual(body["data"]["status"], "ok")

    def test_verify_without_token_returns_consistent_error(self) -> None:
        response = self.request("GET", "/api/auth/verify")
        body = response.json()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(body["success"], False)
        self.assertEqual(body["error"]["code"], "AUTH_TOKEN_MISSING")
        self.assertEqual(body["error"]["message"], "Missing token")

    def test_list_containers_filters_status_and_name(self) -> None:
        fake_containers = [
            {"id": "1", "state": "running", "names": ["web"], "image": "nginx"},
            {"id": "2", "state": "exited", "names": ["db"], "image": "postgres"},
            {"id": "3", "state": "running", "names": ["api"], "image": "my-web-api"},
        ]

        docker_service = Mock()
        docker_service.list_containers.return_value = fake_containers

        with patch.object(main, "get_docker_service", return_value=docker_service):
            response = self.request(
                "GET",
                "/api/containers?status=running&name=web",
                headers=self._auth_headers(),
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["meta"]["count"], 2)
        self.assertEqual([item["id"] for item in body["data"]], ["1", "3"])

    def test_openapi_includes_polished_tags(self) -> None:
        response = self.request("GET", "/openapi.json")
        tags = {tag["name"] for tag in response.json().get("tags", [])}
        self.assertIn("Auth", tags)
        self.assertIn("Containers", tags)
        self.assertIn("System", tags)

    def test_rate_limit_uses_standard_error_envelope(self) -> None:
        original_max_requests = main.rate_limiter.max_requests
        main.rate_limiter.max_requests = 0
        try:
            response = self.request("GET", "/health")
        finally:
            main.rate_limiter.max_requests = original_max_requests

        body = response.json()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(body["success"], False)
        self.assertEqual(body["error"]["code"], "RATE_LIMIT_EXCEEDED")
        self.assertIn("retryAfter", body["error"]["details"])


if __name__ == "__main__":
    unittest.main()
