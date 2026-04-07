from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import docker

from app.config import config
from app.utils.logger import logger


class DockerService:
    def __init__(self) -> None:
        base_url = self._build_base_url(config.docker_socket_path)
        self.client = docker.DockerClient(base_url=base_url)
        self.api = docker.APIClient(base_url=base_url)
        logger.info("Docker service initialized with socket %s", config.docker_socket_path)

    @staticmethod
    def _build_base_url(socket_path: str) -> str:
        if socket_path.startswith("unix://") or socket_path.startswith("tcp://"):
            return socket_path
        return f"unix://{socket_path}"

    def list_containers(self, all_containers: bool = False) -> list[dict[str, Any]]:
        containers = self.api.containers(all=all_containers)
        return [self._transform_container(container) for container in containers]

    def get_container(self, container_id: str) -> dict[str, Any]:
        details = self.api.inspect_container(container_id)
        return self._transform_container_details(details)

    def start_container(self, container_id: str) -> None:
        self.api.start(container_id)

    def stop_container(self, container_id: str) -> None:
        self.api.stop(container_id, timeout=10)

    def restart_container(self, container_id: str) -> None:
        self.api.restart(container_id, timeout=10)

    def pause_container(self, container_id: str) -> None:
        self.api.pause(container_id)

    def unpause_container(self, container_id: str) -> None:
        self.api.unpause(container_id)

    def remove_container(self, container_id: str, force: bool = False) -> None:
        self.api.remove_container(container_id, force=force, v=True)

    def get_container_stats(self, container_id: str) -> dict[str, Any]:
        stats = self.api.stats(container_id, stream=False)
        return self._transform_stats(stats, container_id)

    def open_log_stream(
        self,
        container_id: str,
        *,
        follow: bool = True,
        stdout: bool = True,
        stderr: bool = True,
        tail: str = "100",
    ) -> Iterable[bytes]:
        return self.api.logs(
            container=container_id,
            stream=True,
            follow=follow,
            stdout=stdout,
            stderr=stderr,
            tail=tail,
        )

    def exec_in_container(
        self,
        container_id: str,
        cmd: list[str],
        env: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        exec_info = self.api.exec_create(
            container=container_id,
            cmd=cmd,
            stdout=True,
            stderr=True,
            environment=[f"{key}={value}" for key, value in (env or {}).items()],
        )
        exec_id = exec_info["Id"]
        output = self.api.exec_start(exec_id, detach=False, tty=False)
        inspected = self.api.exec_inspect(exec_id)
        decoded_output = output.decode("utf-8", errors="ignore") if isinstance(output, bytes) else str(output)
        return {
            "exitCode": inspected.get("ExitCode", 0) or 0,
            "output": decoded_output,
        }

    def create_exec_socket(
        self,
        container_id: str,
        cmd: list[str],
    ) -> tuple[str, Any]:
        created = self.api.exec_create(
            container=container_id,
            cmd=cmd,
            stdin=True,
            stdout=True,
            stderr=True,
            tty=True,
        )
        exec_id = created["Id"]
        raw_socket = self.api.exec_start(
            exec_id,
            detach=False,
            tty=True,
            socket=True,
        )
        return exec_id, raw_socket

    def resize_exec(self, exec_id: str, rows: int, cols: int) -> None:
        self.api.exec_resize(exec_id, height=rows, width=cols)

    def inspect_exec(self, exec_id: str) -> dict[str, Any]:
        return self.api.exec_inspect(exec_id)

    def get_docker_version(self) -> dict[str, str]:
        version = self.api.version()
        return {
            "version": version.get("Version", "unknown"),
            "apiVersion": version.get("ApiVersion", "unknown"),
        }

    def inspect_container_state(self, container_id: str) -> dict[str, Any]:
        details = self.api.inspect_container(container_id)
        return details.get("State", {})

    def _transform_container(self, docker_container: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": docker_container.get("Id", ""),
            "names": [name.lstrip("/") for name in docker_container.get("Names", [])],
            "image": docker_container.get("Image", ""),
            "imageId": docker_container.get("ImageID", ""),
            "command": docker_container.get("Command", ""),
            "created": docker_container.get("Created", 0),
            "state": docker_container.get("State", ""),
            "status": docker_container.get("Status", ""),
            "ports": [
                {
                    "IP": port.get("IP"),
                    "privatePort": port.get("PrivatePort"),
                    "publicPort": port.get("PublicPort"),
                    "type": port.get("Type", "tcp"),
                }
                for port in docker_container.get("Ports", [])
            ],
            "labels": docker_container.get("Labels") or {},
        }

    def _transform_container_details(self, details: dict[str, Any]) -> dict[str, Any]:
        container = self._transform_container(
            {
                "Id": details.get("Id", ""),
                "Names": [details.get("Name", "").lstrip("/")] if details.get("Name") else [],
                "Image": (details.get("Config") or {}).get("Image", ""),
                "ImageID": details.get("Image", ""),
                "Command": " ".join((details.get("Config") or {}).get("Cmd") or []),
                "Created": int(self._created_timestamp(details.get("Created"))),
                "State": (details.get("State") or {}).get("Status", ""),
                "Status": (details.get("State") or {}).get("Status", ""),
                "Ports": [],
                "Labels": (details.get("Config") or {}).get("Labels") or {},
            }
        )

        network_settings = details.get("NetworkSettings") or {}
        host_config = details.get("HostConfig") or {}
        config_section = details.get("Config") or {}

        return {
            **container,
            "hostConfig": {
                "portBindings": host_config.get("PortBindings"),
                "binds": host_config.get("Binds"),
                "restartPolicy": host_config.get("RestartPolicy"),
            },
            "config": {
                "labels": config_section.get("Labels"),
                "env": config_section.get("Env"),
                "cmd": config_section.get("Cmd"),
                "entrypoint": config_section.get("Entrypoint"),
                "workingDir": config_section.get("WorkingDir"),
                "user": config_section.get("User"),
            },
            "networkSettings": {
                "networks": self._transform_networks(network_settings.get("Networks") or {}),
                "ipAddress": network_settings.get("IPAddress"),
                "ipPrefixLen": network_settings.get("IPPrefixLen"),
                "gateway": network_settings.get("Gateway"),
                "bridge": network_settings.get("Bridge"),
            },
            "mounts": [
                {
                    "type": mount.get("Type", "bind"),
                    "source": mount.get("Source"),
                    "destination": mount.get("Destination", ""),
                    "mode": mount.get("Mode", ""),
                    "rw": mount.get("RW", False),
                    "propagation": mount.get("Propagation", ""),
                }
                for mount in details.get("Mounts", [])
            ],
        }

    @staticmethod
    def _transform_networks(networks: dict[str, Any]) -> dict[str, Any]:
        transformed: dict[str, Any] = {}
        for key, value in networks.items():
            transformed[key] = {
                "IPAMConfig": value.get("IPAMConfig"),
                "links": value.get("Links"),
                "aliases": value.get("Aliases"),
                "networkID": value.get("NetworkID", ""),
                "endpointID": value.get("EndpointID", ""),
                "gateway": value.get("Gateway", ""),
                "ipAddress": value.get("IPAddress", ""),
                "ipPrefixLen": value.get("IPPrefixLen", 0),
                "ipv6Gateway": value.get("IPv6Gateway", ""),
                "globalIPv6Address": value.get("GlobalIPv6Address", ""),
                "globalIPv6PrefixLen": value.get("GlobalIPv6PrefixLen", 0),
                "macAddress": value.get("MacAddress", ""),
            }
        return transformed

    @staticmethod
    def _created_timestamp(created: str | None) -> float:
        if not created:
            return 0
        created_normalized = created.replace("Z", "+00:00")
        try:
            from datetime import datetime

            return datetime.fromisoformat(created_normalized).timestamp()
        except ValueError:
            return 0

    @staticmethod
    def _transform_stats(stats: dict[str, Any], container_id: str) -> dict[str, Any]:
        cpu_stats = stats.get("cpu_stats") or {}
        precpu_stats = stats.get("precpu_stats") or {}
        cpu_usage = cpu_stats.get("cpu_usage") or {}
        precpu_usage = precpu_stats.get("cpu_usage") or {}

        cpu_delta = cpu_usage.get("total_usage", 0) - precpu_usage.get("total_usage", 0)
        system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
        online_cpus = cpu_stats.get("online_cpus") or 1
        cpu_percent = (cpu_delta / system_delta) * 100 * online_cpus if system_delta > 0 else 0

        memory_stats = stats.get("memory_stats") or {}
        memory_usage = memory_stats.get("usage", 0) or 0
        memory_limit = memory_stats.get("limit", 0) or 0
        memory_percent = (memory_usage / memory_limit) * 100 if memory_limit > 0 else 0

        networks = list((stats.get("networks") or {}).values())
        net_rx = sum(network.get("rx_bytes", 0) for network in networks)
        net_tx = sum(network.get("tx_bytes", 0) for network in networks)

        io_stats = ((stats.get("blkio_stats") or {}).get("io_service_bytes_recursive")) or []
        block_read = sum(io.get("value", 0) for io in io_stats if io.get("op") == "Read")
        block_write = sum(io.get("value", 0) for io in io_stats if io.get("op") == "Write")

        return {
            "name": stats.get("name", ""),
            "id": container_id,
            "cpuPercent": cpu_percent,
            "memoryUsage": memory_usage,
            "memoryLimit": memory_limit,
            "memoryPercent": memory_percent,
            "netRx": net_rx,
            "netTx": net_tx,
            "blockRead": block_read,
            "blockWrite": block_write,
        }


docker_service = DockerService()
