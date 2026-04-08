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
