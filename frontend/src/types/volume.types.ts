export interface VolumeUsedBy {
  id: string;
  name: string;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  labels: Record<string, string>;
  scope: string;
  options: Record<string, string>;
  usedBy: VolumeUsedBy[];
  inUse: boolean;
}

export interface CreateVolumePayload {
  name?: string;
  driver?: string;
  driverOpts?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface PruneVolumesReport {
  volumesDeleted: string[];
  spaceReclaimed: number;
}
