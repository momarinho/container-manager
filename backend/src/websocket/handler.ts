import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../utils/logger";
import { config } from "../utils/config";
import { verifyJwt } from "../utils/jwt.util";
import { logStreamerService } from "../services/logStreamer.service";
import { terminalService } from "../services/terminal.service";
import { systemStatsService } from "../services/systemStats.service";
import type { WebSocketWithSession } from "../types/ws";

export class WebSocketHandler {
  private wss: WebSocketServer;

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
    });

    this.setupConnectionHandler();
    logger.info("WebSocket handler initialized");
  }

  private setupConnectionHandler(): void {
    this.wss.on("connection", (ws: WebSocketWithSession, req) => {
      // Use fallback for headers.host which may not be available in WebSocket connections
      const host = req.headers.host || `localhost:${config.port}`;
      const url = new URL(req.url || "", `http://${host}`);
      const path = url.pathname;
      const token = url.searchParams.get("token");

      if (!path.startsWith("/ws/")) {
        ws.send(JSON.stringify({ type: "error", message: "Unknown endpoint" }));
        ws.close(1002, "Unknown endpoint");
        return;
      }

      // Check authentication
      if (!token) {
        ws.send(
          JSON.stringify({ type: "error", message: "Authentication required" }),
        );
        ws.close(1008, "Authentication required");
        return;
      }

      try {
        const payload = verifyJwt<{ userId: string; username: string }>(token);
        ws.authUser = { id: payload.userId, username: payload.username };
        logger.info(
          `WebSocket connection established: ${path} for user ${payload?.username}`,
        );
      } catch (error) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        ws.close(1008, "Invalid token");
        return;
      }

      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      // Route based on path
      if (path.startsWith("/ws/logs/")) {
        this.handleLogsConnection(ws, path);
      } else if (path.startsWith("/ws/terminal/")) {
        this.handleTerminalConnection(ws, path);
      } else if (path === "/ws/stats") {
        this.handleStatsConnection(ws);
      } else {
        ws.send(JSON.stringify({ type: "error", message: "Unknown endpoint" }));
        ws.close(1002, "Unknown endpoint");
      }

      ws.on("error", (error) => {
        logger.error("WebSocket error:", error);
      });

      ws.on("close", () => {
        this.handleClose(ws);
      });
    });

    // Heartbeat
    this.wss.on("close", () => {
      clearInterval(this.heartbeatInterval);
    });
  }

  private handleLogsConnection(ws: WebSocketWithSession, path: string): void {
    const containerId = path.split("/")[3];

    if (!containerId) {
      ws.send(
        JSON.stringify({ type: "error", message: "Container ID required" }),
      );
      ws.close(1002, "Container ID required");
      return;
    }

    logStreamerService
      .subscribe(containerId, (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "log", containerId, data }));
        }
      })
      .then((unsubscribe) => {
        ws.session = { type: "logs", containerId, unsubscribe };
      });

    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleLogsMessage(ws, data);
      } catch (error) {
        logger.error("Failed to parse logs message:", error);
      }
    });

    ws.send(JSON.stringify({ type: "connected", containerId }));
  }

  private handleLogsMessage(ws: WebSocketWithSession, data: any): void {
    if (data.action === "unsubscribe") {
      const session = ws.session;
      if (session && session.unsubscribe) {
        session.unsubscribe();
        ws.send(JSON.stringify({ type: "unsubscribed" }));
      }
    }
  }

  private handleTerminalConnection(
    ws: WebSocketWithSession,
    path: string,
  ): void {
    const containerId = path.split("/")[3];

    if (!containerId) {
      ws.send(
        JSON.stringify({ type: "error", message: "Container ID required" }),
      );
      ws.close(1002, "Container ID required");
      return;
    }

    ws.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleTerminalMessage(ws, containerId, data);
      } catch (error) {
        logger.error("Failed to parse terminal message:", error);
      }
    });

    ws.send(
      JSON.stringify({
        type: "ready",
        message: "Send shell command to start session",
      }),
    );
  }

  private async handleTerminalMessage(
    ws: WebSocketWithSession,
    containerId: string,
    data: any,
  ): Promise<void> {
    try {
      const { action } = data;

      if (action === "start") {
        const { shell, cols, rows } = data;
        const username = ws.authUser?.username ?? "unknown";
        const sessionId = await terminalService.createSession(
          containerId,
          shell,
          cols,
          rows,
        );

        ws.session = {
          type: "terminal",
          containerId,
          sessionId,
          unsubscribe: () => terminalService.closeSession(sessionId),
        };

        terminalService.onData(sessionId, (output: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "output", data: output }));
          }
        });

        terminalService.onClose(sessionId, () => {
          if (
            ws.session?.type === "terminal" &&
            ws.session.sessionId === sessionId
          ) {
            ws.session = undefined;
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "closed" }));
          }
        });

        logger.info(
          `Terminal session started: session=${sessionId} container=${containerId} user=${username} shell=${shell}`,
        );

        ws.send(JSON.stringify({ type: "started", sessionId }));
      } else if (action === "input") {
        const session = ws.session;
        if (session?.type === "terminal" && session.sessionId) {
          logger.info(
            `Terminal input: session=${session.sessionId} container=${containerId} user=${ws.authUser?.username ?? "unknown"} bytes=${typeof data.input === "string" ? data.input.length : 0}`,
          );
          terminalService.write(session.sessionId, data.input);
        }
      } else if (action === "resize") {
        const session = ws.session;
        if (session?.type === "terminal" && session.sessionId) {
          logger.info(
            `Terminal resize: session=${session.sessionId} container=${containerId} user=${ws.authUser?.username ?? "unknown"} cols=${data.cols} rows=${data.rows}`,
          );
          terminalService.resize(session.sessionId, data.cols, data.rows);
        }
      } else if (action === "close") {
        const session = ws.session;
        if (session?.type === "terminal" && session.sessionId) {
          logger.info(
            `Terminal close requested: session=${session.sessionId} container=${containerId} user=${ws.authUser?.username ?? "unknown"}`,
          );
          terminalService.closeSession(session.sessionId);
        }
      }
    } catch (error) {
      logger.error("Terminal message error:", error);
      const message =
        error instanceof Error ? error.message : "Terminal operation failed";
      ws.send(
        JSON.stringify({ type: "error", message }),
      );
    }
  }

  private handleStatsConnection(ws: WebSocketWithSession): void {
    const unsubscribe = systemStatsService.subscribe((stats) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stats", data: stats }));
      }
    });

    ws.session = { type: "stats", unsubscribe };
    ws.send(JSON.stringify({ type: "connected" }));
  }

  private handleClose(ws: WebSocketWithSession): void {
    const session = ws.session;

    if (session) {
      if (session.unsubscribe) {
        session.unsubscribe();
      }
      if (session.type === "terminal" && session.sessionId) {
        terminalService.closeSession(session.sessionId);
      }
      logger.info(`WebSocket connection closed: ${session.type}`);
    }
  }

  private heartbeatInterval = setInterval(() => {
    this.wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, config.websocket.pingInterval);

  getConnectedClientsCount(): number {
    return this.wss.clients.size;
  }
}
