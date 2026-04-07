import { useEffect, useRef, useState } from 'react';
import { storageService } from '../services/storage.service';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp?: number;
}

/**
 * Hook customizado para conexão WebSocket com reconexão automática
 * 
 * @param path - Caminho do WebSocket (ex: '/stats', '/logs/abc123')
 * @param onMessage - Callback chamado quando uma mensagem é recebida
 * @param enabled - Se false, não conecta
 * @returns { isConnected, error, send }
 */
export function useWebSocket<T = any>(
  path: string,
  onMessage: (data: T) => void,
  enabled: boolean = true
) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const shouldReconnectRef = useRef(enabled);
  const intentionalCloseRef = useRef(false);

  // Mantém onMessageRef atualizado sem causar re-renders
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    shouldReconnectRef.current = enabled;

    if (!enabled) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (ws.current) {
        intentionalCloseRef.current = true;
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
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
          setError('No server or token available');
          return;
        }

        // Remove protocolo http:// ou https:// da URL
        const baseUrl = server.url.replace(/^https?:\/\//, '');
        const wsProtocol = server.url.startsWith('https://') ? 'wss' : 'ws';
        // O WebSocketServer está montado em /ws, então /ws/stats vira /stats no handler
        // Por isso precisamos usar /ws + path
        const wsUrl = `${wsProtocol}://${baseUrl}/ws${path}?token=${token}`;

        if (ws.current) {
          intentionalCloseRef.current = true;
          ws.current.close();
        }
        
        console.log(`[WebSocket] Connecting to ${wsUrl}`);
        intentionalCloseRef.current = false;
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log(`[WebSocket] Connected to ${path}`);
          setIsConnected(true);
          setError(null);
        };

        ws.current.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            // Ignora mensagens de erro ou connected
            if (message.type === 'error') {
              const errorMessage = message.message || 'WebSocket error';
              console.error('[WebSocket] Error message:', errorMessage);
              setError(errorMessage);
              return;
            }
            if (message.type === 'connected') {
              console.log('[WebSocket] Handshake received');
              return;
            }
            
            // Chama callback com os dados
            if (message.data !== undefined) {
              onMessageRef.current(message.data);
            }
          } catch (err) {
            console.error('[WebSocket] Error parsing message:', err);
          }
        };

        ws.current.onerror = (event) => {
          console.error('[WebSocket] Error:', event);
          setError('WebSocket connection error');
          setIsConnected(false);
        };

        ws.current.onclose = (event) => {
          console.log(`[WebSocket] Disconnected (code: ${event.code})`);
          setIsConnected(false);
          ws.current = null;
          
          // Reconecta após 5 segundos se ainda estiver enabled
          if (shouldReconnectRef.current && !intentionalCloseRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[WebSocket] Attempting to reconnect...');
              connect();
            }, 5000);
          }
        };
      } catch (err) {
        console.error('[WebSocket] Connection error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    connect();

    // Cleanup
    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (ws.current) {
        console.log('[WebSocket] Closing connection');
        intentionalCloseRef.current = true;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [path, enabled]);

  /**
   * Envia uma mensagem pelo WebSocket
   */
  const send = (data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send: not connected');
    }
  };

  return { isConnected, error, send };
}
