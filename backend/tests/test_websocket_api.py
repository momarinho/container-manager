import asyncio
import os
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "0123456789abcdef0123456789abcdef")

from app import main
from app.services.auth_service import auth_service


class FakeLogStream:
    def __init__(self, *chunks: bytes) -> None:
        self._chunks = list(chunks)
        self.closed = False

    def __iter__(self) -> "FakeLogStream":
        return self

    def __next__(self) -> bytes:
        if self.closed or not self._chunks:
            raise StopIteration
        return self._chunks.pop(0)

    def close(self) -> None:
        self.closed = True


class FakeTerminalService:
    def __init__(self) -> None:
        self.queues: dict[str, asyncio.Queue[dict[str, str]]] = {}
        self.created: list[tuple[str, str, int, int]] = []
        self.writes: list[tuple[str, str]] = []
        self.resizes: list[tuple[str, int, int]] = []
        self.closed: list[str] = []

    async def create_session(
        self,
        container_id: str,
        shell: str,
        cols: int,
        rows: int,
    ) -> str:
        session_id = "session-1"
        self.created.append((container_id, shell, cols, rows))
        self.queues[session_id] = asyncio.Queue()
        return session_id

    def get_event_queue(self, session_id: str) -> asyncio.Queue[dict[str, str]]:
        return self.queues[session_id]

    def write(self, session_id: str, data: str) -> None:
        self.writes.append((session_id, data))
        self.queues[session_id].put_nowait({"type": "output", "data": data})

    async def resize(self, session_id: str, cols: int, rows: int) -> None:
        self.resizes.append((session_id, cols, rows))

    def close_session(self, session_id: str) -> None:
        if session_id in self.closed:
            return
        self.closed.append(session_id)
        self.queues[session_id].put_nowait({"type": "closed"})


class WebSocketApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.token = auth_service.generate_token("u1", "alice")
        self.stack = ExitStack()
        self.stack.enter_context(patch.object(main.system_stats_service, "start", Mock()))
        self.stack.enter_context(
            patch.object(main.system_stats_service, "stop", AsyncMock())
        )
        self.stack.enter_context(patch.object(main.terminal_service, "start", Mock()))
        self.stack.enter_context(
            patch.object(main.terminal_service, "stop", AsyncMock())
        )
        self.stack.enter_context(patch.object(main.tunnel_service, "start", Mock()))
        self.stack.enter_context(patch.object(main.tunnel_service, "stop", AsyncMock()))
        self.client = self.stack.enter_context(TestClient(main.app))

    def tearDown(self) -> None:
        self.stack.close()

    def test_websocket_without_token_returns_authentication_error(self) -> None:
        with self.client.websocket_connect("/ws/tunnel") as websocket:
            payload = websocket.receive_json()

        self.assertEqual(payload["type"], "error")
        self.assertEqual(payload["message"], "Authentication required")

    def test_tunnel_websocket_streams_connected_and_initial_status(self) -> None:
        queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
        queue.put_nowait(
            {
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
                "updatedAt": 1,
            }
        )

        with (
            patch.object(main.tunnel_service, "subscribe", return_value=queue),
            patch.object(main.tunnel_service, "unsubscribe") as unsubscribe_mock,
        ):
            with self.client.websocket_connect(f"/ws/tunnel?token={self.token}") as websocket:
                connected = websocket.receive_json()
                status = websocket.receive_json()

            unsubscribe_mock.assert_called_once_with(queue)

        self.assertEqual(connected["type"], "connected")
        self.assertEqual(status["type"], "tunnel_status")
        self.assertEqual(status["data"]["state"], "connected")

    def test_logs_websocket_streams_log_chunks_and_supports_unsubscribe(self) -> None:
        docker_service = Mock()
        docker_service.open_log_stream.return_value = FakeLogStream(b"hello\n")

        with patch.object(main, "get_docker_service", return_value=docker_service):
            with self.client.websocket_connect(
                f"/ws/logs/container-1?token={self.token}"
            ) as websocket:
                connected = websocket.receive_json()
                log_event = websocket.receive_json()
                websocket.send_json({"action": "unsubscribe"})
                unsubscribed = websocket.receive_json()

        self.assertEqual(connected["type"], "connected")
        self.assertEqual(connected["containerId"], "container-1")
        self.assertEqual(log_event["type"], "log")
        self.assertEqual(log_event["containerId"], "container-1")
        self.assertEqual(log_event["data"], "hello\n")
        self.assertEqual(unsubscribed["type"], "unsubscribed")

    def test_terminal_websocket_forwards_start_input_resize_and_close(self) -> None:
        terminal_service = FakeTerminalService()

        with patch.object(main, "terminal_service", terminal_service):
            with self.client.websocket_connect(
                f"/ws/terminal/container-1?token={self.token}"
            ) as websocket:
                ready = websocket.receive_json()
                websocket.send_json(
                    {"action": "start", "shell": "/bin/sh", "cols": 120, "rows": 40}
                )
                started = websocket.receive_json()
                websocket.send_json({"action": "input", "input": "echo smoke\n"})
                output = websocket.receive_json()
                websocket.send_json({"action": "resize", "cols": 100, "rows": 30})
                websocket.send_json({"action": "close"})
                closed = websocket.receive_json()

        self.assertEqual(ready["type"], "ready")
        self.assertEqual(started["type"], "started")
        self.assertEqual(started["sessionId"], "session-1")
        self.assertEqual(output["type"], "output")
        self.assertIn("smoke", output["data"])
        self.assertEqual(closed["type"], "closed")
        self.assertEqual(
            terminal_service.created,
            [("container-1", "/bin/sh", 120, 40)],
        )
        self.assertEqual(
            terminal_service.writes,
            [("session-1", "echo smoke\n")],
        )
        self.assertEqual(terminal_service.resizes, [("session-1", 100, 30)])
        self.assertEqual(terminal_service.closed, ["session-1"])


if __name__ == "__main__":
    unittest.main()
