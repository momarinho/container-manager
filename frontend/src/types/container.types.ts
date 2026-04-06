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

export interface ContainerDetails extends Container {
  hostConfig: {
    portBindings?: Record<string, { HostIp: string; HostPort: string }[]>;
    binds?: string[];
    restartPolicy?: {
      Name: string;
      MaximumRetryCount: number;
    };
  };
  config: {
    labels?: Record<string, string>;
    env?: string[];
    cmd?: string[];
    entrypoint?: string[];
    workingDir?: string;
    user?: string;
  };
  networkSettings: {
    networks?: Record<string, NetworkInfo>;
    ipAddress?: string;
    ipPrefixLen?: number;
    gateway?: string;
    bridge?: string;
  };
  mounts: Mount[];
}

export interface Port {
  IP?: string;
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
}

export interface NetworkInfo {
  IPAMConfig?: Record<string, string>;
  links?: string[];
  aliases?: string[];
  networkID: string;
  endpointID: string;
  gateway: string;
  ipAddress: string;
  ipPrefixLen: number;
  ipv6Gateway: string;
  globalIPv6Address: string;
  globalIPv6PrefixLen: number;
  macAddress: string;
}

export interface Mount {
  type: 'bind' | 'volume' | 'tmpfs';
  source?: string;
  destination: string;
  mode: string;
  rw: boolean;
  propagation: string;
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
