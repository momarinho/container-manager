from __future__ import annotations

from fastapi import APIRouter, Body, Depends

from app.dependencies import require_http_user
from app.services.auth_service import auth_service
from app.utils.http import error_response, success_payload

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", summary="List users")
async def list_users(_user: dict[str, str] = Depends(require_http_user)):
    users = auth_service.list_users()
    return success_payload(
        [{"id": u["id"], "username": u["username"], "createdAt": u["created_at"]} for u in users]
    )


@router.post("", summary="Create user")
async def create_user(
    body: dict[str, str] = Body(...),
    _user: dict[str, str] = Depends(require_http_user),
):
    username = body.get("username")
    password = body.get("password")
    if not username or not password:
        return error_response(400, "USER_CREATE_FAILED", "Username and password are required")
    try:
        user = auth_service.create_user(username, password)
        return success_payload(
            {"id": user["id"], "username": user["username"], "createdAt": user["created_at"]}
        )
    except ValueError as exc:
        return error_response(400, "USER_CREATE_FAILED", str(exc))


@router.delete("/{username}", summary="Delete user")
async def delete_user(
    username: str,
    _user: dict[str, str] = Depends(require_http_user),
):
    try:
        deleted = auth_service.delete_user(username)
        if not deleted:
            return error_response(404, "USER_NOT_FOUND", "User not found")
        return success_payload({"deleted": True})
    except ValueError as exc:
        return error_response(400, "USER_DELETE_FAILED", str(exc))
