from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from threading import Lock
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import config
from app.database import db_manager
from app.dependencies import (
    authenticate_websocket,
    get_docker_service,
    require_http_user,
    system_stats_service,
    terminal_service,
    tunnel_service,
)
from app.routers import (
    auth_router,
    containers_router,
    health_router,
    system_router,
    tunnel_router,
    users_router,
    websockets_router,
)
from app.utils.errors import AppError
from app.utils.http import error_response
from app.utils.logger import logger

API_TAGS = [
    {"name": "Health", "description": "Healthcheck and uptime information."},
    {"name": "Auth", "description": "Authentication and token validation endpoints."},
    {"name": "Users", "description": "Dynamic user management and credentials."},
    {
        "name": "Containers",
        "description": "Container lifecycle and execution operations.",
    },
    {"name": "System", "description": "Host system metrics and runtime information."},
    {"name": "Tunnel", "description": "Tunnel provider status and control endpoints."},
    {
        "name": "WebSockets",
        "description": "Real-time channels for stats, logs, tunnel and terminal.",
    },
]


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Gerenciamento moderno do ciclo de vida da aplicação (startup e shutdown)."""
    db_manager.init_db()
    application.state.started_at = time.monotonic()
    system_stats_service.start()
    terminal_service.start()
    tunnel_service.start()
    logger.info(
        "ContainerMaster Python backend started on %s:%s",
        config.host,
        config.port,
        extra={
            "service": config.app_name,
            "version": config.app_version,
            "commit_sha": config.app_commit_sha,
        },
    )

    yield

    await terminal_service.stop()
    await system_stats_service.stop()
    await tunnel_service.stop()


app = FastAPI(
    title=config.app_name,
    version=config.app_version,
    description="REST and WebSocket API for authentication, Docker container management, "
    "system monitoring and tunnel status.",
    docs_url="/docs",
    redoc_url=None,
    openapi_tags=API_TAGS,
    lifespan=lifespan,
)

# Configuração de CORS
is_wildcard = config.cors_origin.strip() == "*"
allowed_origins = (
    ["*"]
    if is_wildcard
    else [origin.strip() for origin in config.cors_origin.split(",") if origin.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InMemoryRateLimiter:
    def __init__(self, window_ms: int, max_requests: int) -> None:
        self.window_seconds = window_ms / 1000
        self.max_requests = max_requests
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    async def check(self, key: str) -> bool:
        now = time.monotonic()
        with self.lock:
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


@app.middleware("http")
async def log_and_rate_limit_requests(request: Request, call_next: Any) -> Response:
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    client_ip = request.client.host if request.client else "unknown"
    allowed = await rate_limiter.check(client_ip)
    if not allowed:
        response = error_response(
            429,
            "RATE_LIMIT_EXCEEDED",
            "Too many requests",
            {"retryAfter": round(config.rate_limit_window_ms / 1000)},
        )
        response.headers["X-Request-ID"] = request_id
        logger.warning(
            "Rate limit exceeded for IP %s",
            client_ip,
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": 429,
                "duration_ms": 0,
                "client_ip": client_ip,
                "service": config.app_name,
                "version": config.app_version,
                "commit_sha": config.app_commit_sha,
            },
        )
        return response

    started_at = time.monotonic()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id

    if config.enable_access_logs:
        logger.info(
            "%s %s -> %s",
            request.method,
            request.url.path,
            response.status_code,
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
                "client_ip": client_ip,
                "service": config.app_name,
                "version": config.app_version,
                "commit_sha": config.app_commit_sha,
            },
        )

    return response


# Handlers de Exceção Centralizados
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return error_response(400, "VALIDATION_ERROR", "Validation error", exc.errors())


@app.exception_handler(AppError)
async def app_exception_handler(_request: Request, exc: AppError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message, exc.details)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code == 404:
        return error_response(404, "NOT_FOUND", "Not found", {"path": request.url.path})
    return error_response(
        exc.status_code,
        "HTTP_ERROR",
        exc.detail if isinstance(exc.detail, str) else "HTTP error",
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    details = {"message": str(exc)} if config.node_env == "development" else None
    return error_response(500, "INTERNAL_SERVER_ERROR", "Internal server error", details)


# Inclusão dos Roteadores Modularizados
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(containers_router)
app.include_router(system_router)
app.include_router(tunnel_router)
app.include_router(users_router)
app.include_router(websockets_router)

# Exportações para compatibilidade retroativa com suítes de teste e módulos
__all__ = [
    "app",
    "asyncio",
    "authenticate_websocket",
    "get_docker_service",
    "rate_limiter",
    "require_http_user",
    "system_stats_service",
    "terminal_service",
    "tunnel_service",
]
