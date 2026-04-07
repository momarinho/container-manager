import type { Duplex } from "stream";
import Docker, { Exec } from "dockerode";
import { logger } from "../utils/logger";
import { config } from "../utils/config";
import { getDockerSocketPath } from "../utils/dockerSocket";

type TerminalListener = (data: string) => void;

export interface TerminalSession {
  id: string;
  containerId: string;
  exec: Exec;
  stream: Duplex;
  lastActivity: number;
  listeners: Set<TerminalListener>;
  closeListeners: Set<() => void>;
  bufferedOutput: string[];
}

export class TerminalService {
  private sessions: Map<string, TerminalSession>;
  private idleCheckInterval: NodeJS.Timeout;
  private docker: Docker;

  constructor() {
    this.sessions = new Map();
    this.idleCheckInterval = setInterval(() => this.checkIdleSessions(), 60000);

    const socketPath = getDockerSocketPath();
    this.docker = new Docker({ socketPath });

    logger.info(`Terminal service initialized with socket: ${socketPath}`);
  }

  async createSession(
    containerId: string,
    shell: string = "/bin/sh",
    cols: number = 80,
    rows: number = 24,
  ): Promise<string> {
    if (this.sessions.size >= config.terminal.maxSessions) {
      throw new Error("Maximum terminal sessions reached");
    }

    const container = this.docker.getContainer(containerId);
    const details = await container.inspect();

    if (!details.State?.Running) {
      throw new Error("Container is not running");
    }

    const sessionId = `${containerId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 11)}`;

    let lastError: Error | null = null;

    for (const candidate of this.getShellCandidates(shell)) {
      try {
        const exec = await container.exec({
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Cmd: [candidate],
        });

        const stream = (await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        })) as Duplex;

        const session: TerminalSession = {
          id: sessionId,
          containerId,
          exec,
          stream,
          lastActivity: Date.now(),
          listeners: new Set(),
          closeListeners: new Set(),
          bufferedOutput: [],
        };

        this.sessions.set(sessionId, session);
        this.attachStreamHandlers(session);

        // Resize immediately so the exec session matches the client terminal.
        await exec.resize({ h: rows, w: cols });

        logger.info(
          `Created terminal session ${sessionId} for container ${containerId} using shell ${candidate}`,
        );

        return sessionId;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("Failed to start terminal shell");

        logger.warn("Failed to start terminal shell", {
          containerId,
          shell: candidate,
          error: lastError.message,
        });
      }
    }

    throw new Error(lastError?.message ?? "Failed to create terminal session");
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal session not found");
    }

    session.stream.write(data);
    session.lastActivity = Date.now();
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal session not found");
    }

    session.lastActivity = Date.now();

    void session.exec.resize({ h: rows, w: cols }).catch((error) => {
      logger.warn(`Failed to resize terminal session ${sessionId}:`, error);
    });
  }

  onData(sessionId: string, callback: (data: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal session not found");
    }

    session.listeners.add(callback);

    if (session.bufferedOutput.length > 0) {
      for (const chunk of session.bufferedOutput) {
        callback(chunk);
      }
      session.bufferedOutput = [];
    }
  }

  onClose(sessionId: string, callback: () => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal session not found");
    }

    session.closeListeners.add(callback);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      session.stream.write("exit\n");
      session.stream.end();
    } catch {
      // Stream may already be closed; destroy below as a fallback.
    }

    setTimeout(() => {
      if (this.sessions.has(sessionId)) {
        session.stream.destroy();
      }
    }, 250);
    logger.info(`Requested close for terminal session ${sessionId}`);
  }

  private attachStreamHandlers(session: TerminalSession): void {
    let finalized = false;

    const finalize = async () => {
      if (finalized) {
        return;
      }

      finalized = true;

      const closeMessage = await this.getCloseMessage(session.exec);
      this.emit(session, closeMessage);
      this.notifyClosed(session);
      this.sessions.delete(session.id);
    };

    session.stream.on("data", (chunk: Buffer | string) => {
      session.lastActivity = Date.now();
      this.emit(session, chunk.toString());
    });

    session.stream.on("end", () => {
      void finalize();
    });

    session.stream.on("close", () => {
      void finalize();
    });

    session.stream.on("error", (error) => {
      logger.error(`Terminal session ${session.id} stream error:`, error);
      const message =
        error instanceof Error ? error.message : "Unknown terminal stream error";
      this.emit(session, `\r\n[Terminal error: ${message}]\r\n`);
      void finalize();
    });
  }

  private emit(session: TerminalSession, data: string): void {
    if (session.listeners.size === 0) {
      session.bufferedOutput.push(data);
      return;
    }

    for (const listener of session.listeners) {
      listener(data);
    }
  }

  private notifyClosed(session: TerminalSession): void {
    for (const listener of session.closeListeners) {
      try {
        listener();
      } catch (error) {
        logger.warn(`Failed to notify terminal close listener for ${session.id}:`, error);
      }
    }

    session.closeListeners.clear();
  }

  private getShellCandidates(shell: string): string[] {
    return [...new Set([shell, "/bin/sh", "sh", "/bin/bash", "bash"])];
  }

  private async getCloseMessage(exec: Exec): Promise<string> {
    try {
      const info = await exec.inspect();
      const exitCode =
        typeof info?.ExitCode === "number" ? info.ExitCode : "unknown";

      return `\r\n[Session closed. Exit code: ${exitCode}]\r\n`;
    } catch {
      return "\r\n[Session closed]\r\n";
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

    clearInterval(this.idleCheckInterval);
  }
}

export const terminalService = new TerminalService();
