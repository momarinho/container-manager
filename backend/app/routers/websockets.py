from __future__ import annotations

import asyncio
import json
from threading import Event

from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

from app import main
from app.dependencies import authenticate_websocket
from app.utils.logger import logger

router = APIRouter(tags=["WebSockets"])


@router.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    queue = main.system_stats_service.subscribe()
    await websocket.send_json({"type": "connected"})

    try:
        while True:
            stats = await queue.get()
            await websocket.send_json({"type": "stats", "data": stats})
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: stats")
    finally:
        main.system_stats_service.unsubscribe(queue)


@router.websocket("/ws/tunnel")
async def websocket_tunnel(websocket: WebSocket) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    queue = main.tunnel_service.subscribe()
    await websocket.send_json({"type": "connected"})

    try:
        while True:
            status = await queue.get()
            await websocket.send_json({"type": "tunnel_status", "data": status})
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: tunnel")
    finally:
        main.tunnel_service.unsubscribe(queue)


@router.websocket("/ws/logs/{container_id}")
async def websocket_logs(websocket: WebSocket, container_id: str) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    queue: asyncio.Queue[dict[str, str] | None] = asyncio.Queue()
    stop_event = Event()
    loop = asyncio.get_running_loop()
    try:
        docker_service = main.get_docker_service()
        log_stream = await asyncio.to_thread(docker_service.open_log_stream, container_id)
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1011, reason="Log stream failed")
        return

    def reader() -> None:
        try:
            for chunk in log_stream:
                if stop_event.is_set():
                    break
                payload = {
                    "type": "log",
                    "data": chunk.decode("utf-8", errors="ignore"),
                }
                loop.call_soon_threadsafe(queue.put_nowait, payload)
        except Exception as exc:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "error", "message": str(exc)},
            )
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    reader_thread = asyncio.to_thread(reader)
    reader_task = asyncio.create_task(reader_thread)

    async def sender() -> None:
        while True:
            event = await queue.get()
            if event is None:
                break
            if event["type"] == "error":
                await websocket.send_json({"type": "error", "message": event["message"]})
                continue
            await websocket.send_json(
                {
                    "type": "log",
                    "containerId": container_id,
                    "data": event["data"],
                }
            )

    sender_task = asyncio.create_task(sender())
    await websocket.send_json({"type": "connected", "containerId": container_id})

    try:
        while True:
            message = await websocket.receive_text()
            payload = json.loads(message)
            if payload.get("action") == "unsubscribe":
                stop_event.set()
                close_fn = getattr(log_stream, "close", None)
                if callable(close_fn):
                    close_fn()
                await websocket.send_json({"type": "unsubscribed"})
                break
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: logs")
    finally:
        stop_event.set()
        close_fn = getattr(log_stream, "close", None)
        if callable(close_fn):
            close_fn()
        await sender_task
        await reader_task


@router.websocket("/ws/terminal/{container_id}")
async def websocket_terminal(websocket: WebSocket, container_id: str) -> None:
    user = await authenticate_websocket(websocket)
    if not user:
        return

    active_session_id: str | None = None
    forward_task: asyncio.Task[None] | None = None
    await websocket.send_json({"type": "ready", "message": "Send shell command to start session"})

    async def forward_events(session_id: str) -> None:
        nonlocal active_session_id, forward_task
        queue = main.terminal_service.get_event_queue(session_id)
        while True:
            event = await queue.get()
            event_type = event.get("type")
            if event_type == "output":
                await websocket.send_json({"type": "output", "data": event.get("data", "")})
            elif event_type == "error":
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": event.get("message", "Terminal operation failed"),
                    }
                )
            elif event_type == "closed":
                active_session_id = None
                forward_task = None
                await websocket.send_json({"type": "closed"})
                break

    try:
        while True:
            raw_message = await websocket.receive_text()
            payload = json.loads(raw_message)
            action = payload.get("action")

            if action == "start":
                if active_session_id:
                    main.terminal_service.close_session(active_session_id)
                    if forward_task:
                        await forward_task

                shell = payload.get("shell", "/bin/sh")
                cols = int(payload.get("cols", 80))
                rows = int(payload.get("rows", 24))
                try:
                    active_session_id = await main.terminal_service.create_session(
                        container_id,
                        shell,
                        cols,
                        rows,
                    )
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue

                forward_task = asyncio.create_task(forward_events(active_session_id))
                logger.info(
                    "Terminal session started: session=%s container=%s user=%s shell=%s",
                    active_session_id,
                    container_id,
                    user["username"],
                    shell,
                )
                await websocket.send_json({"type": "started", "sessionId": active_session_id})

            elif action == "input" and active_session_id:
                try:
                    main.terminal_service.write(active_session_id, str(payload.get("input", "")))
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})

            elif action == "resize" and active_session_id:
                try:
                    await main.terminal_service.resize(
                        active_session_id,
                        int(payload.get("cols", 80)),
                        int(payload.get("rows", 24)),
                    )
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})

            elif action == "close" and active_session_id:
                main.terminal_service.close_session(active_session_id)
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed: terminal")
    finally:
        if active_session_id:
            main.terminal_service.close_session(active_session_id)
        if forward_task:
            await forward_task
