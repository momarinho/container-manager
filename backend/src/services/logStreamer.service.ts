import { logger } from '../utils/logger';
import { dockerService } from './docker.service';
import { config } from '../utils/config';

export interface LogStream {
  containerId: string;
  stream: NodeJS.ReadableStream & { destroy?: () => void; destroyed?: boolean };
  lastActivity: number;
  subscribers: Set<(data: string) => void>;
}

export class LogStreamerService {
  private streams: Map<string, LogStream>;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.streams = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupInactiveStreams(), 30000);
    logger.info('Log streamer service initialized');
  }

  async subscribe(containerId: string, callback: (data: string) => void): Promise<() => void> {
    let stream = this.streams.get(containerId);

    if (!stream || !this.isStreamActive(stream)) {
      await this.createStream(containerId);
      stream = this.streams.get(containerId);
    }

    if (stream) {
      stream.subscribers.add(callback);
      stream.lastActivity = Date.now();

      return () => this.unsubscribe(containerId, callback);
    }

    throw new Error('Failed to create log stream');
  }

  private unsubscribe(containerId: string, callback: (data: string) => void): void {
    const stream = this.streams.get(containerId);
    if (stream) {
      stream.subscribers.delete(callback);
      stream.lastActivity = Date.now();
    }
  }

  private async createStream(containerId: string): Promise<void> {
    try {
      const logStream = await dockerService.getContainerLogs(containerId, {
        follow: true,
        stdout: true,
        stderr: true,
        tail: '100',
      });

      const stream: LogStream = {
        containerId,
        stream: logStream,
        lastActivity: Date.now(),
        subscribers: new Set(),
      };

      let buffer = '';
      const bufferSize = config.logs.bufferSize;
      const flushInterval = config.logs.flushInterval;

      const flush = () => {
        if (buffer.length > 0) {
          const data = this.cleanLogData(buffer);
          this.notifySubscribers(containerId, data);
          buffer = '';
        }
      };

      const flushTimer = setInterval(flush, flushInterval);

      logStream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        stream.lastActivity = Date.now();

        const lines = buffer.split('\n');
        if (lines.length > bufferSize) {
          buffer = lines.slice(-bufferSize).join('\n');
          flush();
        }
      });

      logStream.on('end', () => {
        logger.info(`Log stream ended for container ${containerId}`);
        clearInterval(flushTimer);
        flush();
        this.streams.delete(containerId);
      });

      logStream.on('error', (error: any) => {
        logger.error(`Log stream error for container ${containerId}:`, error);
        clearInterval(flushTimer);
        this.streams.delete(containerId);
      });

      this.streams.set(containerId, stream);
      logger.info(`Created log stream for container ${containerId}`);
    } catch (error) {
      logger.error(`Failed to create log stream for container ${containerId}:`, error);
      throw error;
    }
  }

  private notifySubscribers(containerId: string, data: string): void {
    const stream = this.streams.get(containerId);
    if (stream) {
      stream.subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error notifying log subscriber:', error);
        }
      });
    }
  }

  private cleanupInactiveStreams(): void {
    const now = Date.now();
    const timeout = 120000; // 2 minutes

    for (const [containerId, stream] of this.streams.entries()) {
      if (now - stream.lastActivity > timeout && stream.subscribers.size === 0) {
        logger.info(`Cleaning up inactive log stream for container ${containerId}`);
        this.closeStream(containerId);
      }
    }
  }

  private closeStream(containerId: string): void {
    const stream = this.streams.get(containerId);
    if (stream && stream.stream.destroy) {
      stream.stream.destroy();
    }
    this.streams.delete(containerId);
  }

  private isStreamActive(stream: LogStream): boolean {
    return !stream.stream.destroyed;
  }

  private cleanLogData(data: string): string {
    // Docker logs include header bytes (8 bytes)
    // Format: [stream_type (1 byte), [3 bytes padding], size (4 bytes)] + payload
    let result = '';
    let i = 0;

    while (i < data.length) {
      if (i + 8 > data.length) break;

      const header = data.slice(i, i + 8);
      const size = header.charCodeAt(4) + header.charCodeAt(5) * 256 + header.charCodeAt(6) * 65536 + header.charCodeAt(7) * 16777216;

      i += 8;

      if (i + size > data.length) {
        break;
      }

      const payload = data.slice(i, i + size);
      result += payload;
      i += size;
    }

    return result;
  }

  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  getSubscriberCount(containerId: string): number {
    const stream = this.streams.get(containerId);
    return stream ? stream.subscribers.size : 0;
  }

  destroy(): void {
    for (const containerId of this.streams.keys()) {
      this.closeStream(containerId);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const logStreamerService = new LogStreamerService();
