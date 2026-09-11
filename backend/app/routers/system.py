from __future__ import annotations

from fastapi import APIRouter, Depends

from app import main
from app.dependencies import require_http_user
from app.models import PruneRequest
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


@router.post("/prune", summary="Prune unused Docker resources")
async def prune_system(
    payload: PruneRequest = PruneRequest(),
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        report = await main.asyncio.to_thread(
            docker_service.prune_system,
            containers=payload.containers,
            images=payload.images,
            volumes=payload.volumes,
            networks=payload.networks,
        )
        return success_payload(report)
    except Exception:
        logger.exception("Failed to prune system resources")
        return error_response(500, "SYSTEM_PRUNE_FAILED", "Failed to prune system resources")

