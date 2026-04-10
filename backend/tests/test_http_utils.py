import unittest

from app.utils.http import error_payload, success_payload


class HttpUtilsTests(unittest.TestCase):
    def test_success_payload_without_meta(self) -> None:
        payload = success_payload({"ok": True})
        self.assertEqual(payload, {"success": True, "data": {"ok": True}})

    def test_success_payload_with_meta(self) -> None:
        payload = success_payload(["a"], {"count": 1})
        self.assertEqual(
            payload,
            {"success": True, "data": ["a"], "meta": {"count": 1}},
        )

    def test_error_payload_with_details(self) -> None:
        payload = error_payload("TEST_ERROR", "Something failed", {"field": "name"})
        self.assertEqual(payload["success"], False)
        self.assertEqual(payload["error"]["code"], "TEST_ERROR")
        self.assertEqual(payload["error"]["message"], "Something failed")
        self.assertEqual(payload["error"]["details"], {"field": "name"})


if __name__ == "__main__":
    unittest.main()
