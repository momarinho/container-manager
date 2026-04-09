from __future__ import annotations

import asyncio
import json
import time
from collections import defaultdict, deque
from threading import Event
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request, Response, WebSocket
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.websockets import WebSocketDisconnect

from app.config import config
from app.models import ExecRequest, LoginCredentials, TunnelConnectRequest
from app.security import get_bearer_token, utc_timestamp, verify_jwt
from app.services.auth_service import auth_service
from app.services.docker_service import docker_service
from app.services.system_stats import SystemStatsService
from app.services.terminal_service import TerminalService
from app.services.tunnel_service import TunnelService
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

app = FastAPI(title="ContainerMaster Backend Python", docs_url="/docs", redoc_url=None)

allowed_origins = (
    ["*"]
    if config.cors_origin == "*"
    else [origin.strip() for origin in config.cors_origin.split(",") if origin.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InMemoryRateLimiter:
    def __init__(self, window_ms: int, max_requests: int) -> None:
        self.window_seconds = window_ms / 1000
        self.max_requests = max_requests
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = asyncio.Lock()

    async def check(self, key: str) -> bool:
        now = time.monotonic()
        async with self.lock:
            history = self.requests[key]
            while history and now - history[0] > self.window_seconds:
                history.popleft()

            if len(history) >= self.max_requests:
                return False

            history.append(now)
            return True


rate_limiter = InMemoryRateLimiter(
    window_ms=config.rate_limit_window_ms,
    max_requests=config.rate_limit_max_requests,
)
system_stats_service = SystemStatsService(docker_service)
terminal_service = TerminalService(docker_service)
tunnel_service = TunnelService()


@app.on_event("startup")
async def on_startup() -> None:
    app.state.started_at = time.monotonic()
    system_stats_service.start()
    terminal_service.start()
    tunnel_service.start()
    logger.info(
        "ContainerMaster Python backend started on %s:%s", config.host, config.port
    )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await terminal_service.stop()
    await system_stats_service.stop()
    await tunnel_service.stop()


@app.middleware("http")
async def log_and_rate_limit_requests(request: Request, call_next: Any) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    allowed = await rate_limiter.check(client_ip)
    if not allowed:
        logger.warning("Rate limit exceeded for IP %s", client_ip)
        return JSONResponse(
            status_code=429,
            content={
                "error": "Too many requests",
                "retryAfter": round(config.rate_limit_window_ms / 1000),
            },
        )

    logger.info("%s %s", request.method, request.url.path)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return error_response(400, "VALIDATION_ERROR", "Validation error", exc.errors())


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    if exc.status_code == 404:
        return error_response(404, "NOT_FOUND", "Not found", {"path": request.url.path})
    return error_response(
        exc.status_code,
        "HTTP_ERROR",
        exc.detail if isinstance(exc.detail, str) else "HTTP error",
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    logger.exception("Unhandled exception")
    details = {"message": str(exc)} if config.node_env == "development" else None
    return error_response(
        500, "INTERNAL_SERVER_ERROR", "Internal server error", details
    )


def _unauthorized_missing() -> JSONResponse:
    return error_response(401, "AUTH_TOKEN_MISSING", "Missing token")


def _unauthorized_invalid() -> JSONResponse:
    return error_response(401, "AUTH_TOKEN_INVALID", "Invalid or expired token")


def require_http_user(request: Request) -> dict[str, str]:
    token = get_bearer_token(request.headers.get("Authorization"))
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        payload = verify_jwt(token)
        return {
            "id": str(payload["userId"]),
            "username": str(payload["username"]),
        }
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


@app.get("/health")
async def health() -> dict[str, Any]:
    started_at = getattr(app.state, "started_at", time.monotonic())
    return success_payload(
        {
            "status": "ok",
            "timestamp": utc_timestamp(),
            "uptime": time.monotonic() - started_at,
        }
    )


@app.post("/api/auth/login")
async def login(credentials: LoginCredentials):
    if not credentials.username and not credentials.apiToken:
        return error_response(
            400,
            "AUTH_CREDENTIALS_REQUIRED",
            "Username/password or API token required",
        )

    is_valid = await asyncio.to_thread(
        auth_service.validate_credentials,
        credentials.username,
        credentials.password,
        credentials.apiToken,
    )
    if not is_valid:
        return error_response(401, "AUTH_INVALID_CREDENTIALS", "Invalid credentials")

    response = auth_service.build_login_response(credentials.username)
    response.expiresAt = int(time.time() * 1000) + response.expiresAt
    return success_payload(response.model_dump())


@app.get("/api/auth/verify")
async def verify(request: Request):
    try:
        user = require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    return success_payload({"valid": True, "user": user})


@app.get("/api/auth/validate")
@app.post("/api/auth/validate")
async def validate(request: Request, body: dict[str, Any] | None = Body(default=None)):
    token = None
    if body:
        token = body.get("token")
    if not token:
        token = get_bearer_token(request.headers.get("Authorization"))

    if not token:
        return error_response(400, "AUTH_TOKEN_REQUIRED", "Token required")

    try:
        payload = verify_jwt(token)
    except ValueError:
        return error_response(401, "AUTH_TOKEN_INVALID", "Invalid token")

    return success_payload(
        {
            "valid": True,
            "user": {
                "id": str(payload["userId"]),
                "username": str(payload["username"]),
            },
        }
    )


@app.get("/api/containers")
async def list_containers(
    request: Request,
    all: bool = False,
    status: str | None = None,
    name: str | None = None,
):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        containers = await asyncio.to_thread(docker_service.list_containers, all)
        if status:
            containers = [
                container for container in containers if container["state"] == status
            ]
        if name:
            needle = name.lower()
            containers = [
                container
                for container in containers
                if any(
                    needle in container_name.lower()
                    for container_name in container["names"]
                )
                or needle in container["image"].lower()
            ]
        return success_payload(containers, {"count": len(containers)})
    except Exception:
        logger.exception("Failed to list containers")
        return error_response(
            500, "CONTAINERS_LIST_FAILED", "Failed to list containers"
        )


@app.get("/api/containers/{container_id}")
async def get_container(request: Request, container_id: str):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        container = await asyncio.to_thread(docker_service.get_container, container_id)
        return success_payload(container)
    except Exception:
        logger.exception("Failed to get container %s", container_id)
        return error_response(500, "CONTAINER_GET_FAILED", "Failed to get container")


async def _container_action(
    request: Request,
    container_id: str,
    method_name: str,
    code: str,
    message: str,
    error_message: str,
) -> JSONResponse | dict[str, Any]:
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        action = getattr(docker_service, method_name)
        await asyncio.to_thread(action, container_id)
        return success_payload({"id": container_id, "message": message})
    except Exception:
        logger.exception("Failed container action %s on %s", method_name, container_id)
        return error_response(500, code, error_message)


@app.post("/api/containers/{container_id}/start")
async def start_container(request: Request, container_id: str):
    return await _container_action(
        request,
        container_id,
        "start_container",
        "CONTAINER_START_FAILED",
        "Container started",
        "Failed to start container",
    )


@app.post("/api/containers/{container_id}/stop")
async def stop_container(request: Request, container_id: str):
    return await _container_action(
        request,
        container_id,
        "stop_container",
        "CONTAINER_STOP_FAILED",
        "Container stopped",
        "Failed to stop container",
    )


@app.post("/api/containers/{container_id}/restart")
async def restart_container(request: Request, container_id: str):
    return await _container_action(
        request,
        container_id,
        "restart_container",
        "CONTAINER_RESTART_FAILED",
        "Container restarted",
        "Failed to restart container",
    )


@app.post("/api/containers/{container_id}/pause")
async def pause_container(request: Request, container_id: str):
    return await _container_action(
        request,
        container_id,
        "pause_container",
        "CONTAINER_PAUSE_FAILED",
        "Container paused",
        "Failed to pause container",
    )


@app.post("/api/containers/{container_id}/unpause")
async def unpause_container(request: Request, container_id: str):
    return await _container_action(
        request,
        container_id,
        "unpause_container",
        "CONTAINER_UNPAUSE_FAILED",
        "Container unpaused",
        "Failed to unpause container",
    )


@app.delete("/api/containers/{container_id}")
async def remove_container(
    request: Request,
    container_id: str,
    force: bool = False,
):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        await asyncio.to_thread(docker_service.remove_container, container_id, force)
        return success_payload({"id": container_id, "message": "Container removed"})
    except Exception:
        logger.exception("Failed to remove container %s", container_id)
        return error_response(
            500, "CONTAINER_REMOVE_FAILED", "Failed to remove container"
        )


@app.get("/api/containers/{container_id}/stats")
async def get_container_stats(request: Request, container_id: str):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        container_state = await asyncio.to_thread(
            docker_service.inspect_container_state, container_id
        )
        current_status = str(container_state.get("Status", "")).lower()

        if current_status != "running":
            return error_response(
                409,
                "CONTAINER_STATS_UNAVAILABLE",
                "Container stats unavailable for current state",
                {"state": current_status or "unknown"},
            )

        stats = await asyncio.to_thread(
            docker_service.get_container_stats, container_id
        )
        return success_payload(stats)
    except Exception:
        logger.exception("Failed to get stats for container %s", container_id)
        return error_response(
            500, "CONTAINER_STATS_FAILED", "Failed to get container stats"
        )


@app.post("/api/containers/{container_id}/exec")
async def exec_in_container(
    request: Request,
    container_id: str,
    payload: ExecRequest,
):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    if not payload.cmd:
        return error_response(
            400, "INVALID_EXEC_COMMAND", "cmd is required and must be an array"
        )

    try:
        result = await asyncio.to_thread(
            docker_service.exec_in_container,
            container_id,
            payload.cmd,
            payload.env,
        )
        return success_payload(result)
    except Exception:
        logger.exception("Failed to exec in container %s", container_id)
        return error_response(500, "CONTAINER_EXEC_FAILED", "Failed to execute command")


@app.get("/api/system/stats")
async def get_stats(request: Request):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    return success_payload(system_stats_service.get_current_stats())


@app.get("/api/system/stats/history")
async def get_stats_history(request: Request, limit: int | None = None):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        history = system_stats_service.get_history(limit)
        return success_payload(history)
    except Exception:
        logger.exception("Failed to get stats history")
        return error_response(
            500, "SYSTEM_STATS_HISTORY_FAILED", "Failed to get stats history"
        )


@app.get("/api/system/info")
async def get_system_info(request: Request):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        info = await system_stats_service.get_system_info()
        return success_payload(info)
    except Exception:
        logger.exception("Failed to get system info")
        return error_response(500, "SYSTEM_INFO_FAILED", "Failed to get system info")


@app.get("/api/tunnel/status")
async def get_tunnel_status(request: Request):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        status = await tunnel_service.refresh()
        return success_payload(status)
    except Exception:
        logger.exception("Failed to get tunnel status")
        return error_response(
            500, "TUNNEL_STATUS_FAILED", "Failed to get tunnel status"
        )


@app.post("/api/tunnel/connect")
async def connect_tunnel(request: Request, payload: TunnelConnectRequest):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    if payload.provider != "tailscale":
        return error_response(
            400,
            "TUNNEL_PROVIDER_UNSUPPORTED",
            "Only tailscale is supported in sprint 1",
        )

    try:
        status = await tunnel_service.connect(payload.auth_key, payload.hostname)
        return success_payload(status)
    except Exception:
        logger.exception("Failed to connect tunnel")
        return error_response(500, "TUNNEL_CONNECT_FAILED", "Failed to connect tunnel")


@app.post("/api/tunnel/disconnect")
async def disconnect_tunnel(request: Request):
    try:
        require_http_user(request)
    except HTTPException as exc:
        return (
            _unauthorized_missing()
            if exc.detail == "Missing token"
            else _unauthorized_invalid()
        )

    try:
        status = await tunnel_service.disconnect()
        return success_payload(status)
    except Exception:
        logger.exception("Failed to disconnect tunnel")
        return error_response(
            500, "TUNNEL_DISCONNECT_FAILED", "Failed to disconnect tunnel"
        )


async def authenticate_websocket(websocket: WebSocket) -> dict[str, str] | None:
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token:
        await websocket.send_json(
            {"type": "error", "message": "Authentication required"}
        )
        await websocket.close(code=1008, reason="Authentication required")
        return None

    try:
        payload = verify_jwt(token)
        user = {
            "id": str(payload["userId"]),
            "username": str(payload["username"]),
        }
        logger.info(
            "WebSocket connection established: %s for user %s",
            websocket.url.path,
            user["username"],
        )
        return user
    except (KeyError, ValueError):
        await websocket.send_json({"type": "error", "message": "Invalid token"})
        await websocket.close(code=1008, reason="Invalid token")
        return None


@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    queue = system_stats_service.subscribe()
    await websocket.send_json({"type": "connected"})

    try:
        while True:
            stats = await queue.get()
            await websocket.send_json({"type": "stats", "data": stats})
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: stats")
    finally:
        system_stats_service.unsubscribe(queue)


@app.websocket("/ws/tunnel")
async def websocket_tunnel(websocket: WebSocket) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    queue = tunnel_service.subscribe()
    await websocket.send_json({"type": "connected"})

    try:
        while True:
            status = await queue.get()
            await websocket.send_json({"type": "tunnel_status", "data": status})
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: tunnel")
    finally:
        tunnel_service.unsubscribe(queue)


@app.websocket("/ws/logs/{container_id}")
async def websocket_logs(websocket: WebSocket, container_id: str) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    queue: asyncio.Queue[dict[str, str] | None] = asyncio.Queue()
    stop_event = Event()
    loop = asyncio.get_running_loop()
    try:
        log_stream = await asyncio.to_thread(
            docker_service.open_log_stream, container_id
        )
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1011, reason="Log stream failed")
        return

    def reader() -> None:
        try:
            for chunk in log_stream:
                if stop_event.is_set():
                    break
                payload = {
                    "type": "log",
                    "data": chunk.decode("utf-8", errors="ignore"),
                }
                loop.call_soon_threadsafe(queue.put_nowait, payload)
        except Exception as exc:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "error", "message": str(exc)},
            )
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    reader_thread = asyncio.to_thread(reader)
    reader_task = asyncio.create_task(reader_thread)

    async def sender() -> None:
        while True:
            event = await queue.get()
            if event is None:
                break
            if event["type"] == "error":
                await websocket.send_json(
                    {"type": "error", "message": event["message"]}
                )
                continue
            await websocket.send_json(
                {
                    "type": "log",
                    "containerId": container_id,
                    "data": event["data"],
                }
            )

    sender_task = asyncio.create_task(sender())
    await websocket.send_json({"type": "connected", "containerId": container_id})

    try:
        while True:
            message = await websocket.receive_text()
            payload = json.loads(message)
            if payload.get("action") == "unsubscribe":
                stop_event.set()
                close_fn = getattr(log_stream, "close", None)
                if callable(close_fn):
                    close_fn()
                await websocket.send_json({"type": "unsubscribed"})
                break
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: logs")
    finally:
        stop_event.set()
        close_fn = getattr(log_stream, "close", None)
        if callable(close_fn):
            close_fn()
        await sender_task
        await reader_task


