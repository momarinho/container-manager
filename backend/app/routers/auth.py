from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Body, Depends, Request

from app.dependencies import require_http_user
from app.models import LoginCredentials, LogoutRequest, RefreshTokenRequest
from app.security import get_bearer_token, verify_jwt
from app.services.auth_service import auth_service
from app.utils.http import error_response, success_payload

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", summary="Authenticate user")
async def login(credentials: LoginCredentials):
    if not credentials.username and not credentials.apiToken:
        return error_response(
            400,
            "AUTH_CREDENTIALS_REQUIRED",
            "Username/password or API token required",
        )

    is_valid = auth_service.validate_credentials(
        credentials.username,
        credentials.password,
        credentials.apiToken,
    )
    if not is_valid:
        return error_response(401, "AUTH_INVALID_CREDENTIALS", "Invalid credentials")

    response = auth_service.build_login_response(credentials.username)
    response.expiresAt = int(time.time() * 1000) + response.expiresAt
    return success_payload(response.model_dump())


@router.post("/refresh", summary="Rotate and refresh tokens")
async def refresh(payload: RefreshTokenRequest):
    try:
        new_auth = auth_service.rotate_refresh_token(payload.refreshToken)
        new_auth.expiresAt = int(time.time() * 1000) + new_auth.expiresAt
        return success_payload(new_auth.model_dump())
    except PermissionError as exc:
        # Reuso detectado - sessão/família revogada por segurança
        return error_response(401, "AUTH_TOKEN_COMPROMISED", str(exc))
    except ValueError as exc:
        return error_response(401, "AUTH_REFRESH_INVALID", str(exc))
    except Exception:
        return error_response(500, "AUTH_REFRESH_FAILED", "Failed to refresh token")


@router.post("/logout", summary="Logout user and revoke tokens")
async def logout(
    request: Request,
    payload: LogoutRequest | None = Body(default=None),
):
    token = get_bearer_token(request.headers.get("Authorization"))
    refresh_token = payload.refreshToken if payload else None

    auth_service.revoke_session(access_token=token, raw_refresh_token=refresh_token)
    return success_payload({"message": "Successfully logged out", "revoked": True})


@router.get("/verify", summary="Verify bearer token")
async def verify(user: dict[str, str] = Depends(require_http_user)):
    return success_payload({"valid": True, "user": user})


@router.get("/validate", summary="Validate token payload")
@router.post("/validate", summary="Validate token payload")
async def validate(request: Request, body: dict[str, Any] | None = Body(default=None)):
    token = None
    if body:
        token = body.get("token")
    if not token:
        token = get_bearer_token(request.headers.get("Authorization"))

    if not token:
        return error_response(400, "AUTH_TOKEN_REQUIRED", "Token required")

    try:
        payload = verify_jwt(token)
    except ValueError:
        return error_response(401, "AUTH_TOKEN_INVALID", "Invalid token")

    return success_payload(
        {
            "valid": True,
            "user": {
                "id": str(payload["userId"]),
                "username": str(payload["username"]),
            },
        }
    )
