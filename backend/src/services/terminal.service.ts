import * as pty from 'node-pty';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export interface TerminalSession {
  id: string;
  containerId: string;
  pty: pty.IPty;
  lastActivity: number;
}

export class TerminalService {
  private sessions: Map<string, TerminalSession>;
  private idleCheckInterval: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map();
    this.idleCheckInterval = setInterval(() => this.checkIdleSessions(), 60000);
    logger.info('Terminal service initialized');
  }

  async createSession(
    containerId: string,
    shell: string = '/bin/sh',
    cols: number = 80,
    rows: number = 24
  ): Promise<string> {
    if (this.sessions.size >= config.terminal.maxSessions) {
      throw new Error('Maximum terminal sessions reached');
    }

    const sessionId = `${containerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const ptyProcess = pty.spawn('docker', ['exec', '-it', containerId, shell], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME,
        env: process.env,
      });

      const session: TerminalSession = {
        id: sessionId,
        containerId,
        pty: ptyProcess,
        lastActivity: Date.now(),
      };

      this.sessions.set(sessionId, session);
      logger.info(`Created terminal session ${sessionId} for container ${containerId}`);

      return sessionId;
    } catch (error) {
      logger.error(`Failed to create terminal session for container ${containerId}:`, error);
      throw new Error('Failed to create terminal session');
    }
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }

    session.pty.write(data);
    session.lastActivity = Date.now();
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }

    session.pty.resize(cols, rows);
    session.lastActivity = Date.now();
  }

  onData(sessionId: string, callback: (data: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }

    session.pty.onData((data) => {
      session.lastActivity = Date.now();
      callback(data);
    });

    session.pty.onExit(({ exitCode, signal }) => {
      logger.info(`Terminal session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
      this.sessions.delete(sessionId);
      callback(`\r\n[Session closed. Exit code: ${exitCode}${signal ? `, Signal: ${signal}` : ''}]\r\n`);
    });
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(sessionId);
      logger.info(`Closed terminal session ${sessionId}`);
    }
  }

  private checkIdleSessions(): void {
    const now = Date.now();
    const idleTimeout = config.terminal.idleTimeout;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > idleTimeout) {
        logger.info(`Closing idle terminal session ${id}`);
        this.closeSession(id);
      }
    }
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  getSession(containerId: string): TerminalSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.containerId === containerId) {
        return session;
      }
    }
    return undefined;
  }

  destroy(): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
  }
}

export const terminalService = new TerminalService();