@app.websocket("/ws/terminal/{container_id}")
async def websocket_terminal(websocket: WebSocket, container_id: str) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    active_session_id: str | None = None
    forward_task: asyncio.Task[None] | None = None
    await websocket.send_json(
        {"type": "ready", "message": "Send shell command to start session"}
    )

    async def forward_events(session_id: str) -> None:
        nonlocal active_session_id, forward_task
        queue = terminal_service.get_event_queue(session_id)
        while True:
            event = await queue.get()
            event_type = event.get("type")
            if event_type == "output":
                await websocket.send_json(
                    {"type": "output", "data": event.get("data", "")}
                )
            elif event_type == "error":
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": event.get("message", "Terminal operation failed"),
                    }
                )
            elif event_type == "closed":
                active_session_id = None
                forward_task = None
                await websocket.send_json({"type": "closed"})
                break

    try:
        while True:
            raw_message = await websocket.receive_text()
            payload = json.loads(raw_message)
            action = payload.get("action")

            if action == "start":
                if active_session_id:
                    terminal_service.close_session(active_session_id)
                    if forward_task:
                        await forward_task

                shell = payload.get("shell", "/bin/sh")
                cols = int(payload.get("cols", 80))
                rows = int(payload.get("rows", 24))
                try:
                    active_session_id = await terminal_service.create_session(
                        container_id,
                        shell,
                        cols,
                        rows,
                    )
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue

                forward_task = asyncio.create_task(forward_events(active_session_id))
                logger.info(
                    "Terminal session started: session=%s container=%s user=%s shell=%s",
                    active_session_id,
                    container_id,
                    user["username"],
                    shell,
                )
                await websocket.send_json(
                    {"type": "started", "sessionId": active_session_id}
                )

            elif action == "input" and active_session_id:
                try:
                    terminal_service.write(
                        active_session_id, str(payload.get("input", ""))
                    )
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})

            elif action == "resize" and active_session_id:
                try:
                    await terminal_service.resize(
                        active_session_id,
                        int(payload.get("cols", 80)),
                        int(payload.get("rows", 24)),
                    )
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})

            elif action == "close" and active_session_id:
                terminal_service.close_session(active_session_id)
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: terminal")
    finally:
        if active_session_id:
            terminal_service.close_session(active_session_id)
        if forward_task:
            await forward_task
