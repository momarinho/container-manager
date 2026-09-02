from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_http_user
from app.models import PullImageRequest
from app.services.docker_service import get_docker_service
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/images", tags=["Images"])


@router.get("", summary="List local Docker images")
async def list_images(_user: dict[str, str] = Depends(require_http_user)):
    try:
        docker_service = get_docker_service()
        images = await asyncio.to_thread(docker_service.list_images)
        return success_payload(images, {"count": len(images)})
    except Exception as exc:
        logger.exception("Failed to list images")
        return error_response(500, "IMAGES_LIST_FAILED", str(exc))


@router.get("/search", summary="Search public Docker Hub images")
async def search_images(
    query: str = Query(min_length=1),
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = get_docker_service()
        results = await asyncio.to_thread(docker_service.search_hub_images, query)
        return success_payload(results, {"count": len(results)})
    except Exception as exc:
        logger.exception("Failed to search Docker Hub images for %s", query)
        return error_response(500, "IMAGE_SEARCH_FAILED", str(exc))


@router.post("/pull", summary="Pull a Docker image")
async def pull_image(
    payload: PullImageRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = get_docker_service()
        result = await asyncio.to_thread(docker_service.pull_image, payload.image)
        return success_payload(result)
    except Exception as exc:
        logger.exception("Failed to pull image %s", payload.image)
        return error_response(500, "IMAGE_PULL_FAILED", str(exc))


@router.delete("/{image_id:path}", summary="Remove a Docker image")
async def remove_image(
    image_id: str,
    force: bool = Query(default=False),
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = get_docker_service()
        result = await asyncio.to_thread(docker_service.remove_image, image_id, force)
        return success_payload(result)
    except Exception as exc:
        logger.exception("Failed to remove image %s", image_id)
        return error_response(500, "IMAGE_REMOVE_FAILED", str(exc))
