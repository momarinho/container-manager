import { WebSocket } from 'ws';

export interface WebSocketWithSession extends WebSocket {
  isAlive?: boolean;
  authUser?: {
    id: string;
    username: string;
  };
  session?: {
    type: 'logs' | 'terminal' | 'stats';
    containerId?: string;
    sessionId?: string;
    unsubscribe?: () => void;
  };
}
