export interface NetworkConnectedContainer {
  id: string;
  name: string;
  ipv4Address: string;
}

export interface DockerNetwork {
  id: string;
  fullId: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  attachable: boolean;
  subnet: string;
  gateway: string;
  labels: Record<string, string>;
  containers: NetworkConnectedContainer[];
  containerCount: number;
  created: string;
}

export interface CreateNetworkPayload {
  name: string;
  driver?: string;
  internal?: boolean;
  attachable?: boolean;
  labels?: Record<string, string>;
  subnet?: string;
  gateway?: string;
}

export interface PruneNetworksReport {
  networksDeleted: string[];
}
