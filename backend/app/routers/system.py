from __future__ import annotations

from fastapi import APIRouter, Depends

from app import main
from app.dependencies import require_http_user
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get("/stats", summary="Get current system stats")
async def get_stats(_user: dict[str, str] = Depends(require_http_user)):
    return success_payload(main.system_stats_service.get_current_stats())


@router.get("/stats/history", summary="Get system stats history")
async def get_stats_history(
    limit: int | None = None,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        history = main.system_stats_service.get_history(limit)
        return success_payload(history)
    except Exception:
        logger.exception("Failed to get stats history")
        return error_response(500, "SYSTEM_STATS_HISTORY_FAILED", "Failed to get stats history")


@router.get("/info", summary="Get host system information")
async def get_system_info(_user: dict[str, str] = Depends(require_http_user)):
    try:
        info = await main.system_stats_service.get_system_info()
        return success_payload(info)
    except Exception:
        logger.exception("Failed to get system info")
        return error_response(500, "SYSTEM_INFO_FAILED", "Failed to get system info")
