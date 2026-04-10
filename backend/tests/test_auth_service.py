import os
import unittest

os.environ.setdefault("JWT_SECRET", "0123456789abcdef0123456789abcdef")

from app.services.auth_service import AuthService


class AuthServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = AuthService()

    def test_validate_credentials_with_password(self) -> None:
        is_valid = self.service.validate_credentials(
            username="alice",
            password="password123",
        )
        self.assertTrue(is_valid)

    def test_validate_credentials_rejects_wrong_password(self) -> None:
        is_valid = self.service.validate_credentials(
            username="alice",
            password="wrong-password",
        )
        self.assertFalse(is_valid)

    def test_verify_token_roundtrip(self) -> None:
        token = self.service.generate_token("u1", "alice")
        payload = self.service.verify_token(token)
        self.assertEqual(payload, {"userId": "u1", "username": "alice"})


if __name__ == "__main__":
    unittest.main()
