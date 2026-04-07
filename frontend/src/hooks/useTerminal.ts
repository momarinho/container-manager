import { useEffect, useRef, useState } from "react";
import { storageService } from "../services/storage.service";

export interface TerminalMessage {
  type: "started" | "output" | "closed" | "error" | "ready";
  data?: string;
  sessionId?: string;
  message?: string;
}

export function useTerminal(
  containerId: string | null,
  onOutput: (data: string) => void,
  onSessionStarted?: (sessionId: string) => void,
  onSessionClosed?: () => void,
  onError?: (error: string) => void,
) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const intentionalCloseRef = useRef(false);

  // Conectar/disconectar baseado no containerId
  useEffect(() => {
    if (!containerId) {
      if (ws.current) {
        intentionalCloseRef.current = true;
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
      setSessionId(null);
      return;
    }

    const connect = async () => {
      try {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        const server = await storageService.getServer();
        const token = await storageService.getToken();

        if (!server || !token) {
          onError?.("No server or token available");
          return;
        }

        const baseUrl = server.url.replace(/^https?:\/\//, "");
        const wsProtocol = server.url.startsWith("https://") ? "wss" : "ws";
        const wsUrl = `${wsProtocol}://${baseUrl}/ws/terminal/${containerId}?token=${token}`;

        if (ws.current) {
          intentionalCloseRef.current = true;
          ws.current.close();
        }

        console.log("[Terminal] Connecting to", wsUrl);
        intentionalCloseRef.current = false;
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log("[Terminal] Connected");
          setIsConnected(true);
        };

        ws.current.onmessage = (event) => {
          try {
            const message: TerminalMessage = JSON.parse(event.data);

            console.log("[Terminal] Message:", message.type);

            switch (message.type) {
              case "started":
                if (message.sessionId) {
                  setSessionId(message.sessionId);
                  onSessionStarted?.(message.sessionId);
                }
                break;

              case "output":
                if (message.data) {
                  onOutput(message.data);
                }
                break;

              case "closed":
                setIsConnected(false);
                setSessionId(null);
                onSessionClosed?.();
                break;

              case "error":
                setIsConnected(false);
                onError?.(message.message || "Unknown error");
                break;

              case "ready":
                console.log("[Terminal] Ready to start session");
                break;
            }
          } catch (err) {
            console.error("[Terminal] Error parsing message:", err);
          }
        };

        ws.current.onerror = (event) => {
          console.error("[Terminal] Error:", event);
          setIsConnected(false);
          onError?.("Connection error");
        };

        ws.current.onclose = (event) => {
          console.log("[Terminal] Disconnected (code:", event.code, ")");
          setIsConnected(false);
          ws.current = null;

          // Sessão foi fechada intencionalmente ou terminou
          if (intentionalCloseRef.current) {
            setSessionId(null);
            onSessionClosed?.();
          }
        };
      } catch (err) {
        console.error("[Terminal] Connection error:", err);
        onError?.(err instanceof Error ? err.message : "Unknown error");
      }
    };

    connect();

    // Cleanup
    return () => {
      intentionalCloseRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (ws.current) {
        console.log("[Terminal] Closing connection");
        ws.current.close();
        ws.current = null;
      }
    };
  }, [containerId, onOutput, onSessionStarted, onSessionClosed, onError]);

  /**
   * Inicia uma nova sessão de terminal
   */
  const startSession = (
    shell: string = "/bin/sh",
    cols: number = 80,
    rows: number = 24,
  ) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const message = {
        action: "start",
        shell,
        cols,
        rows,
      };
      ws.current.send(JSON.stringify(message));
    } else {
      console.error("[Terminal] Cannot start session: not connected");
    }
  };

  /**
   * Envia input para o terminal
   */
  const sendInput = (input: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && sessionId) {
      const message = {
        action: "input",
        input,
      };
      ws.current.send(JSON.stringify(message));
    } else {
      console.error(
        "[Terminal] Cannot send input: not connected or no session",
      );
    }
  };

  /**
   * Redimensiona o terminal
   */
  const resize = (cols: number, rows: number) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && sessionId) {
      const message = {
        action: "resize",
        cols,
        rows,
      };
      ws.current.send(JSON.stringify(message));
    } else {
      console.error("[Terminal] Cannot resize: not connected or no session");
    }
  };

  /**
   * Fecha a sessão atual
   */
  const closeSession = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && sessionId) {
      const message = {
        action: "close",
      };
      ws.current.send(JSON.stringify(message));
      intentionalCloseRef.current = true;
    }
  };

  return {
    isConnected,
    sessionId,
    startSession,
    sendInput,
    resize,
    closeSession,
  };
}
