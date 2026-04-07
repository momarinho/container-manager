from __future__ import annotations

import asyncio
import socket as socket_lib
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.config import config
from app.services.docker_service import DockerService
from app.utils.logger import logger


class DockerSocketAdapter:
    def __init__(self, raw_socket: Any) -> None:
        self.raw_socket = raw_socket
        self.socket = self._resolve_socket(raw_socket)
        settimeout = getattr(self.socket, "settimeout", None)
        if callable(settimeout):
            try:
                settimeout(1.0)
            except OSError:
                pass

    @staticmethod
    def _resolve_socket(raw_socket: Any) -> Any:
        if hasattr(raw_socket, "_sock"):
            return raw_socket._sock
        if hasattr(raw_socket, "sock"):
            return raw_socket.sock
        return raw_socket

    def recv(self, size: int) -> bytes:
        if hasattr(self.socket, "recv"):
            return self.socket.recv(size)
        if hasattr(self.raw_socket, "read"):
            chunk = self.raw_socket.read(size)
            if isinstance(chunk, bytes):
                return chunk
            return (chunk or "").encode()
        raise RuntimeError("Socket object does not support recv/read")

    def send(self, data: bytes) -> None:
        if hasattr(self.socket, "sendall"):
            self.socket.sendall(data)
            return
        if hasattr(self.socket, "send"):
            self.socket.send(data)
            return
        if hasattr(self.raw_socket, "write"):
            self.raw_socket.write(data)
            return
        raise RuntimeError("Socket object does not support send/write")

    def close(self) -> None:
        close_fn = getattr(self.raw_socket, "close", None)
        if callable(close_fn):
            close_fn()
            return
        close_fn = getattr(self.socket, "close", None)
        if callable(close_fn):
            close_fn()


@dataclass
class TerminalSession:
    id: str
    container_id: str
    exec_id: str
    socket: DockerSocketAdapter
    queue: asyncio.Queue[dict[str, str]]
    loop: asyncio.AbstractEventLoop
    last_activity: float
    thread: threading.Thread | None = None
    closing: threading.Event = field(default_factory=threading.Event)


class TerminalService:
    def __init__(self, docker_service: DockerService) -> None:
        self.docker_service = docker_service
        self.sessions: dict[str, TerminalSession] = {}
        self._lock = threading.Lock()
        self._cleanup_task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop(), name="terminal-cleanup")

    async def stop(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

        for session_id in list(self.sessions.keys()):
            self.close_session(session_id)

    async def create_session(
        self,
        container_id: str,
        shell: str = "/bin/sh",
        cols: int = 80,
        rows: int = 24,
    ) -> str:
        with self._lock:
            if len(self.sessions) >= config.terminal_max_sessions:
                raise RuntimeError("Maximum terminal sessions reached")

        state = await asyncio.to_thread(self.docker_service.inspect_container_state, container_id)
        if not state.get("Running"):
            raise RuntimeError("Container is not running")

        session_id = f"{container_id}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:9]}"
        loop = asyncio.get_running_loop()
        last_error: Exception | None = None

        for candidate in self._get_shell_candidates(shell):
            session: TerminalSession | None = None
            try:
                exec_id, raw_socket = await asyncio.to_thread(
                    self.docker_service.create_exec_socket,
                    container_id,
                    [candidate],
                )
                session = TerminalSession(
                    id=session_id,
                    container_id=container_id,
                    exec_id=exec_id,
                    socket=DockerSocketAdapter(raw_socket),
                    queue=asyncio.Queue(),
                    loop=loop,
                    last_activity=time.monotonic(),
                )
                thread = threading.Thread(
                    target=self._stream_session_output,
                    args=(session,),
                    daemon=True,
                    name=f"terminal-{session_id}",
                )
                session.thread = thread

                with self._lock:
                    self.sessions[session_id] = session

                await asyncio.to_thread(self.docker_service.resize_exec, exec_id, rows, cols)
                thread.start()

                logger.info(
                    "Created terminal session %s for container %s using shell %s",
                    session_id,
                    container_id,
                    candidate,
                )
                return session_id
            except Exception as exc:
                last_error = exc
                if session is not None:
                    with self._lock:
                        self.sessions.pop(session.id, None)
                    try:
                        session.socket.close()
                    except Exception:
                        pass
                logger.warning(
                    "Failed to start terminal shell for %s using %s: %s",
                    container_id,
                    candidate,
                    exc,
                )

        raise RuntimeError(str(last_error or "Failed to create terminal session"))

    def get_event_queue(self, session_id: str) -> asyncio.Queue[dict[str, str]]:
        session = self.sessions.get(session_id)
        if not session:
            raise RuntimeError("Terminal session not found")
        return session.queue

    def write(self, session_id: str, data: str) -> None:
        session = self.sessions.get(session_id)
        if not session:
            raise RuntimeError("Terminal session not found")
        session.socket.send(data.encode("utf-8"))
        session.last_activity = time.monotonic()

    async def resize(self, session_id: str, cols: int, rows: int) -> None:
        session = self.sessions.get(session_id)
        if not session:
            raise RuntimeError("Terminal session not found")
        session.last_activity = time.monotonic()
        await asyncio.to_thread(self.docker_service.resize_exec, session.exec_id, rows, cols)

    def close_session(self, session_id: str) -> None:
        session = self.sessions.get(session_id)
        if not session:
            return

        session.closing.set()
        try:
            session.socket.send(b"exit\n")
        except Exception:
            pass

        try:
            session.socket.close()
        except Exception:
            pass

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(60)
            threshold = time.monotonic() - (config.terminal_idle_timeout / 1000)
            stale_sessions = [
                session_id
                for session_id, session in list(self.sessions.items())
                if session.last_activity < threshold
            ]
            for session_id in stale_sessions:
                logger.info("Closing idle terminal session %s", session_id)
                self.close_session(session_id)

    def _stream_session_output(self, session: TerminalSession) -> None:
        try:
            while not session.closing.is_set():
                try:
                    chunk = session.socket.recv(4096)
                except socket_lib.timeout:
                    continue

                if not chunk:
                    break

                session.last_activity = time.monotonic()
                self._publish(session, {"type": "output", "data": chunk.decode("utf-8", errors="ignore")})
        except Exception as exc:
            logger.exception("Terminal session %s stream error", session.id)
            self._publish(session, {"type": "error", "message": str(exc)})
        finally:
            self._publish(session, {"type": "output", "data": self._get_close_message(session.exec_id)})
            self._publish(session, {"type": "closed"})
            with self._lock:
                self.sessions.pop(session.id, None)
            try:
                session.socket.close()
            except Exception:
                pass

    def _publish(self, session: TerminalSession, payload: dict[str, str]) -> None:
        try:
            session.loop.call_soon_threadsafe(session.queue.put_nowait, payload)
        except RuntimeError:
            logger.debug("Event loop closed while publishing terminal event")

    def _get_close_message(self, exec_id: str) -> str:
        try:
            info = self.docker_service.inspect_exec(exec_id)
            exit_code = info.get("ExitCode", "unknown")
            return f"\r\n[Session closed. Exit code: {exit_code}]\r\n"
        except Exception:
            return "\r\n[Session closed]\r\n"

    @staticmethod
    def _get_shell_candidates(shell: str) -> list[str]:
        return list(dict.fromkeys([shell, "/bin/sh", "sh", "/bin/bash", "bash"]))
