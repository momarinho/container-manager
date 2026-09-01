from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from app.config import load_config


class SecurityConfigTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "JWT_SECRET": "0123456789abcdef0123456789abcdef",
            "NODE_ENV": "production",
            "CORS_ORIGIN": "*",
        },
        clear=False,
    )
    def test_cors_wildcard_rejected_in_production(self) -> None:
        with self.assertRaises(ValueError) as ctx:
            load_config()
        self.assertIn("CORS_ORIGIN cannot be '*'", str(ctx.exception))

    @patch.dict(
        os.environ,
        {
            "JWT_SECRET": "0123456789abcdef0123456789abcdef",
            "NODE_ENV": "production",
            "CORS_ORIGIN": "https://app.example.com,https://api.example.com",
        },
        clear=False,
    )
    def test_cors_explicit_origins_accepted_in_production(self) -> None:
        cfg = load_config()
        self.assertEqual(cfg.cors_origin, "https://app.example.com,https://api.example.com")
        self.assertEqual(cfg.node_env, "production")

    @patch.dict(
        os.environ,
        {
            "JWT_SECRET": "0123456789abcdef0123456789abcdef",
            "NODE_ENV": "development",
            "CORS_ORIGIN": "*",
        },
        clear=False,
    )
    def test_cors_wildcard_accepted_in_development(self) -> None:
        cfg = load_config()
        self.assertEqual(cfg.cors_origin, "*")
        self.assertEqual(cfg.node_env, "development")

    @patch.dict(
        os.environ,
        {
            "JWT_SECRET": "0123456789abcdef0123456789abcdef",
            "DOCKER_HOST": "tcp://docker-proxy:2375",
            "DOCKER_SOCKET_PATH": "/var/run/docker.sock",
        },
        clear=False,
    )
    def test_docker_host_takes_precedence(self) -> None:
        cfg = load_config()
        self.assertEqual(cfg.docker_socket_path, "tcp://docker-proxy:2375")


if __name__ == "__main__":
    unittest.main()
