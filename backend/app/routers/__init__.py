from __future__ import annotations

from app.routers.auth import router as auth_router
from app.routers.containers import router as containers_router
from app.routers.health import router as health_router
from app.routers.system import router as system_router
from app.routers.tunnel import router as tunnel_router
from app.routers.users import router as users_router
from app.routers.websockets import router as websockets_router

__all__ = [
    "auth_router",
    "containers_router",
    "health_router",
    "system_router",
    "tunnel_router",
    "users_router",
    "websockets_router",
]
