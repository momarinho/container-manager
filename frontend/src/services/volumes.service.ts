import { apiClient } from './apiClient';
import type { ApiSuccess } from '../../../shared/types/api';
import type {
  CreateVolumePayload,
  DockerVolume,
  PruneVolumesReport,
} from '../types/volume.types';

export const volumesService = {
  async list(): Promise<DockerVolume[]> {
    const response = await apiClient.get<ApiSuccess<DockerVolume[], { count: number }>>('/volumes');
    return response.data.data;
  },

  async get(name: string): Promise<DockerVolume> {
    const response = await apiClient.get<ApiSuccess<DockerVolume>>(`/volumes/${name}`);
    return response.data.data;
  },

  async create(payload: CreateVolumePayload): Promise<DockerVolume> {
    const response = await apiClient.post<ApiSuccess<DockerVolume>>('/volumes', payload);
    return response.data.data;
  },

  async remove(name: string, force?: boolean): Promise<void> {
    await apiClient.delete(`/volumes/${name}`, { params: { force } });
  },

  async prune(): Promise<PruneVolumesReport> {
    const response = await apiClient.post<ApiSuccess<PruneVolumesReport>>('/volumes/prune');
    return response.data.data;
  },
};
