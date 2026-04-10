import os
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "0123456789abcdef0123456789abcdef")

from fastapi.testclient import TestClient

from app import main


class MainApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(main.app)
        login_response = cls.client.post(
            "/api/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        body = login_response.json()
        cls.token = body["data"]["token"]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def test_health_endpoint_returns_standard_success_payload(self) -> None:
        response = self.client.get("/health")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["success"], True)
        self.assertEqual(body["data"]["status"], "ok")

    def test_verify_without_token_returns_consistent_error(self) -> None:
        response = self.client.get("/api/auth/verify")
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

        with patch.object(
            main.docker_service,
            "list_containers",
            return_value=fake_containers,
        ):
            response = self.client.get(
                "/api/containers?status=running&name=web",
                headers=self._auth_headers(),
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["meta"]["count"], 2)
        self.assertEqual([item["id"] for item in body["data"]], ["1", "3"])

    def test_openapi_includes_polished_tags(self) -> None:
        response = self.client.get("/openapi.json")
        tags = {tag["name"] for tag in response.json().get("tags", [])}
        self.assertIn("Auth", tags)
        self.assertIn("Containers", tags)
        self.assertIn("System", tags)

    def test_rate_limit_uses_standard_error_envelope(self) -> None:
        original_max_requests = main.rate_limiter.max_requests
        main.rate_limiter.max_requests = 0
        try:
            response = self.client.get("/health")
        finally:
            main.rate_limiter.max_requests = original_max_requests

        body = response.json()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(body["success"], False)
        self.assertEqual(body["error"]["code"], "RATE_LIMIT_EXCEEDED")
        self.assertIn("retryAfter", body["error"]["details"])


if __name__ == "__main__":
    unittest.main()
