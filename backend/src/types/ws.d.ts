import { WebSocket } from 'ws';

export interface WebSocketWithSession extends WebSocket {
  isAlive?: boolean;
  session?: {
    type: 'logs' | 'terminal' | 'stats';
    containerId?: string;
    sessionId?: string;
    unsubscribe?: () => void;
  };
}
