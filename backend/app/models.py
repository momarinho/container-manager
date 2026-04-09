from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginCredentials(BaseModel):
    username: str | None = None
    password: str | None = None
    apiToken: str | None = None


class AuthUser(BaseModel):
    id: str
    username: str


class AuthResponse(BaseModel):
    token: str
    expiresAt: int
    user: AuthUser


class ExecRequest(BaseModel):
    cmd: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)


class ContainerPortMapping(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    container_port: int = Field(alias="containerPort", ge=1, le=65535)
    host_port: int | None = Field(default=None, alias="hostPort", ge=1, le=65535)
    protocol: Literal["tcp", "udp"] = "tcp"
    host_ip: str | None = Field(default=None, alias="hostIp")


class ContainerVolumeMapping(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    read_only: bool = Field(default=False, alias="readOnly")


class CreateContainerRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    image: str = Field(min_length=1)
    command: list[str] = Field(default_factory=list)
    entrypoint: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    ports: list[ContainerPortMapping] = Field(default_factory=list)
    volumes: list[ContainerVolumeMapping] = Field(default_factory=list)
    restart_policy: Literal["no", "always", "unless-stopped", "on-failure"] = Field(
        default="unless-stopped",
        alias="restartPolicy",
    )
    restart_max_retries: int = Field(default=0, alias="restartMaxRetries", ge=0)
    working_dir: str | None = Field(default=None, alias="workingDir")
    auto_start: bool = Field(default=True, alias="autoStart")
    pull_image: bool = Field(default=True, alias="pullImage")
    labels: dict[str, str] = Field(default_factory=dict)


class ValidateImageRequest(BaseModel):
    image: str = Field(min_length=1)


class TunnelConnectRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    provider: Literal["tailscale", "wireguard"] = "tailscale"
    auth_key: str | None = Field(default=None, alias="authKey")
    hostname: str | None = None


class TunnelStatusResponse(BaseModel):
    provider: Literal["tailscale", "wireguard"]
    state: Literal["connected", "connecting", "disconnected", "needs_login", "error"]
    connected: bool
    needsLogin: bool
    backendState: str
    hostname: str | None = None
    magicDnsName: str | None = None
    tailnet: str | None = None
    ip: str | None = None
    health: list[str] = Field(default_factory=list)
    updatedAt: int
