from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


@dataclass(frozen=True)
class AppConfig:
    host: str
    port: int
    node_env: str
    log_level: str
    jwt_secret: str
    jwt_expires_in: str
    api_tokens: tuple[str, ...]
    cors_origin: str
    docker_socket_path: str
    ws_ping_interval: int
    ws_ping_timeout: int
    rate_limit_window_ms: int
    rate_limit_max_requests: int
    stats_update_interval: int
    stats_history_size: int
    log_buffer_size: int
    log_flush_interval: int
    terminal_idle_timeout: int
    terminal_max_sessions: int


def load_config() -> AppConfig:
    jwt_secret = os.getenv("JWT_SECRET", "your_secret_key")
    if len(jwt_secret) < 32:
        raise ValueError("JWT_SECRET must be at least 32 characters")

    api_tokens = tuple(
        token.strip()
        for token in os.getenv("API_TOKENS", "").split(",")
        if token.strip()
    )

    return AppConfig(
        host=os.getenv("HOST", "0.0.0.0"),
        port=_get_int("PORT", 3000),
        node_env=os.getenv("NODE_ENV", "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        jwt_secret=jwt_secret,
        jwt_expires_in=os.getenv("JWT_EXPIRES_IN", "24h"),
        api_tokens=api_tokens,
        cors_origin=os.getenv("CORS_ORIGIN", "*"),
        docker_socket_path=os.getenv("DOCKER_SOCKET_PATH", "/var/run/docker.sock"),
        ws_ping_interval=_get_int("WS_PING_INTERVAL", 30000),
        ws_ping_timeout=_get_int("WS_PING_TIMEOUT", 5000),
        rate_limit_window_ms=_get_int("RATE_LIMIT_WINDOW_MS", 60000),
        rate_limit_max_requests=_get_int("RATE_LIMIT_MAX_REQUESTS", 100),
        stats_update_interval=_get_int("STATS_UPDATE_INTERVAL", 5000),
        stats_history_size=_get_int("STATS_HISTORY_SIZE", 100),
        log_buffer_size=_get_int("LOG_BUFFER_SIZE", 100),
        log_flush_interval=_get_int("LOG_FLUSH_INTERVAL", 100),
        terminal_idle_timeout=_get_int("TERMINAL_IDLE_TIMEOUT", 600000),
        terminal_max_sessions=_get_int("TERMINAL_MAX_SESSIONS", 10),
    )


config = load_config()
