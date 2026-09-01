from __future__ import annotations

from docker.errors import APIError
from fastapi import APIRouter, Depends

from app import main
from app.dependencies import require_http_user
from app.models import CreateVolumeRequest
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/volumes", tags=["Volumes"])


@router.get("", summary="List Docker volumes")
async def list_volumes(_user: dict[str, str] = Depends(require_http_user)):
    try:
        docker_service = main.get_docker_service()
        volumes = await main.asyncio.to_thread(docker_service.list_volumes)
        return success_payload(volumes, {"count": len(volumes)})
    except Exception:
        logger.exception("Failed to list volumes")
        return error_response(500, "VOLUMES_LIST_FAILED", "Failed to list volumes")


@router.post("", summary="Create a Docker volume")
async def create_volume(
    payload: CreateVolumeRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        volume = await main.asyncio.to_thread(
            docker_service.create_volume,
            name=payload.name,
            driver=payload.driver,
            driver_opts=payload.driver_opts,
            labels=payload.labels,
        )
        return success_payload(volume)
    except APIError as exc:
        explanation = getattr(exc, "explanation", str(exc))
        logger.exception("Docker API error while creating volume")
        return error_response(
            500,
            "VOLUME_CREATE_FAILED",
            "Failed to create volume",
            {"message": explanation},
        )
    except Exception:
        logger.exception("Failed to create volume")
        return error_response(500, "VOLUME_CREATE_FAILED", "Failed to create volume")


@router.post("/prune", summary="Prune unused Docker volumes")
async def prune_volumes(_user: dict[str, str] = Depends(require_http_user)):
    try:
        docker_service = main.get_docker_service()
        report = await main.asyncio.to_thread(docker_service.prune_volumes)
        return success_payload(report)
    except Exception:
        logger.exception("Failed to prune volumes")
        return error_response(500, "VOLUMES_PRUNE_FAILED", "Failed to prune volumes")


@router.get("/{name}", summary="Inspect a Docker volume")
async def get_volume(
    name: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        volume = await main.asyncio.to_thread(docker_service.get_volume, name)
        return success_payload(volume)
    except Exception:
        logger.exception("Failed to get volume %s", name)
        return error_response(404, "VOLUME_NOT_FOUND", f"Volume {name} not found")


@router.delete("/{name}", summary="Remove a Docker volume")
async def remove_volume(
    name: str,
    force: bool = False,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        await main.asyncio.to_thread(docker_service.remove_volume, name, force=force)
        return success_payload({"name": name, "message": "Volume removed"})
    except APIError as exc:
        explanation = getattr(exc, "explanation", str(exc))
        logger.exception("Failed to remove volume %s", name)
        return error_response(
            400 if "in use" in explanation.lower() else 500,
            "VOLUME_REMOVE_FAILED",
            explanation,
        )
    except Exception:
        logger.exception("Failed to remove volume %s", name)
        return error_response(500, "VOLUME_REMOVE_FAILED", f"Failed to remove volume {name}")
