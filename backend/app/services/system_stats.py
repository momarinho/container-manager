from __future__ import annotations

import asyncio
import platform
import time
from collections import deque
from typing import Any

import psutil

from app.config import config
from app.services.docker_service import DockerService
from app.utils.logger import logger


class SystemStatsService:
    def __init__(self, docker_service: DockerService) -> None:
        self.docker_service = docker_service
        self.history: deque[dict[str, Any]] = deque(maxlen=config.stats_history_size)
        self.current_stats: dict[str, Any] = self._empty_stats()
        self.subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="system-stats-updater")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def get_current_stats(self) -> dict[str, Any]:
        return self.current_stats

    def get_history(self, limit: int | None = None) -> list[dict[str, Any]]:
        history = list(self.history)
        if limit is None:
            return history
        return history[-limit:]

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self.subscribers.discard(queue)

    async def get_system_info(self) -> dict[str, Any]:
        return await asyncio.to_thread(self._collect_system_info)

    async def _run(self) -> None:
        await self._update_stats()
        while True:
            await asyncio.sleep(config.stats_update_interval / 1000)
            await self._update_stats()

    async def _update_stats(self) -> None:
        try:
            stats = await asyncio.to_thread(self._collect_stats)
            self.current_stats = stats
            self.history.append(stats)
            for queue in tuple(self.subscribers):
                if queue.full():
                    continue
                queue.put_nowait(stats)
        except Exception:
            logger.exception("Failed to update system stats")

    def _collect_stats(self) -> dict[str, Any]:
        cpu = round(psutil.cpu_percent(interval=None), 2)
        per_cpu = [round(value, 2) for value in psutil.cpu_percent(interval=None, percpu=True)]
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        containers = self.docker_service.list_containers(all_containers=True)

        return {
            "cpu": cpu,
            "memory": round(memory.percent, 2),
            "memoryUsed": self._format_bytes(memory.used),
            "memoryTotal": self._format_bytes(memory.total),
            "disk": round(disk.percent, 2),
            "diskUsed": self._format_bytes(disk.used),
            "diskTotal": self._format_bytes(disk.total),
            "containers": {
                "running": len([container for container in containers if container["state"] == "running"]),
                "stopped": len([container for container in containers if container["state"] == "exited"]),
                "paused": len([container for container in containers if container["state"] == "paused"]),
                "total": len(containers),
            },
            "loadAvg": per_cpu if per_cpu else [0, 0, 0],
            "uptime": time.time() - psutil.boot_time(),
        }

    def _collect_system_info(self) -> dict[str, Any]:
        docker_version = self.docker_service.get_docker_version()
        return {
            "hostname": platform.node(),
            "platform": platform.system().lower(),
            "arch": platform.machine(),
            "osType": platform.platform(),
            "osRelease": platform.release(),
            "nodeVersion": f"Python {platform.python_version()}",
            "dockerVersion": docker_version["version"],
            "dockerApiVersion": docker_version["apiVersion"],
            "cpus": psutil.cpu_count(logical=False) or psutil.cpu_count() or 0,
            "totalMem": psutil.virtual_memory().total,
        }

    @staticmethod
    def _empty_stats() -> dict[str, Any]:
        return {
            "cpu": 0,
            "memory": 0,
            "memoryUsed": "0 B",
            "memoryTotal": "0 B",
            "disk": 0,
            "diskUsed": "0 B",
            "diskTotal": "0 B",
            "containers": {
                "running": 0,
                "stopped": 0,
                "paused": 0,
                "total": 0,
            },
            "loadAvg": [0, 0, 0],
            "uptime": 0,
        }

    @staticmethod
    def _format_bytes(value: int) -> str:
        if value <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB", "TB"]
        size = float(value)
        index = 0
        while size >= 1024 and index < len(units) - 1:
            size /= 1024
            index += 1
        return f"{size:.2f} {units[index]}"
