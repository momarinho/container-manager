import os
import unittest

# Configure JWT secret and separate test database before importing the app
os.environ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["DATABASE_PATH"] = "test_database.db"

from app.database import db_manager
from app.services.auth_service import AuthService


class AuthServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = AuthService()
        # Clean up any residual test users before starting
        self._clear_test_users()

    def tearDown(self) -> None:
        self._clear_test_users()

    def _clear_test_users(self) -> None:
        with db_manager.get_connection() as conn:
            conn.execute("DELETE FROM users WHERE username != 'alice'")
            conn.commit()

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

    def test_create_and_list_users(self) -> None:
        # Create user
        user = self.service.create_user("bob", "bobpassword")
        self.assertEqual(user["username"], "bob")
        self.assertIsNotNone(user["id"])

        # Check in list
        users = self.service.list_users()
        usernames = [u["username"] for u in users]
        self.assertIn("bob", usernames)
        self.assertIn("alice", usernames)

    def test_delete_user(self) -> None:
        # Create user
        self.service.create_user("charlie", "charliepass")

        # Verify it exists
        self.assertIsNotNone(self.service.get_user_by_username("charlie"))

        # Delete user
        success = self.service.delete_user("charlie")
        self.assertTrue(success)

        # Verify it is gone
        self.assertIsNone(self.service.get_user_by_username("charlie"))

    def test_delete_user_prevents_alice_deletion(self) -> None:
        with self.assertRaises(ValueError):
            self.service.delete_user("alice")


if __name__ == "__main__":
    unittest.main()
