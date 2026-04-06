export interface SystemStats {
  cpu: number;
  memory: number;
  memoryUsed: string;
  memoryTotal: string;
  disk: number;
  diskUsed: string;
  diskTotal: string;
  containers: {
    running: number;
    stopped: number;
    paused: number;
    total: number;
  };
  loadAvg: number[];
  uptime: number;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  osType: string;
  osRelease: string;
  nodeVersion: string;
  dockerVersion: string;
  dockerApiVersion: string;
  cpus: number;
  totalMem: number;
}
