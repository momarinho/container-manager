from __future__ import annotations

from fastapi import Request, WebSocket

from app.security import get_bearer_token, verify_jwt
from app.services.docker_service import get_docker_service
from app.services.system_stats import SystemStatsService
from app.services.terminal_service import TerminalService
from app.services.tunnel_service import TunnelService
from app.utils.errors import AppError
from app.utils.logger import logger

# Instâncias de serviços compartilhados (singletons do runtime da aplicação)
system_stats_service = SystemStatsService(get_docker_service)
terminal_service = TerminalService(get_docker_service)
tunnel_service = TunnelService()


def require_http_user(request: Request) -> dict[str, str]:
    """Dependency que valida o Bearer Token JWT e retorna o payload do usuário."""
    token = get_bearer_token(request.headers.get("Authorization"))
    if not token:
        raise AppError(401, "AUTH_TOKEN_MISSING", "Missing token")

    try:
        payload = verify_jwt(token)
        return {
            "id": str(payload["userId"]),
            "username": str(payload["username"]),
        }
    except (KeyError, ValueError) as exc:
        raise AppError(401, "AUTH_TOKEN_INVALID", "Invalid or expired token") from exc


async def authenticate_websocket(websocket: WebSocket) -> dict[str, str] | None:
    """Valida o token JWT passado na query param do WebSocket connection handshake."""
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token:
        await websocket.send_json({"type": "error", "message": "Authentication required"})
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
