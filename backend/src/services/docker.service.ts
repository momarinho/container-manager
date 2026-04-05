import Docker, { type ContainerInfo, type ContainerInspectInfo, type ContainerStats as DockerContainerStats } from 'dockerode';
import { getDockerSocketPath } from '../utils/dockerSocket';
import { logger } from '../utils/logger';
import type { Container, ContainerDetails, ContainerStats, LogOptions } from '../types/container.types';

export class DockerService {
  private docker: Docker;

  constructor() {
    const socketPath = getDockerSocketPath();
    this.docker = new Docker({ socketPath });
    logger.info(`Docker service initialized with socket: ${socketPath}`);
  }

  async listContainers(all = false): Promise<Container[]> {
    try {
      const containers = await this.docker.listContainers({ all });
      return containers.map(this.transformContainer);
    } catch (error) {
      logger.error('Failed to list containers:', error);
      throw new Error('Failed to list containers');
    }
  }

  async getContainer(id: string): Promise<ContainerDetails> {
    try {
      const container = this.docker.getContainer(id);
      const details = await container.inspect();
      return this.transformContainerDetails(details);
    } catch (error) {
      logger.error(`Failed to get container ${id}:`, error);
      throw new Error('Container not found');
    }
  }

  async startContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.start();
      logger.info(`Started container ${id}`);
    } catch (error) {
      logger.error(`Failed to start container ${id}:`, error);
      throw new Error('Failed to start container');
    }
  }

  async stopContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.stop({ t: 10 });
      logger.info(`Stopped container ${id}`);
    } catch (error) {
      logger.error(`Failed to stop container ${id}:`, error);
      throw new Error('Failed to stop container');
    }
  }

  async restartContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.restart({ t: 10 });
      logger.info(`Restarted container ${id}`);
    } catch (error) {
      logger.error(`Failed to restart container ${id}:`, error);
      throw new Error('Failed to restart container');
    }
  }

  async pauseContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.pause();
      logger.info(`Paused container ${id}`);
    } catch (error) {
      logger.error(`Failed to pause container ${id}:`, error);
      throw new Error('Failed to pause container');
    }
  }

  async unpauseContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.unpause();
      logger.info(`Unpaused container ${id}`);
    } catch (error) {
      logger.error(`Failed to unpause container ${id}:`, error);
      throw new Error('Failed to unpause container');
    }
  }

  async removeContainer(id: string, force = false): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.remove({ force, v: true });
      logger.info(`Removed container ${id}`);
    } catch (error) {
      logger.error(`Failed to remove container ${id}:`, error);
      throw new Error('Failed to remove container');
    }
  }

  async getContainerStats(id: string): Promise<ContainerStats> {
    try {
      const container = this.docker.getContainer(id);
      const stats = await container.stats({ stream: false });
      return this.transformStats(stats, id);
    } catch (error) {
      logger.error(`Failed to get stats for container ${id}:`, error);
      throw new Error('Failed to get container stats');
    }
  }

  async getContainerLogs(
    id: string,
    options: LogOptions = {}
  ): Promise<any> {
    try {
      const container = this.docker.getContainer(id);
      return await container.logs(options as any);
    } catch (error) {
      logger.error(`Failed to get logs for container ${id}:`, error);
      throw new Error('Failed to get container logs');
    }
  }

  async execInContainer(
    id: string,
    cmd: string[],
    env: Record<string, string> = {}
  ): Promise<{ exitCode: number; output: string }> {
    try {
      const container = this.docker.getContainer(id);
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      });

      const stream = await exec.start({ Detach: false });

      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString();
        });

        stream.on('end', async () => {
          const info = await exec.inspect();
          resolve({ exitCode: info.ExitCode || 0, output });
        });

        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to exec in container ${id}:`, error);
      throw new Error('Failed to execute command in container');
    }
  }

  private transformContainer(dockerContainer: ContainerInfo): Container {
    return {
      id: dockerContainer.Id,
      names: dockerContainer.Names.map((n: string) => n.replace(/^\//, '')),
      image: dockerContainer.Image,
      imageId: dockerContainer.ImageID,
      command: dockerContainer.Command,
      created: dockerContainer.Created,
      state: dockerContainer.State,
      status: dockerContainer.Status,
      ports: (dockerContainer.Ports || []).map((p: any) => ({
        IP: p.IP,
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type as 'tcp' | 'udp',
      })),
      labels: dockerContainer.Labels || {},
    };
  }

  private transformContainerDetails(dockerDetails: ContainerInspectInfo): ContainerDetails {
    const container = this.transformContainer({
      Id: dockerDetails.Id,
      Names: dockerDetails.Name ? [dockerDetails.Name.replace(/^\//, '')] : [],
      Image: dockerDetails.Config?.Image || '',
      ImageID: dockerDetails.Image || '',
      Command: dockerDetails.Config?.Cmd?.join(' ') || '',
      Created: Math.floor(new Date(dockerDetails.Created).getTime() / 1000),
      State: dockerDetails.State?.Status || '',
      Status: dockerDetails.State?.Status || '',
      Ports: [],
      Labels: dockerDetails.Config?.Labels || {},
      SizeRw: 0,
      SizeRootFs: 0,
      HostConfig: { NetworkMode: '' },
      NetworkSettings: { Networks: {} },
      Mounts: [],
    } as any);

    return {
      ...container,
      hostConfig: {
        portBindings: dockerDetails.HostConfig?.PortBindings as any,
        binds: dockerDetails.HostConfig?.Binds,
        restartPolicy: dockerDetails.HostConfig?.RestartPolicy as any,
      },
      config: {
        labels: dockerDetails.Config?.Labels,
        env: dockerDetails.Config?.Env,
        cmd: dockerDetails.Config?.Cmd,
        entrypoint: dockerDetails.Config?.Entrypoint as any,
        workingDir: dockerDetails.Config?.WorkingDir,
        user: dockerDetails.Config?.User,
      },
      networkSettings: {
        networks: dockerDetails.NetworkSettings?.Networks as any,
        ipAddress: (dockerDetails.NetworkSettings as any)?.IPAddress,
        ipPrefixLen: (dockerDetails.NetworkSettings as any)?.IPPrefixLen,
        gateway: (dockerDetails.NetworkSettings as any)?.Gateway,
      },
      mounts: (dockerDetails.Mounts || []).map((m: any) => ({
        type: m.Type as 'bind' | 'volume' | 'tmpfs',
        source: m.Source,
        destination: m.Destination,
        mode: m.Mode,
        rw: m.RW,
        propagation: m.Propagation,
      })),
    };
  }

  private transformStats(dockerStats: DockerContainerStats, id: string): ContainerStats {
    const cpuDelta = dockerStats.cpu_stats.cpu_usage.total_usage - dockerStats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = dockerStats.cpu_stats.system_cpu_usage - dockerStats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 * dockerStats.cpu_stats.online_cpus : 0;

    const memoryUsage = (dockerStats.memory_stats.usage as number) || 0;
    const memoryLimit = (dockerStats.memory_stats.limit as number) || 0;
    const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

    const networks = Object.values(dockerStats.networks || {}) as any[];
    const network = networks.reduce(
      (acc: { rx: number; tx: number }, n: any) => ({
        rx: acc.rx + (n.rx_bytes || 0),
        tx: acc.tx + (n.tx_bytes || 0),
      }),
      { rx: 0, tx: 0 }
    );

    const ioStats = dockerStats.blkio_stats?.io_service_bytes_recursive || [];
    const blockRead = ioStats
      .filter((io: any) => io.op === 'Read')
      .reduce((sum: number, io: any) => sum + (io.value || 0), 0);
    const blockWrite = ioStats
      .filter((io: any) => io.op === 'Write')
      .reduce((sum: number, io: any) => sum + (io.value || 0), 0);

    return {
      name: dockerStats.name || '',
      id,
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsage,
      memoryLimit,
      memoryPercent: Math.round(memoryPercent * 100) / 100,
      netRx: network.rx,
      netTx: network.tx,
      blockRead,
      blockWrite,
    };
  }
}

export const dockerService = new DockerService();
