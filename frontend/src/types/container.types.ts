export interface Container {
  id: string;
  names: string[];
  image: string;
  imageId: string;
  command: string;
  created: number;
  state: string;
  status: string;
  ports: Port[];
  labels: Record<string, string>;
}

export interface Port {
  IP?: string;
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
}

export interface ContainerStats {
  name: string;
  id: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
}
