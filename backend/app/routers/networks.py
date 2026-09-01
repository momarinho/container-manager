from __future__ import annotations

from docker.errors import APIError
from fastapi import APIRouter, Depends

from app import main
from app.dependencies import require_http_user
from app.models import ConnectNetworkRequest, CreateNetworkRequest, DisconnectNetworkRequest
from app.utils.http import error_response, success_payload
from app.utils.logger import logger

router = APIRouter(prefix="/api/networks", tags=["Networks"])


@router.get("", summary="List Docker networks")
async def list_networks(_user: dict[str, str] = Depends(require_http_user)):
    try:
        docker_service = main.get_docker_service()
        networks = await main.asyncio.to_thread(docker_service.list_networks)
        return success_payload(networks, {"count": len(networks)})
    except Exception:
        logger.exception("Failed to list networks")
        return error_response(500, "NETWORKS_LIST_FAILED", "Failed to list networks")


@router.post("", summary="Create a Docker network")
async def create_network(
    payload: CreateNetworkRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        network = await main.asyncio.to_thread(
            docker_service.create_network,
            name=payload.name,
            driver=payload.driver,
            internal=payload.internal,
            attachable=payload.attachable,
            labels=payload.labels,
            subnet=payload.subnet,
            gateway=payload.gateway,
        )
        return success_payload(network)
    except APIError as exc:
        explanation = getattr(exc, "explanation", str(exc))
        logger.exception("Docker API error while creating network")
        return error_response(
            500,
            "NETWORK_CREATE_FAILED",
            "Failed to create network",
            {"message": explanation},
        )
    except Exception:
        logger.exception("Failed to create network")
        return error_response(500, "NETWORK_CREATE_FAILED", "Failed to create network")


@router.post("/prune", summary="Prune unused Docker networks")
async def prune_networks(_user: dict[str, str] = Depends(require_http_user)):
    try:
        docker_service = main.get_docker_service()
        report = await main.asyncio.to_thread(docker_service.prune_networks)
        return success_payload(report)
    except Exception:
        logger.exception("Failed to prune networks")
        return error_response(500, "NETWORKS_PRUNE_FAILED", "Failed to prune networks")


@router.get("/{network_id}", summary="Inspect a Docker network")
async def get_network(
    network_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        network = await main.asyncio.to_thread(docker_service.get_network, network_id)
        return success_payload(network)
    except Exception:
        logger.exception("Failed to get network %s", network_id)
        return error_response(404, "NETWORK_NOT_FOUND", f"Network {network_id} not found")


@router.delete("/{network_id}", summary="Remove a Docker network")
async def remove_network(
    network_id: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        await main.asyncio.to_thread(docker_service.remove_network, network_id)
        return success_payload({"id": network_id, "message": "Network removed"})
    except APIError as exc:
        explanation = getattr(exc, "explanation", str(exc))
        logger.exception("Failed to remove network %s", network_id)
        return error_response(
            400 if "active endpoints" in explanation.lower() else 500,
            "NETWORK_REMOVE_FAILED",
            explanation,
        )
    except Exception:
        logger.exception("Failed to remove network %s", network_id)
        return error_response(
            500, "NETWORK_REMOVE_FAILED", f"Failed to remove network {network_id}"
        )


@router.post("/{network_id}/connect", summary="Connect a container to a network")
async def connect_network(
    network_id: str,
    payload: ConnectNetworkRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        await main.asyncio.to_thread(
            docker_service.connect_network,
            network_id=network_id,
            container_id=payload.container_id,
            ipv4_address=payload.ipv4_address,
        )
        return success_payload(
            {"connected": True, "networkId": network_id, "containerId": payload.container_id}
        )
    except Exception as exc:
        logger.exception(
            "Failed to connect container %s to network %s", payload.container_id, network_id
        )
        return error_response(500, "NETWORK_CONNECT_FAILED", str(exc))


@router.post("/{network_id}/disconnect", summary="Disconnect a container from a network")
async def disconnect_network(
    network_id: str,
    payload: DisconnectNetworkRequest,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        docker_service = main.get_docker_service()
        await main.asyncio.to_thread(
            docker_service.disconnect_network,
            network_id=network_id,
            container_id=payload.container_id,
            force=payload.force,
        )
        return success_payload(
            {"disconnected": True, "networkId": network_id, "containerId": payload.container_id}
        )
    except Exception as exc:
        logger.exception(
            "Failed to disconnect container %s from network %s", payload.container_id, network_id
        )
        return error_response(500, "NETWORK_DISCONNECT_FAILED", str(exc))
