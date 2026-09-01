from __future__ import annotations

import os
import unittest
from typing import Any
from unittest.mock import Mock, patch

os.environ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["DATABASE_PATH"] = "test_database.db"

import httpx

from app import main


class VolumesAndNetworksApiTests(unittest.TestCase):
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

    # --- Testes de Volumes ---

    def test_list_volumes(self) -> None:
        mock_volumes = [
            {
                "name": "vol_data",
                "driver": "local",
                "mountpoint": "/var/lib/docker/volumes/vol_data/_data",
                "createdAt": "2026-08-30T10:00:00Z",
                "labels": {},
                "scope": "local",
                "options": {},
                "usedBy": [{"id": "c1", "name": "web"}],
                "inUse": True,
            }
        ]
        docker_svc = Mock()
        docker_svc.list_volumes.return_value = mock_volumes

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request("GET", "/api/volumes", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertTrue(body["success"])
            self.assertEqual(body["meta"]["count"], 1)
            self.assertEqual(body["data"][0]["name"], "vol_data")

    def test_create_volume(self) -> None:
        mock_created = {
            "name": "custom_vol",
            "driver": "local",
            "mountpoint": "/var/lib/docker/volumes/custom_vol/_data",
            "createdAt": "2026-08-31T12:00:00Z",
            "labels": {"env": "prod"},
            "scope": "local",
            "options": {},
            "usedBy": [],
            "inUse": False,
        }
        docker_svc = Mock()
        docker_svc.create_volume.return_value = mock_created

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request(
                "POST",
                "/api/volumes",
                headers=self.headers,
                json={"name": "custom_vol", "driver": "local", "labels": {"env": "prod"}},
            )
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["data"]["name"], "custom_vol")

    def test_get_and_remove_volume(self) -> None:
        mock_vol = {
            "name": "my_vol",
            "driver": "local",
            "mountpoint": "/var/lib/docker/volumes/my_vol/_data",
            "createdAt": "2026-08-31T12:00:00Z",
            "labels": {},
            "scope": "local",
            "options": {},
            "usedBy": [],
            "inUse": False,
        }
        docker_svc = Mock()
        docker_svc.get_volume.return_value = mock_vol
        docker_svc.remove_volume.return_value = None

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            # Inspect
            get_res = self.request("GET", "/api/volumes/my_vol", headers=self.headers)
            self.assertEqual(get_res.status_code, 200)
            self.assertEqual(get_res.json()["data"]["name"], "my_vol")

            # Remove
            del_res = self.request("DELETE", "/api/volumes/my_vol", headers=self.headers)
            self.assertEqual(del_res.status_code, 200)
            self.assertEqual(del_res.json()["data"]["name"], "my_vol")

    def test_prune_volumes(self) -> None:
        mock_report = {
            "volumesDeleted": ["unused_vol_1", "unused_vol_2"],
            "spaceReclaimed": 10485760,
        }
        docker_svc = Mock()
        docker_svc.prune_volumes.return_value = mock_report

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request("POST", "/api/volumes/prune", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(len(body["data"]["volumesDeleted"]), 2)
            self.assertEqual(body["data"]["spaceReclaimed"], 10485760)

    # --- Testes de Redes ---

    def test_list_networks(self) -> None:
        mock_networks = [
            {
                "id": "net123",
                "fullId": "net123456789",
                "name": "custom-bridge",
                "driver": "bridge",
                "scope": "local",
                "internal": False,
                "attachable": True,
                "subnet": "172.28.0.0/16",
                "gateway": "172.28.0.1",
                "labels": {},
                "containers": [{"id": "c1", "name": "web", "ipv4Address": "172.28.0.2"}],
                "containerCount": 1,
                "created": "2026-08-30T10:00:00Z",
            }
        ]
        docker_svc = Mock()
        docker_svc.list_networks.return_value = mock_networks

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request("GET", "/api/networks", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["meta"]["count"], 1)
            self.assertEqual(body["data"][0]["name"], "custom-bridge")

    def test_create_and_remove_network(self) -> None:
        mock_created = {
            "id": "net999",
            "fullId": "net999888777",
            "name": "backend-tier",
            "driver": "bridge",
            "scope": "local",
            "internal": True,
            "attachable": True,
            "subnet": "10.0.0.0/24",
            "gateway": "10.0.0.1",
            "labels": {},
            "containers": [],
            "containerCount": 0,
            "created": "2026-08-31T15:00:00Z",
        }
        docker_svc = Mock()
        docker_svc.create_network.return_value = mock_created
        docker_svc.remove_network.return_value = None

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            # Create
            post_res = self.request(
                "POST",
                "/api/networks",
                headers=self.headers,
                json={"name": "backend-tier", "internal": True, "subnet": "10.0.0.0/24"},
            )
            self.assertEqual(post_res.status_code, 200)
            self.assertEqual(post_res.json()["data"]["id"], "net999")

            # Remove
            del_res = self.request("DELETE", "/api/networks/net999", headers=self.headers)
            self.assertEqual(del_res.status_code, 200)
            self.assertEqual(del_res.json()["data"]["id"], "net999")

    def test_connect_and_disconnect_network(self) -> None:
        docker_svc = Mock()
        docker_svc.connect_network.return_value = None
        docker_svc.disconnect_network.return_value = None

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            # Connect
            conn_res = self.request(
                "POST",
                "/api/networks/net123/connect",
                headers=self.headers,
                json={"containerId": "c1", "ipv4Address": "172.28.0.5"},
            )
            self.assertEqual(conn_res.status_code, 200)
            self.assertTrue(conn_res.json()["data"]["connected"])

            # Disconnect
            disc_res = self.request(
                "POST",
                "/api/networks/net123/disconnect",
                headers=self.headers,
                json={"containerId": "c1", "force": False},
            )
            self.assertEqual(disc_res.status_code, 200)
            self.assertTrue(disc_res.json()["data"]["disconnected"])

    def test_prune_networks(self) -> None:
        mock_report = {"networksDeleted": ["unused_net_1"]}
        docker_svc = Mock()
        docker_svc.prune_networks.return_value = mock_report

        with patch.object(main, "get_docker_service", return_value=docker_svc):
            response = self.request("POST", "/api/networks/prune", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["data"]["networksDeleted"], ["unused_net_1"])


if __name__ == "__main__":
    unittest.main()
