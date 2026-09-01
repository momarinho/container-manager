from __future__ import annotations

from fastapi import APIRouter, Depends

from app import main
from app.dependencies import require_http_user
from app.models import TunnelConnectRequest
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/tunnel", tags=["Tunnel"])


@router.get("/status", summary="Get tunnel status")
async def get_tunnel_status(_user: dict[str, str] = Depends(require_http_user)):
    try:
        status = await main.tunnel_service.refresh()
        return success_payload(status)
    except Exception:
        logger.exception("Failed to get tunnel status")
        return error_response(500, "TUNNEL_STATUS_FAILED", "Failed to get tunnel status")


@router.post("/connect", summary="Connect tunnel provider")
async def connect_tunnel(
    payload: TunnelConnectRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    if payload.provider != "tailscale":
        return error_response(
            400,
            "TUNNEL_PROVIDER_UNSUPPORTED",
            "Only tailscale is supported in sprint 1",
        )

    try:
        status = await main.tunnel_service.connect(payload.auth_key, payload.hostname)
        return success_payload(status)
    except Exception:
        logger.exception("Failed to connect tunnel")
        return error_response(500, "TUNNEL_CONNECT_FAILED", "Failed to connect tunnel")


@router.post("/disconnect", summary="Disconnect tunnel")
async def disconnect_tunnel(_user: dict[str, str] = Depends(require_http_user)):
    try:
        status = await main.tunnel_service.disconnect()
        return success_payload(status)
    except Exception:
        logger.exception("Failed to disconnect tunnel")
        return error_response(500, "TUNNEL_DISCONNECT_FAILED", "Failed to disconnect tunnel")
