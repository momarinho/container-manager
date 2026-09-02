from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

from app.dependencies import require_http_user
from app.services.audit_service import AuditService
from app.services.docker_service import get_docker_service
from app.utils.logger import logger

# Métricas do Prometheus
HTTP_REQUESTS_TOTAL = Counter(
    "containermaster_http_requests_total",
    "Total de requisições HTTP recebidas pela API",
    ["method", "endpoint", "status"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "containermaster_http_request_duration_seconds",
    "Duração das requisições HTTP em segundos",
    ["method", "endpoint"],
)

CONTAINERS_COUNT = Gauge(
    "containermaster_containers_count",
    "Contagem atual de containers Docker por estado",
    ["state"],
)

AUDIT_EVENTS_TOTAL = Counter(
    "containermaster_audit_events_total",
    "Total de eventos operacionais registrados na trilha de auditoria",
    ["action", "status"],
)

metrics_router = APIRouter(tags=["Metrics & Observability"])
audit_router = APIRouter(prefix="/api/audit-logs", tags=["Audit Trail"])


@metrics_router.get("/metrics", summary="Prometheus Metrics Scrape Endpoint")
def get_prometheus_metrics() -> Response:
    """Endpoint aberto para coleta periódica pelo Prometheus."""
    try:
        docker_svc = get_docker_service()
        containers = docker_svc.list_containers(all_containers=True)
        running_count = sum(1 for c in containers if c.get("state") == "running")
        total_count = len(containers)
        stopped_count = total_count - running_count

        CONTAINERS_COUNT.labels(state="running").set(running_count)
        CONTAINERS_COUNT.labels(state="stopped").set(stopped_count)
        CONTAINERS_COUNT.labels(state="total").set(total_count)
    except Exception as e:
        logger.warning(f"Unable to update Prometheus container metrics: {e}")

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@audit_router.get("", summary="Listar trilha de auditoria")
async def list_audit_trail(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    _user: dict[str, str] = Depends(require_http_user),
) -> dict[str, Any]:
    """Retorna os logs de auditoria ordenados do mais recente para o mais antigo."""
    logs = await AuditService.list_audit_logs(
        limit=limit,
        offset=offset,
        action=action,
        resource_type=resource_type,
    )
    return {
        "success": True,
        "data": logs,
        "total": len(logs),
        "limit": limit,
        "offset": offset,
    }
