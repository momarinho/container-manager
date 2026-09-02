from __future__ import annotations

import asyncio
import os
import unittest

os.environ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["DATABASE_PATH"] = "test_database.db"

import httpx

from app import main


class AuthTokensAndRotationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        pass

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

    def test_login_and_token_rotation_lifecycle(self) -> None:
        # 1. Login inicial
        login_res = self.request(
            "POST",
            "/api/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()["data"]

        token_1 = login_data["token"]
        refresh_token_1 = login_data["refreshToken"]
        self.assertTrue(bool(token_1))
        self.assertTrue(bool(refresh_token_1))

        # 2. Validar que token_1 acessa rota protegida
        verify_1 = self.request(
            "GET",
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token_1}"},
        )
        self.assertEqual(verify_1.status_code, 200)

        # 3. Rotacionar tokens com refresh_token_1
        refresh_res = self.request(
            "POST",
            "/api/auth/refresh",
            json={"refreshToken": refresh_token_1},
        )
        self.assertEqual(refresh_res.status_code, 200)
        refresh_data = refresh_res.json()["data"]

        token_2 = refresh_data["token"]
        refresh_token_2 = refresh_data["refreshToken"]
        self.assertNotEqual(token_1, token_2)
        self.assertNotEqual(refresh_token_1, refresh_token_2)

        # 4. Validar que token_2 funciona
        verify_2 = self.request(
            "GET",
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token_2}"},
        )
        self.assertEqual(verify_2.status_code, 200)

        # 5. Detecção de reuso: tentar usar refresh_token_1 novamente
        # Deve detectar token comprometido e revogar a família
        reuse_res = self.request(
            "POST",
            "/api/auth/refresh",
            json={"refreshToken": refresh_token_1},
        )
        self.assertEqual(reuse_res.status_code, 401)
        self.assertEqual(reuse_res.json()["error"]["code"], "AUTH_TOKEN_COMPROMISED")

        # 6. Como a família foi revogada, refresh_token_2 também é rejeitado
        subsequent_res = self.request(
            "POST",
            "/api/auth/refresh",
            json={"refreshToken": refresh_token_2},
        )
        self.assertEqual(subsequent_res.status_code, 401)

    def test_logout_revokes_access_token(self) -> None:
        # 1. Login
        login_res = self.request(
            "POST",
            "/api/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        login_data = login_res.json()["data"]
        token = login_data["token"]
        refresh_token = login_data["refreshToken"]

        # 2. Acesso antes do logout
        verify_before = self.request(
            "GET",
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(verify_before.status_code, 200)

        # 3. Executar logout
        logout_res = self.request(
            "POST",
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
            json={"refreshToken": refresh_token},
        )
        self.assertEqual(logout_res.status_code, 200)
        self.assertTrue(logout_res.json()["data"]["revoked"])

        # 4. Acesso posterior com o token revogado deve ser bloqueado imediatamente (401)
        verify_after = self.request(
            "GET",
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(verify_after.status_code, 401)


if __name__ == "__main__":
    unittest.main()
