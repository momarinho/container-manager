from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_http_user
from app.models import DeployStackRequest
from app.services.stack_service import get_stack_service
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/stacks", tags=["Stacks"])


@router.get("", summary="List all Docker Compose stacks")
async def list_stacks(_user: dict[str, str] = Depends(require_http_user)):
    try:
        service = get_stack_service()
        stacks = await asyncio.to_thread(service.list_stacks)
        return success_payload(stacks, {"count": len(stacks)})
    except Exception as exc:
        logger.exception("Failed to list stacks")
        return error_response(500, "STACKS_LIST_FAILED", str(exc))


@router.post("", summary="Deploy or update a Docker Compose stack")
async def deploy_stack(
    payload: DeployStackRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        service = get_stack_service()
        result = await asyncio.to_thread(
            service.deploy_stack,
            payload.name,
            payload.compose_yaml,
            payload.env_vars,
        )
        return success_payload(result)
    except ValueError as exc:
        return error_response(400, "STACK_DEPLOY_INVALID", str(exc))
    except Exception as exc:
        logger.exception("Failed to deploy stack %s", payload.name)
        return error_response(500, "STACK_DEPLOY_FAILED", str(exc))


@router.get("/{name}", summary="Get stack details")
async def get_stack(name: str, _user: dict[str, str] = Depends(require_http_user)):
    try:
        service = get_stack_service()
        stack = await asyncio.to_thread(service.get_stack, name)
        return success_payload(stack)
    except ValueError as exc:
        return error_response(404, "STACK_NOT_FOUND", str(exc))
    except Exception as exc:
        logger.exception("Failed to get stack %s", name)
        return error_response(500, "STACK_GET_FAILED", str(exc))


@router.get("/{name}/compose", summary="Get original compose YAML")
async def get_stack_compose(name: str, _user: dict[str, str] = Depends(require_http_user)):
    try:
        service = get_stack_service()
        yaml_content = await asyncio.to_thread(service.get_stack_compose, name)
        if yaml_content is None:
            return error_response(
                404, "STACK_COMPOSE_NOT_FOUND", f"No compose file found for stack '{name}'"
            )
        return success_payload({"name": name, "composeYaml": yaml_content})
    except Exception as exc:
        logger.exception("Failed to get compose file for stack %s", name)
        return error_response(500, "STACK_COMPOSE_FAILED", str(exc))


@router.post("/{name}/up", summary="Start stack services")
async def up_stack(name: str, _user: dict[str, str] = Depends(require_http_user)):
    try:
        service = get_stack_service()
        result = await asyncio.to_thread(service.up_stack, name)
        return success_payload(result)
    except ValueError as exc:
        return error_response(400, "STACK_UP_FAILED", str(exc))
    except Exception as exc:
        logger.exception("Failed to start stack %s", name)
        return error_response(500, "STACK_UP_FAILED", str(exc))


@router.post("/{name}/down", summary="Stop and down stack services")
async def down_stack(name: str, _user: dict[str, str] = Depends(require_http_user)):
    try:
        service = get_stack_service()
        result = await asyncio.to_thread(service.down_stack, name)
        return success_payload(result)
    except ValueError as exc:
        return error_response(400, "STACK_DOWN_FAILED", str(exc))
    except Exception as exc:
        logger.exception("Failed to stop stack %s", name)
        return error_response(500, "STACK_DOWN_FAILED", str(exc))


@router.delete("/{name}", summary="Delete stack and remove files")
async def delete_stack(name: str, _user: dict[str, str] = Depends(require_http_user)):
    try:
        service = get_stack_service()
        result = await asyncio.to_thread(service.delete_stack, name)
        return success_payload(result)
    except Exception as exc:
        logger.exception("Failed to delete stack %s", name)
        return error_response(500, "STACK_DELETE_FAILED", str(exc))


@router.get("/{name}/logs", summary="Get aggregated logs for all stack services")
async def get_stack_logs(
    name: str,
    tail: int = Query(default=100, ge=1, le=1000),
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        service = get_stack_service()
        logs = await asyncio.to_thread(service.get_stack_logs, name, tail)
        return success_payload({"name": name, "logs": logs})
    except Exception as exc:
        logger.exception("Failed to get logs for stack %s", name)
        return error_response(500, "STACK_LOGS_FAILED", str(exc))
