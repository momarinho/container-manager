from __future__ import annotations

from typing import Any

from docker.errors import APIError
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app import main
from app.dependencies import require_http_user
from app.models import CreateContainerRequest, ExecRequest, ValidateImageRequest
from app.routers.metrics import AUDIT_EVENTS_TOTAL
from app.services.audit_service import AuditService
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/containers", tags=["Containers"])


@router.get("", summary="List containers")
async def list_containers(
    _user: dict[str, str] = Depends(require_http_user),
    all: bool = False,
    status: str | None = None,
    name: str | None = None,
):
    try:
        docker_service = main.get_docker_service()
        containers = await main.asyncio.to_thread(docker_service.list_containers, all)
        if status:
            containers = [container for container in containers if container["state"] == status]
        if name:
            needle = name.lower()
            containers = [
                container
                for container in containers
                if any(needle in container_name.lower() for container_name in container["names"])
                or needle in container["image"].lower()
            ]
        return success_payload(containers, {"count": len(containers)})
    except Exception:
        logger.exception("Failed to list containers")
        return error_response(500, "CONTAINERS_LIST_FAILED", "Failed to list containers")


@router.post("/validate-image", summary="Validate container image availability")
async def validate_container_image(
    payload: ValidateImageRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        result = await main.asyncio.to_thread(docker_service.validate_image, payload.image)
        return success_payload(result)
    except ValueError as exc:
        return error_response(400, "IMAGE_VALIDATION_FAILED", str(exc))
    except Exception:
        logger.exception("Failed to validate image %s", payload.image)
        return error_response(500, "IMAGE_VALIDATION_FAILED", "Failed to validate image")


@router.post("", summary="Create container")
async def create_container(
    payload: CreateContainerRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        created = await main.asyncio.to_thread(
            docker_service.create_container,
            payload.model_dump(by_alias=True),
        )
        await AuditService.log_action(
            user_id=_user.get("id", "unknown"),
            username=_user.get("username", "unknown"),
            action="CONTAINER_CREATE",
            resource_type="container",
            resource_id=str(created.get("id", payload.name or "unknown")),
            details=f"image={payload.image} name={payload.name}",
            status="SUCCESS",
        )
        AUDIT_EVENTS_TOTAL.labels(action="CONTAINER_CREATE", status="SUCCESS").inc()
        return success_payload(created)
    except ValueError as exc:
        return error_response(400, "CONTAINER_CREATE_INVALID", str(exc))
    except APIError as exc:
        explanation = getattr(exc, "explanation", None)
        details = {"message": explanation} if explanation else None
        logger.exception("Docker API failed while creating container")
        return error_response(
            500,
            "CONTAINER_CREATE_FAILED",
            "Failed to create container",
            details,
        )
    except Exception:
        logger.exception("Failed to create container")
        return error_response(500, "CONTAINER_CREATE_FAILED", "Failed to create container")


@router.get("/{container_id}", summary="Get container")
async def get_container(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        container = await main.asyncio.to_thread(docker_service.get_container, container_id)
        return success_payload(container)
    except Exception:
        logger.exception("Failed to get container %s", container_id)
        return error_response(500, "CONTAINER_GET_FAILED", "Failed to get container")


async def _container_action(
    container_id: str,
    method_name: str,
    code: str,
    message: str,
    error_message: str,
    user: dict[str, str] | None = None,
    action_name: str | None = None,
) -> JSONResponse | dict[str, Any]:
    try:
        docker_service = main.get_docker_service()
        action = getattr(docker_service, method_name)
        await main.asyncio.to_thread(action, container_id)
        if user:
            act = action_name or f"CONTAINER_{method_name.replace('_container', '').upper()}"
            await AuditService.log_action(
                user_id=user.get("id", "unknown"),
                username=user.get("username", "unknown"),
                action=act,
                resource_type="container",
                resource_id=container_id,
                details=message,
                status="SUCCESS",
            )
            AUDIT_EVENTS_TOTAL.labels(action=act, status="SUCCESS").inc()
        return success_payload({"id": container_id, "message": message})
    except Exception:
        logger.exception("Failed container action %s on %s", method_name, container_id)
        if user:
            act = action_name or f"CONTAINER_{method_name.replace('_container', '').upper()}"
            await AuditService.log_action(
                user_id=user.get("id", "unknown"),
                username=user.get("username", "unknown"),
                action=act,
                resource_type="container",
                resource_id=container_id,
                details=error_message,
                status="FAILED",
            )
            AUDIT_EVENTS_TOTAL.labels(action=act, status="FAILED").inc()
        return error_response(500, code, error_message)


@router.post("/{container_id}/start", summary="Start container")
async def start_container(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    return await _container_action(
        container_id,
        "start_container",
        "CONTAINER_START_FAILED",
        "Container started",
        "Failed to start container",
        user=_user,
        action_name="CONTAINER_START",
    )


@router.post("/{container_id}/stop", summary="Stop container")
async def stop_container(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    return await _container_action(
        container_id,
        "stop_container",
        "CONTAINER_STOP_FAILED",
        "Container stopped",
        "Failed to stop container",
        user=_user,
        action_name="CONTAINER_STOP",
    )


@router.post("/{container_id}/restart", summary="Restart container")
async def restart_container(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    return await _container_action(
        container_id,
        "restart_container",
        "CONTAINER_RESTART_FAILED",
        "Container restarted",
        "Failed to restart container",
        user=_user,
        action_name="CONTAINER_RESTART",
    )


@router.post("/{container_id}/pause", summary="Pause container")
async def pause_container(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    return await _container_action(
        container_id,
        "pause_container",
        "CONTAINER_PAUSE_FAILED",
        "Container paused",
        "Failed to pause container",
        user=_user,
        action_name="CONTAINER_PAUSE",
    )


@router.post("/{container_id}/unpause", summary="Unpause container")
async def unpause_container(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    return await _container_action(
        container_id,
        "unpause_container",
        "CONTAINER_UNPAUSE_FAILED",
        "Container unpaused",
        "Failed to unpause container",
        user=_user,
        action_name="CONTAINER_UNPAUSE",
    )


@router.delete("/{container_id}", summary="Remove container")
async def remove_container(
    container_id: str,
    force: bool = False,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        await main.asyncio.to_thread(docker_service.remove_container, container_id, force)
        await AuditService.log_action(
            user_id=_user.get("id", "unknown"),
            username=_user.get("username", "unknown"),
            action="CONTAINER_DELETE",
            resource_type="container",
            resource_id=container_id,
            details=f"force={force}",
            status="SUCCESS",
        )
        AUDIT_EVENTS_TOTAL.labels(action="CONTAINER_DELETE", status="SUCCESS").inc()
        return success_payload({"id": container_id, "message": "Container removed"})
    except Exception:
        logger.exception("Failed to remove container %s", container_id)
        return error_response(500, "CONTAINER_REMOVE_FAILED", "Failed to remove container")


@router.get("/{container_id}/stats", summary="Get container runtime stats")
async def get_container_stats(
    container_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        container_state = await main.asyncio.to_thread(
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

        stats = await main.asyncio.to_thread(docker_service.get_container_stats, container_id)
        return success_payload(stats)
    except Exception:
        logger.exception("Failed to get stats for container %s", container_id)
        return error_response(500, "CONTAINER_STATS_FAILED", "Failed to get container stats")


@router.post("/{container_id}/exec", summary="Execute command in container")
async def exec_in_container(
    container_id: str,
    payload: ExecRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    if not payload.cmd:
        return error_response(400, "INVALID_EXEC_COMMAND", "cmd is required and must be an array")

    try:
        docker_service = main.get_docker_service()
        result = await main.asyncio.to_thread(
            docker_service.exec_in_container,
            container_id,
            payload.cmd,
            payload.env,
        )
        cmd_str = " ".join(payload.cmd)
        await AuditService.log_action(
            user_id=_user.get("id", "unknown"),
            username=_user.get("username", "unknown"),
            action="CONTAINER_EXEC",
            resource_type="container",
            resource_id=container_id,
            details=f"cmd={cmd_str}",
            status="SUCCESS",
        )
        AUDIT_EVENTS_TOTAL.labels(action="CONTAINER_EXEC", status="SUCCESS").inc()
        return success_payload(result)
    except Exception:
        logger.exception("Failed to exec in container %s", container_id)
        return error_response(500, "CONTAINER_EXEC_FAILED", "Failed to execute command")
