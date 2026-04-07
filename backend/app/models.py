from __future__ import annotations

from pydantic import BaseModel, Field


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
