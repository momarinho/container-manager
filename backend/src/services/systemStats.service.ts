import * as si from 'systeminformation';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { dockerService } from './docker.service';
import type { SystemStats, SystemInfo } from '../types/system.types';

export class SystemStatsService {
  private history: SystemStats[] = [];
  private intervalId?: NodeJS.Timeout;
  private subscribers: Set<(stats: SystemStats) => void> = new Set();

  constructor() {
    this.startUpdates();
  }

  private async startUpdates(): Promise<void> {
    await this.updateStats();
    this.intervalId = setInterval(() => this.updateStats(), config.stats.updateInterval);
    logger.info(`System stats service started (interval: ${config.stats.updateInterval}ms)`);
  }

  private async updateStats(): Promise<void> {
    try {
      const [cpu, mem, fs, containers] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        dockerService.listContainers(true),
      ]);

      const mainDisk = fs.find((d) => d.mount === '/') || fs[0];

      const stats: SystemStats = {
        cpu: Math.round(cpu.currentLoad * 100) / 100,
        memory: Math.round((mem.used / mem.total) * 100 * 100) / 100,
        memoryUsed: this.formatBytes(mem.used),
        memoryTotal: this.formatBytes(mem.total),
        disk: Math.round((mainDisk.used / mainDisk.size) * 100 * 100) / 100,
        diskUsed: this.formatBytes(mainDisk.used),
        diskTotal: this.formatBytes(mainDisk.size),
        containers: {
          running: containers.filter((c) => c.state === 'running').length,
          stopped: containers.filter((c) => c.state === 'exited').length,
          paused: containers.filter((c) => c.state === 'paused').length,
          total: containers.length,
        },
        loadAvg: cpu.cpus.map((c) => Math.round(c.load * 100) / 100),
        uptime: process.uptime(),
      };

      this.history.push(stats);
      if (this.history.length > config.stats.historySize) {
        this.history.shift();
      }

      this.notifySubscribers(stats);
    } catch (error) {
      logger.error('Failed to update system stats:', error);
    }
  }

  getCurrentStats(): SystemStats {
    return this.history[this.history.length - 1] || this.getEmptyStats();
  }

  getHistory(limit?: number): SystemStats[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  subscribe(callback: (stats: SystemStats) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(stats: SystemStats): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(stats);
      } catch (error) {
        logger.error('Error notifying stats subscriber:', error);
      }
    });
  }

  private getEmptyStats(): SystemStats {
    return {
      cpu: 0,
      memory: 0,
      memoryUsed: '0 B',
      memoryTotal: '0 B',
      disk: 0,
      diskUsed: '0 B',
      diskTotal: '0 B',
      containers: {
        running: 0,
        stopped: 0,
        paused: 0,
        total: 0,
      },
      loadAvg: [0, 0, 0],
      uptime: 0,
    };
  }

  async getSystemInfo(): Promise<SystemInfo> {
    try {
      const [osInfo, cpuInfo, memInfo, dockerVersion] = await Promise.all([
        si.osInfo(),
        si.cpu(),
        si.mem(),
        this.getDockerVersion(),
      ]);

      return {
        hostname: osInfo.hostname,
        platform: osInfo.platform,
        arch: osInfo.arch,
        osType: osInfo.distro,
        osRelease: osInfo.release,
        nodeVersion: process.version,
        dockerVersion: dockerVersion.version,
        dockerApiVersion: dockerVersion.apiVersion,
        cpus: cpuInfo.cores,
        totalMem: memInfo.total,
      };
    } catch (error) {
      logger.error('Failed to get system info:', error);
      throw new Error('Failed to get system info');
    }
  }

  private async getDockerVersion(): Promise<{ version: string; apiVersion: string }> {
    try {
      const Docker = (await import('dockerode')).default;
      const getDockerSocketPath = (await import('../utils/dockerSocket')).getDockerSocketPath;
      const docker = new Docker({ socketPath: getDockerSocketPath() });
      const version = await docker.version();
      return {
        version: version.Version || 'unknown',
        apiVersion: version.ApiVersion || 'unknown',
      };
    } catch (error) {
      return { version: 'unknown', apiVersion: 'unknown' };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.subscribers.clear();
  }
}

export const systemStatsService = new SystemStatsService();
