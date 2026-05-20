import asyncio
import os
import unittest
from unittest.mock import AsyncMock, Mock, patch

from docker.errors import APIError
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

    def test_validate_image_returns_service_payload(self) -> None:
        docker_service = Mock()
        docker_service.validate_image.return_value = {
            "image": "busybox:1.36",
            "available": True,
            "source": "registry",
            "requiresPull": True,
        }

        with patch.object(main, "get_docker_service", return_value=docker_service):
            response = self.request(
                "POST",
                "/api/containers/validate-image",
                headers=self._auth_headers(),
                json={"image": "busybox:1.36"},
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["data"]["image"], "busybox:1.36")
        self.assertEqual(body["data"]["source"], "registry")

    def test_create_container_returns_created_payload(self) -> None:
        docker_service = Mock()
        docker_service.create_container.return_value = {
            "container": {"id": "abc123", "names": ["smoke"], "state": "running"},
            "started": True,
            "imagePulled": False,
            "imageSource": "local",
            "pullSteps": [],
        }

        with patch.object(main, "get_docker_service", return_value=docker_service):
            response = self.request(
                "POST",
                "/api/containers",
                headers=self._auth_headers(),
                json={
                    "name": "smoke",
                    "image": "busybox:1.36",
                    "command": ["sh", "-c", "sleep 60"],
                    "autoStart": True,
                    "pullImage": True,
                },
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["data"]["container"]["id"], "abc123")
        docker_service.create_container.assert_called_once()

    def test_create_container_surfaces_docker_api_explanation(self) -> None:
        docker_service = Mock()
        docker_service.create_container.side_effect = APIError(
            "create failed",
            explanation="registry unavailable",
        )

        with patch.object(main, "get_docker_service", return_value=docker_service):
            response = self.request(
                "POST",
                "/api/containers",
                headers=self._auth_headers(),
                json={"image": "busybox:1.36"},
            )

        body = response.json()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(body["error"]["code"], "CONTAINER_CREATE_FAILED")
        self.assertEqual(body["error"]["details"]["message"], "registry unavailable")

    def test_container_actions_delegate_to_matching_docker_methods(self) -> None:
        cases = {
            "start": "start_container",
            "stop": "stop_container",
            "restart": "restart_container",
            "pause": "pause_container",
            "unpause": "unpause_container",
        }

        for action, method_name in cases.items():
            docker_service = Mock()
            with self.subTest(action=action):
                with patch.object(
                    main, "get_docker_service", return_value=docker_service
                ):
                    response = self.request(
                        "POST",
                        f"/api/containers/c1/{action}",
                        headers=self._auth_headers(),
                    )

                self.assertEqual(response.status_code, 200)
                getattr(docker_service, method_name).assert_called_once_with("c1")

    def test_container_stats_returns_current_metrics_for_running_container(self) -> None:
        docker_service = Mock()
        docker_service.inspect_container_state.return_value = {"Status": "running"}
        docker_service.get_container_stats.return_value = {
            "id": "c1",
            "cpuPercent": 12.5,
            "memoryUsage": 2048,
        }

        with patch.object(main, "get_docker_service", return_value=docker_service):
            response = self.request(
                "GET",
                "/api/containers/c1/stats",
                headers=self._auth_headers(),
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["data"]["id"], "c1")
        self.assertEqual(body["data"]["cpuPercent"], 12.5)

    def test_container_stats_rejects_non_running_container(self) -> None:
        docker_service = Mock()
        docker_service.inspect_container_state.return_value = {"Status": "exited"}

        with patch.object(main, "get_docker_service", return_value=docker_service):
            response = self.request(
                "GET",
                "/api/containers/c1/stats",
                headers=self._auth_headers(),
            )

        body = response.json()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(body["error"]["code"], "CONTAINER_STATS_UNAVAILABLE")
        self.assertEqual(body["error"]["details"]["state"], "exited")

    def test_exec_in_container_requires_non_empty_command(self) -> None:
        response = self.request(
            "POST",
            "/api/containers/c1/exec",
            headers=self._auth_headers(),
            json={"cmd": []},
        )

        body = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(body["error"]["code"], "INVALID_EXEC_COMMAND")

    def test_tunnel_status_uses_service_refresh(self) -> None:
        status = {
            "provider": "tailscale",
            "state": "connected",
            "connected": True,
            "needsLogin": False,
            "backendState": "Running",
            "hostname": "node-1",
            "magicDnsName": "node-1.tailnet.ts.net",
            "tailnet": "tailnet.ts.net",
            "ip": "100.64.0.10",
            "health": [],
            "updatedAt": 123,
        }

        with patch.object(main.tunnel_service, "refresh", AsyncMock(return_value=status)):
            response = self.request(
                "GET",
                "/api/tunnel/status",
                headers=self._auth_headers(),
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["data"]["state"], "connected")

    def test_tunnel_connect_rejects_unsupported_provider(self) -> None:
        response = self.request(
            "POST",
            "/api/tunnel/connect",
            headers=self._auth_headers(),
            json={"provider": "wireguard"},
        )

        body = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(body["error"]["code"], "TUNNEL_PROVIDER_UNSUPPORTED")

    def test_tunnel_connect_and_disconnect_delegate_to_service(self) -> None:
        connecting = {
            "provider": "tailscale",
            "state": "connecting",
            "connected": False,
            "needsLogin": False,
            "backendState": "Starting",
            "hostname": "node-1",
            "magicDnsName": None,
            "tailnet": None,
            "ip": None,
            "health": [],
            "updatedAt": 123,
        }
        disconnected = {
            **connecting,
            "state": "disconnected",
            "backendState": "Stopped",
            "updatedAt": 456,
        }

        with (
            patch.object(
                main.tunnel_service,
                "connect",
                AsyncMock(return_value=connecting),
            ) as connect_mock,
            patch.object(
                main.tunnel_service,
                "disconnect",
                AsyncMock(return_value=disconnected),
            ) as disconnect_mock,
        ):
            connect_response = self.request(
                "POST",
                "/api/tunnel/connect",
                headers=self._auth_headers(),
                json={
                    "provider": "tailscale",
                    "authKey": "tskey-auth-k123",
                    "hostname": "demo-node",
                },
            )
            disconnect_response = self.request(
                "POST",
                "/api/tunnel/disconnect",
                headers=self._auth_headers(),
            )

        self.assertEqual(connect_response.status_code, 200)
        self.assertEqual(disconnect_response.status_code, 200)
        connect_mock.assert_awaited_once_with("tskey-auth-k123", "demo-node")
        disconnect_mock.assert_awaited_once_with()

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
