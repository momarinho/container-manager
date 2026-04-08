from __future__ import annotations

import asyncio
import json
import subprocess
import time
from typing import Any

from app.config import config


class TunnelService:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._last_status: dict[str, Any] = self._read_status_sync()

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        queue.put_nowait(self._last_status)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    def _run_tailscale(self, *args: str) -> str:
        result = subprocess.run(
            [config.tailscale_cli_path, *args],
            capture_output=True,
            text=True,
            timeout=20,
            check=True,
        )
        return result.stdout.strip()

    def _map_state(self, backend_state: str) -> str:
        if backend_state == "Running":
            return "connected"
        if backend_state in {"NeedsLogin", "NeedsMachineAuth"}:
            return "needs_login"
        if backend_state in {"Starting", "NoState"}:
            return "connecting"
        return "disconnected"

    def _read_status_sync(self) -> dict[str, Any]:
        try:
            payload = json.loads(self._run_tailscale("status", "--json"))
            self_node = payload.get("Self") or {}
            ips = self_node.get("TailscaleIPs") or []
            backend_state = payload.get("BackendState", "NoState")
            state = self._map_state(backend_state)

            return {
                "provider": "tailscale",
                "state": state,
                "connected": state == "connected",
                "needsLogin": state == "needs_login",
                "backendState": backend_state,
                "hostname": self_node.get("HostName"),
                "magicDnsName": self_node.get("DNSName"),
                "tailnet": payload.get("MagicDNSSuffix"),
                "ip": ips[0] if ips else None,
                "health": payload.get("Health") or [],
                "updatedAt": int(time.time() * 1000),
            }
        except Exception as exc:
            return {
                "provider": "tailscale",
                "state": "error",
                "connected": False,
                "needsLogin": False,
                "backendState": "Error",
                "hostname": None,
                "magicDnsName": None,
                "tailnet": None,
                "ip": None,
                "health": [str(exc)],
                "updatedAt": int(time.time() * 1000),
            }

    async def refresh(self) -> dict[str, Any]:
        self._last_status = await asyncio.to_thread(self._read_status_sync)
        for queue in list(self._subscribers):
            queue.put_nowait(self._last_status)
        return self._last_status

    async def connect(
        self, auth_key: str | None, hostname: str | None
    ) -> dict[str, Any]:
        args = [
            "up",
            f"--hostname={hostname or config.tailscale_hostname}",
            f"--accept-dns={'true' if config.tailscale_accept_dns else 'false'}",
            f"--accept-routes={'true' if config.tailscale_accept_routes else 'false'}",
        ]

        effective_key = auth_key or config.tailscale_auth_key
        if effective_key:
            args.append(f"--auth-key={effective_key}")

        if config.tailscale_advertise_tags:
            args.append(f"--advertise-tags={','.join(config.tailscale_advertise_tags)}")

        await asyncio.to_thread(self._run_tailscale, *args)
        return await self.refresh()

    async def disconnect(self) -> dict[str, Any]:
        await asyncio.to_thread(self._run_tailscale, "down")
        return await self.refresh()

    async def _poll_loop(self) -> None:
        while True:
            await self.refresh()
            await asyncio.sleep(config.tunnel_status_poll_interval / 1000)
