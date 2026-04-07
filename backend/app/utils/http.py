from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse


def success_payload(data: Any, meta: Any | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "success": True,
        "data": data,
    }
    if meta is not None:
        payload["meta"] = meta
    return payload


def error_payload(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Any | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error_payload(code, message, details),
    )
