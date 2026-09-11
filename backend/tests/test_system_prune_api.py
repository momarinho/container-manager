from __future__ import annotations

import os
import unittest
from typing import Any
from unittest.mock import Mock, patch

os.environ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["DATABASE_PATH"] = "test_database.db"

import httpx

from app import main
from app.services.docker_service import DockerService


class SystemPruneApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        login_response = cls.request(
            "POST",
            "/api/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        cls.token = login_response.json()["data"]["token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    @classmethod
    def _run_sync(cls, func: Any, *args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)

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
            import asyncio

            return asyncio.run(cls._request_async(method, path, **kwargs))

    # --- Unit Tests for DockerService Prune Methods ---

    def test_docker_service_prune_containers(self) -> None:
        service = DockerService.__new__(DockerService)
        service.api = Mock()
        service.api.prune_containers.return_value = {
            "ContainersDeleted": ["c1", "c2"],
            "SpaceReclaimed": 2048,
        }

        result = service.prune_containers()
        self.assertEqual(result["containersDeleted"], ["c1", "c2"])
        self.assertEqual(result["spaceReclaimed"], 2048)
        service.api.prune_containers.assert_called_once_with(filters=None)

    def test_docker_service_prune_images(self) -> None:
        service = DockerService.__new__(DockerService)
        service.api = Mock()
        service.api.prune_images.return_value = {
            "ImagesDeleted": [{"Untagged": "sha256:abc"}],
            "SpaceReclaimed": 4096,
        }

        result = service.prune_images()
        self.assertEqual(result["imagesDeleted"], [{"Untagged": "sha256:abc"}])
        self.assertEqual(result["spaceReclaimed"], 4096)
        service.api.prune_images.assert_called_once_with(filters=None)

    def test_docker_service_prune_system_selective(self) -> None:
        service = DockerService.__new__(DockerService)
        service.prune_containers = Mock(
            return_value={"containersDeleted": ["c1"], "spaceReclaimed": 100}
        )
        service.prune_images = Mock(
            return_value={"imagesDeleted": [{"Untagged": "img1"}], "spaceReclaimed": 200}
        )
        service.prune_volumes = Mock(
            return_value={"volumesDeleted": ["v1"], "spaceReclaimed": 300}
        )
        service.prune_networks = Mock(
            return_value={"networksDeleted": ["net1"]}
        )

        res = service.prune_system(containers=True, images=False, volumes=True, networks=False)
        self.assertEqual(res["containersDeleted"], ["c1"])
        self.assertEqual(res["imagesDeleted"], [])
        self.assertEqual(res["volumesDeleted"], ["v1"])
        self.assertEqual(res["networksDeleted"], [])
        self.assertEqual(res["spaceReclaimed"], 400)
        service.prune_containers.assert_called_once()
        service.prune_images.assert_not_called()
        service.prune_volumes.assert_called_once()
        service.prune_networks.assert_not_called()

    # --- API Endpoint Tests ---

    def test_prune_system_endpoint_default(self) -> None:
        mock_report = {
            "containersDeleted": ["c1", "c2"],
            "imagesDeleted": [{"Untagged": "img1"}],
            "volumesDeleted": [],
            "networksDeleted": [],
            "spaceReclaimed": 10240,
        }
        docker_svc = Mock()
        docker_svc.prune_system.return_value = mock_report

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request("POST", "/api/system/prune", json={}, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            data = response.json()["data"]
            self.assertEqual(data["spaceReclaimed"], 10240)
            self.assertEqual(len(data["containersDeleted"]), 2)
            self.assertEqual(len(data["imagesDeleted"]), 1)
            docker_svc.prune_system.assert_called_once_with(
                containers=True, images=True, volumes=False, networks=False
            )

    def test_prune_system_endpoint_custom_options(self) -> None:
        mock_report = {
            "containersDeleted": [],
            "imagesDeleted": [],
            "volumesDeleted": ["v1"],
            "networksDeleted": ["n1"],
            "spaceReclaimed": 5000,
        }
        docker_svc = Mock()
        docker_svc.prune_system.return_value = mock_report

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request(
                "POST",
                "/api/system/prune",
                json={"containers": False, "images": False, "volumes": True, "networks": True},
                headers=self.headers,
            )
            self.assertEqual(response.status_code, 200)
            docker_svc.prune_system.assert_called_once_with(
                containers=False, images=False, volumes=True, networks=True
            )

    def test_prune_system_unauthorized(self) -> None:
        response = self.request("POST", "/api/system/prune", json={})
        self.assertEqual(response.status_code, 401)

    def test_prune_system_failure_returns_500(self) -> None:
        docker_svc = Mock()
        docker_svc.prune_system.side_effect = RuntimeError("Docker daemon is unreachable")

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request("POST", "/api/system/prune", json={}, headers=self.headers)
            self.assertEqual(response.status_code, 500)
            body = response.json()
            self.assertFalse(body["success"])
            self.assertEqual(body["error"]["code"], "SYSTEM_PRUNE_FAILED")
