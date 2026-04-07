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
  const [isReady, setIsReady] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const intentionalCloseRef = useRef(false);
  const shouldReconnectRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingStartRef = useRef<{
    shell: string;
    cols: number;
    rows: number;
  } | null>(null);
  const onOutputRef = useRef(onOutput);
  const onSessionStartedRef = useRef(onSessionStarted);
  const onSessionClosedRef = useRef(onSessionClosed);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onOutputRef.current = onOutput;
  }, [onOutput]);

  useEffect(() => {
    onSessionStartedRef.current = onSessionStarted;
  }, [onSessionStarted]);

  useEffect(() => {
    onSessionClosedRef.current = onSessionClosed;
  }, [onSessionClosed]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Conectar/disconectar baseado no containerId
  useEffect(() => {
    shouldReconnectRef.current = !!containerId;

    if (!containerId) {
      if (ws.current) {
        intentionalCloseRef.current = true;
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
      setIsReady(false);
      isReadyRef.current = false;
      setIsReconnecting(false);
      setSessionId(null);
      pendingStartRef.current = null;
      return;
    }

    const sendPendingStart = () => {
      if (
        !pendingStartRef.current ||
        !ws.current ||
        ws.current.readyState !== WebSocket.OPEN ||
        !isReadyRef.current
      ) {
        return;
      }

      const { shell, cols, rows } = pendingStartRef.current;
      ws.current.send(
        JSON.stringify({
          action: "start",
          shell,
          cols,
          rows,
        }),
      );
    };

    const connect = async () => {
      try {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        const server = await storageService.getServer();
        const token = await storageService.getToken();

        if (!server || !token) {
          onErrorRef.current?.("No server or token available");
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
        isReadyRef.current = false;
        setIsReady(false);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log("[Terminal] Connected");
          setIsConnected(true);
          setIsReconnecting(false);
        };

        ws.current.onmessage = (event) => {
          try {
            const message: TerminalMessage = JSON.parse(event.data);

            console.log("[Terminal] Message:", message.type);

            switch (message.type) {
              case "started":
                if (message.sessionId) {
                  setSessionId(message.sessionId);
                  pendingStartRef.current = null;
                  onSessionStartedRef.current?.(message.sessionId);
                }
                break;

              case "output":
                if (message.data) {
                  onOutputRef.current(message.data);
                }
                break;

              case "closed":
                setSessionId(null);
                onSessionClosedRef.current?.();
                break;

              case "error":
                pendingStartRef.current = null;
                console.error(
                  "[Terminal] Server error:",
                  message.message || "Unknown error",
                );
                onErrorRef.current?.(message.message || "Unknown error");
                break;

              case "ready":
                console.log("[Terminal] Ready to start session");
                isReadyRef.current = true;
                setIsReady(true);
                sendPendingStart();
                break;
            }
          } catch (err) {
            console.error("[Terminal] Error parsing message:", err);
          }
        };

        ws.current.onerror = (event) => {
          console.error("[Terminal] Error:", event);
          onErrorRef.current?.("Connection error");
        };

        ws.current.onclose = (event) => {
          console.log("[Terminal] Disconnected (code:", event.code, ")");
          setIsConnected(false);
          setIsReady(false);
          isReadyRef.current = false;
          setSessionId(null);
          ws.current = null;

          if (shouldReconnectRef.current && !intentionalCloseRef.current) {
            setIsReconnecting(true);
            onErrorRef.current?.("Connection lost. Attempting to reconnect...");

            reconnectTimeoutRef.current = setTimeout(() => {
              console.log("[Terminal] Attempting to reconnect...");
              void connect();
            }, 2000);
          }
        };
      } catch (err) {
        console.error("[Terminal] Connection error:", err);
        onErrorRef.current?.(err instanceof Error ? err.message : "Unknown error");
      }
    };

    connect();

    // Cleanup
    return () => {
      shouldReconnectRef.current = false;
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
  }, [containerId]);

  /**
   * Inicia uma nova sessão de terminal
   */
  const startSession = (
    shell: string = "/bin/sh",
    cols: number = 80,
    rows: number = 24,
  ) => {
    pendingStartRef.current = { shell, cols, rows };

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !isReady) {
      return;
    }

    const message = {
      action: "start",
      shell,
      cols,
      rows,
    };
    ws.current.send(JSON.stringify(message));
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
      pendingStartRef.current = null;
      const message = {
        action: "close",
      };
      ws.current.send(JSON.stringify(message));
    }
  };

  return {
    isConnected,
    isReady,
    isReconnecting,
    sessionId,
    startSession,
    sendInput,
    resize,
    closeSession,
  };
}
