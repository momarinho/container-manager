from __future__ import annotations

import contextlib
import os
import re
import shutil
import subprocess
from typing import Any

import yaml

from app.config import config
from app.services.docker_service import get_docker_service
from app.utils.logger import logger


class StackService:
    def __init__(self, stacks_dir: str | None = None) -> None:
        if stacks_dir:
            self.stacks_dir = os.path.abspath(stacks_dir)
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.stacks_dir = os.path.join(base_dir, "data", "stacks")

        os.makedirs(self.stacks_dir, exist_ok=True)

    def _validate_name(self, name: str) -> str:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Stack name cannot be empty")
        if not re.match(r"^[a-zA-Z0-9_-]+$", clean_name):
            raise ValueError(
                "Stack name can only contain letters, numbers, underscores, and dashes"
            )
        return clean_name

    def _get_stack_dir(self, name: str) -> str:
        return os.path.join(self.stacks_dir, name)

    def _get_compose_file(self, name: str) -> str | None:
        stack_dir = self._get_stack_dir(name)
        for candidate in (
            "docker-compose.yml",
            "docker-compose.yaml",
            "compose.yaml",
            "compose.yml",
        ):
            path = os.path.join(stack_dir, candidate)
            if os.path.isfile(path):
                return path
        return None

    def _run_cmd(self, cmd: list[str], cwd: str | None = None) -> tuple[int, str, str]:
        env = os.environ.copy()
        if config.docker_socket_path.startswith("tcp://"):
            env["DOCKER_HOST"] = config.docker_socket_path
        elif config.docker_socket_path:
            env["DOCKER_HOST"] = f"unix://{config.docker_socket_path}"

        process = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            env=env,
            timeout=120,
        )
        return process.returncode, process.stdout, process.stderr

    def list_stacks(self) -> list[dict[str, Any]]:
        # 1. Stacks salvas no disco
        saved_stacks: set[str] = set()
        if os.path.isdir(self.stacks_dir):
            for entry in os.listdir(self.stacks_dir):
                if os.path.isdir(os.path.join(self.stacks_dir, entry)):
                    saved_stacks.add(entry)

        # 2. Containers ativos e seus labels compose
        docker_service = get_docker_service()
        all_containers = docker_service.list_containers(all_containers=True)

        containers_by_project: dict[str, list[dict[str, Any]]] = {}
        for container in all_containers:
            labels = container.get("labels") or {}
            project = labels.get("com.docker.compose.project")
            if project:
                containers_by_project.setdefault(project, []).append(container)

        all_stack_names = sorted(saved_stacks.union(containers_by_project.keys()))
        results: list[dict[str, Any]] = []

        for name in all_stack_names:
            containers = containers_by_project.get(name, [])
            compose_path = self._get_compose_file(name)

            services: set[str] = set()
            for c in containers:
                labels = c.get("labels") or {}
                svc = labels.get("com.docker.compose.service")
                if svc:
                    services.add(svc)

            if compose_path and os.path.exists(compose_path):
                try:
                    with open(compose_path, encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                        if (
                            isinstance(data, dict)
                            and "services" in data
                            and isinstance(data["services"], dict)
                        ):
                            services.update(data["services"].keys())
                except Exception:
                    pass

            # Calcular status da stack
            if not containers:
                status = "stopped"
            elif all(c.get("state") == "running" for c in containers):
                status = "running"
            elif any(c.get("state") == "running" for c in containers):
                status = "partially_running"
            else:
                status = "stopped"

            created_time = None
            if compose_path and os.path.exists(compose_path):
                mtime = os.path.getmtime(compose_path)
                created_time = int(mtime * 1000)

            results.append(
                {
                    "name": name,
                    "status": status,
                    "servicesCount": len(services),
                    "services": sorted(services),
                    "containersCount": len(containers),
                    "containers": containers,
                    "hasComposeFile": compose_path is not None,
                    "createdAt": created_time,
                }
            )

        return results

    def get_stack(self, name: str) -> dict[str, Any]:
        clean_name = self._validate_name(name)
        stacks = self.list_stacks()
        for stack in stacks:
            if stack["name"] == clean_name:
                compose_content = self.get_stack_compose(clean_name)
                return {**stack, "composeYaml": compose_content}

        raise ValueError(f"Stack '{clean_name}' not found")

    def get_stack_compose(self, name: str) -> str | None:
        clean_name = self._validate_name(name)
        compose_path = self._get_compose_file(clean_name)
        if not compose_path:
            return None
        with open(compose_path, encoding="utf-8") as f:
            return f.read()

    def deploy_stack(
        self,
        name: str,
        compose_yaml: str,
        env_vars: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        clean_name = self._validate_name(name)

        # Validar sintaxe YAML
        try:
            parsed = yaml.safe_load(compose_yaml)
            if (
                not isinstance(parsed, dict)
                or "services" not in parsed
                or not isinstance(parsed["services"], dict)
            ):
                raise ValueError("Compose YAML must contain a top-level 'services' mapping")
        except yaml.YAMLError as exc:
            raise ValueError(f"Invalid YAML format: {exc}") from exc

        stack_dir = self._get_stack_dir(clean_name)
        os.makedirs(stack_dir, exist_ok=True)

        compose_file = os.path.join(stack_dir, "docker-compose.yml")
        with open(compose_file, "w", encoding="utf-8") as f:
            f.write(compose_yaml)

        if env_vars:
            env_file = os.path.join(stack_dir, ".env")
            with open(env_file, "w", encoding="utf-8") as f:
                for k, v in env_vars.items():
                    f.write(f"{k}={v}\n")

        # Executar docker compose up -d
        cmd = [
            "docker",
            "compose",
            "-f",
            compose_file,
            "-p",
            clean_name,
            "up",
            "-d",
            "--remove-orphans",
        ]
        retcode, stdout, stderr = self._run_cmd(cmd, cwd=stack_dir)
        if retcode != 0:
            error_msg = stderr.strip() or stdout.strip() or f"Command failed with code {retcode}"
            logger.error("Failed to deploy stack %s: %s", clean_name, error_msg)
            raise ValueError(f"Failed to deploy stack: {error_msg}")

        logger.info("Stack %s successfully deployed", clean_name)
        return self.get_stack(clean_name)

    def up_stack(self, name: str) -> dict[str, Any]:
        clean_name = self._validate_name(name)
        compose_file = self._get_compose_file(clean_name)
        stack_dir = self._get_stack_dir(clean_name)

        cmd = ["docker", "compose"]
        if compose_file:
            cmd.extend(["-f", compose_file])
        cmd.extend(["-p", clean_name, "up", "-d"])

        retcode, stdout, stderr = self._run_cmd(
            cmd, cwd=stack_dir if os.path.isdir(stack_dir) else None
        )
        if retcode != 0:
            error_msg = stderr.strip() or stdout.strip() or f"Command failed with code {retcode}"
            raise ValueError(f"Failed to start stack: {error_msg}")

        return self.get_stack(clean_name)

    def down_stack(self, name: str) -> dict[str, Any]:
        clean_name = self._validate_name(name)
        compose_file = self._get_compose_file(clean_name)
        stack_dir = self._get_stack_dir(clean_name)

        cmd = ["docker", "compose"]
        if compose_file:
            cmd.extend(["-f", compose_file])
        cmd.extend(["-p", clean_name, "down"])

        retcode, stdout, stderr = self._run_cmd(
            cmd, cwd=stack_dir if os.path.isdir(stack_dir) else None
        )
        if retcode != 0:
            error_msg = stderr.strip() or stdout.strip() or f"Command failed with code {retcode}"
            raise ValueError(f"Failed to stop stack: {error_msg}")

        return {"name": clean_name, "status": "stopped"}

    def delete_stack(self, name: str) -> dict[str, Any]:
        clean_name = self._validate_name(name)
        with contextlib.suppress(Exception):
            self.down_stack(clean_name)

        stack_dir = self._get_stack_dir(clean_name)
        if os.path.isdir(stack_dir):
            shutil.rmtree(stack_dir, ignore_errors=True)

        return {"name": clean_name, "deleted": True}

    def get_stack_logs(self, name: str, tail: int = 100) -> str:
        clean_name = self._validate_name(name)
        compose_file = self._get_compose_file(clean_name)
        stack_dir = self._get_stack_dir(clean_name)

        cmd = ["docker", "compose"]
        if compose_file:
            cmd.extend(["-f", compose_file])
        cmd.extend(["-p", clean_name, "logs", f"--tail={tail}", "--no-color"])

        retcode, stdout, stderr = self._run_cmd(
            cmd, cwd=stack_dir if os.path.isdir(stack_dir) else None
        )
        if retcode != 0 and not stdout:
            return stderr.strip() or f"No logs available (exit {retcode})"

        return stdout


_stack_service: StackService | None = None


def get_stack_service() -> StackService:
    global _stack_service
    if _stack_service is None:
        _stack_service = StackService()
    return _stack_service
