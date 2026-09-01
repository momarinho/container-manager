from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Request

from app.config import config
from app.security import utc_timestamp
from app.utils.http import success_payload

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Healthcheck")
async def health(request: Request) -> dict[str, Any]:
    started_at = getattr(request.app.state, "started_at", time.monotonic())
    return success_payload(
        {
            "status": "ok",
            "timestamp": utc_timestamp(),
            "uptime": time.monotonic() - started_at,
            "service": config.app_name,
            "environment": config.node_env,
            "version": config.app_version,
            "commitSha": config.app_commit_sha,
        }
    )
