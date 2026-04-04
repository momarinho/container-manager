import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { authService } from '../services/auth.service';
import { logStreamerService } from '../services/logStreamer.service';
import { terminalService } from '../services/terminal.service';
import { systemStatsService } from '../services/systemStats.service';

export class WebSocketHandler {
  private wss: WebSocketServer;

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.setupConnectionHandler();
    logger.info('WebSocket handler initialized');
  }

  private setupConnectionHandler(): void {
    this.wss.on('connection', (ws: WebSocket & { isAlive?: boolean; session?: any }, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const path = url.pathname;
      const token = url.searchParams.get('token');

      // Check authentication
      if (!token) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
        ws.close(1008, 'Authentication required');
        return;
      }

      try {
        const payload = authService.verifyToken(token);
        logger.info(`WebSocket connection established: ${path} for user ${payload.username}`);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        ws.close(1008, 'Invalid token');
        return;
      }

      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Route based on path
      if (path.startsWith('/ws/logs/')) {
        this.handleLogsConnection(ws, path);
      } else if (path.startsWith('/ws/terminal/')) {
        this.handleTerminalConnection(ws, path);
      } else if (path === '/ws/stats') {
        this.handleStatsConnection(ws);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown endpoint' }));
        ws.close(1002, 'Unknown endpoint');
      }

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });

      ws.on('close', () => {
        this.handleClose(ws);
      });
    });

    // Heartbeat
    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });
  }

  private handleLogsConnection(ws: WebSocket, path: string): void {
    const containerId = path.split('/')[3];

    if (!containerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Container ID required' }));
      ws.close(1002, 'Container ID required');
      return;
    }

    const unsubscribe = logStreamerService.subscribe(containerId, (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'log', containerId, data }));
      }
    });

    ws.session = { type: 'logs', containerId, unsubscribe };

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleLogsMessage(ws, data);
      } catch (error) {
        logger.error('Failed to parse logs message:', error);
      }
    });

    ws.send(JSON.stringify({ type: 'connected', containerId }));
  }

  private handleLogsMessage(ws: WebSocket, data: any): void {
    if (data.action === 'unsubscribe') {
      const session = ws.session;
      if (session && session.unsubscribe) {
        session.unsubscribe();
        ws.send(JSON.stringify({ type: 'unsubscribed' }));
      }
    }
  }

  private handleTerminalConnection(ws: WebSocket, path: string): void {
    const containerId = path.split('/')[3];

    if (!containerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Container ID required' }));
      ws.close(1002, 'Container ID required');
      return;
    }

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleTerminalMessage(ws, containerId, data);
      } catch (error) {
        logger.error('Failed to parse terminal message:', error);
      }
    });

    ws.send(JSON.stringify({ type: 'ready', message: 'Send shell command to start session' }));
  }

  private async handleTerminalMessage(ws: WebSocket, containerId: string, data: any): void {
    const session = ws.session;

    if (data.type === 'start' && !session) {
      const { shell = '/bin/sh', cols = 80, rows = 24 } = data;
      try {
        const sessionId = await terminalService.createSession(containerId, shell, cols, rows);

        terminalService.onData(sessionId, (output) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: output }));
          }
        });

        ws.session = { type: 'terminal', containerId, sessionId };
        ws.send(JSON.stringify({ type: 'started', sessionId }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
        ws.close(1011, (error as Error).message);
      }
    } else if (data.type === 'input' && session) {
      terminalService.write(session.sessionId, data.data);
    } else if (data.type === 'resize' && session) {
      terminalService.resize(session.sessionId, data.cols, data.rows);
    } else if (data.type === 'close' && session) {
      terminalService.closeSession(session.sessionId);
      ws.send(JSON.stringify({ type: 'closed' }));
    }
  }

  private handleStatsConnection(ws: WebSocket): void {
    const unsubscribe = systemStatsService.subscribe((stats) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stats', data: stats }));
      }
    });

    ws.session = { type: 'stats', unsubscribe };
    ws.send(JSON.stringify({ type: 'connected' }));
  }

  private handleClose(ws: WebSocket): void {
    const session = ws.session;

    if (session) {
      if (session.unsubscribe) {
        session.unsubscribe();
      }
      if (session.type === 'terminal' && session.sessionId) {
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
