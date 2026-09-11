from __future__ import annotations

import os
from typing import Any

import httpx

from app.utils.logger import logger


class MetricsClient:
    """Async HTTP client to consume real-time telemetry from the Go metrics agent."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (
            base_url or os.getenv("METRICS_AGENT_URL") or "http://localhost:9090"
        ).rstrip("/")

    async def get_container_metrics(self) -> list[dict[str, Any]]:
        """
        Fetches the latest container metrics snapshot from the Go agent.
        Returns an empty list if the agent is offline (graceful fallback).
        """
        url = f"{self.base_url}/metrics"

        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    payload = response.json()
                    return payload.get("data", [])

                logger.warning(f"Metrics agent returned unexpected status {response.status_code}")
                return []
        except httpx.RequestError as exc:
            logger.debug(f"Metrics agent unreachable at {url}: {exc}")
            return []
