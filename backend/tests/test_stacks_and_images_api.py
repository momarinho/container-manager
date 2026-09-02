from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import unittest
from unittest.mock import Mock, patch

os.environ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["DATABASE_PATH"] = "test_database.db"

import httpx

from app import main
from app.services.stack_service import StackService


class StacksAndImagesApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        login_response = cls.request(
            "POST",
            "/api/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        cls.token = login_response.json()["data"]["token"]

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
        return asyncio.run(cls._request_async(method, path, **kwargs))

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def test_stacks_lifecycle(self) -> None:
        temp_dir = tempfile.mkdtemp()
        stack_svc = StackService(stacks_dir=temp_dir)

        sample_yaml = """
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
"""

        with (
            patch("app.routers.stacks.get_stack_service", return_value=stack_svc),
            patch.object(stack_svc, "_run_cmd", return_value=(0, "Running", "")),
        ):
            # 1. Deploy stack
            deploy_res = self.request(
                "POST",
                "/api/stacks",
                headers=self._auth_headers(),
                json={
                    "name": "my-app",
                    "composeYaml": sample_yaml,
                    "envVars": {"PORT": "8080"},
                },
            )
            self.assertEqual(deploy_res.status_code, 200)
            self.assertEqual(deploy_res.json()["data"]["name"], "my-app")

            # 2. List stacks
            list_res = self.request("GET", "/api/stacks", headers=self._auth_headers())
            self.assertEqual(list_res.status_code, 200)
            names = [s["name"] for s in list_res.json()["data"]]
            self.assertIn("my-app", names)

            # 3. Get stack details
            get_res = self.request("GET", "/api/stacks/my-app", headers=self._auth_headers())
            self.assertEqual(get_res.status_code, 200)
            self.assertIn("composeYaml", get_res.json()["data"])

            # 4. Get compose content
            compose_res = self.request(
                "GET", "/api/stacks/my-app/compose", headers=self._auth_headers()
            )
            self.assertEqual(compose_res.status_code, 200)
            self.assertIn("nginx:alpine", compose_res.json()["data"]["composeYaml"])

            # 5. Up and Down
            up_res = self.request("POST", "/api/stacks/my-app/up", headers=self._auth_headers())
            self.assertEqual(up_res.status_code, 200)

            down_res = self.request("POST", "/api/stacks/my-app/down", headers=self._auth_headers())
            self.assertEqual(down_res.status_code, 200)

            # 6. Logs
            logs_res = self.request("GET", "/api/stacks/my-app/logs", headers=self._auth_headers())
            self.assertEqual(logs_res.status_code, 200)

            # 7. Delete stack
            del_res = self.request("DELETE", "/api/stacks/my-app", headers=self._auth_headers())
            self.assertEqual(del_res.status_code, 200)
            self.assertTrue(del_res.json()["data"]["deleted"])

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_images_api(self) -> None:
        docker_service = Mock()
        docker_service.list_images.return_value = [
            {
                "id": "sha256:123456",
                "tags": ["redis:alpine"],
                "size": 32000000,
                "created": "2026-09-01T00:00:00Z",
            }
        ]
        docker_service.search_hub_images.return_value = [
            {
                "name": "redis",
                "description": "Redis in-memory data store",
                "isOfficial": True,
                "starCount": 12000,
            }
        ]
        docker_service.pull_image.return_value = {
            "image": "redis:alpine",
            "pulled": True,
        }
        docker_service.remove_image.return_value = {"id": "123456", "deleted": True}

        with patch("app.routers.images.get_docker_service", return_value=docker_service):
            # 1. List images
            list_res = self.request("GET", "/api/images", headers=self._auth_headers())
            self.assertEqual(list_res.status_code, 200)
            self.assertEqual(len(list_res.json()["data"]), 1)

            # 2. Search images
            search_res = self.request(
                "GET", "/api/images/search?query=redis", headers=self._auth_headers()
            )
            self.assertEqual(search_res.status_code, 200)
            self.assertEqual(search_res.json()["data"][0]["name"], "redis")

            # 3. Pull image
            pull_res = self.request(
                "POST",
                "/api/images/pull",
                headers=self._auth_headers(),
                json={"image": "redis:alpine"},
            )
            self.assertEqual(pull_res.status_code, 200)
            self.assertTrue(pull_res.json()["data"]["pulled"])

            # 4. Remove image
            del_res = self.request(
                "DELETE", "/api/images/sha256:123456", headers=self._auth_headers()
            )
            self.assertEqual(del_res.status_code, 200)
            self.assertTrue(del_res.json()["data"]["deleted"])


if __name__ == "__main__":
    unittest.main()
