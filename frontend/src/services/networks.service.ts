import { apiClient } from './apiClient';
import type { ApiSuccess } from '../../../shared/types/api';
import type {
  CreateNetworkPayload,
  DockerNetwork,
  PruneNetworksReport,
} from '../types/network.types';

export const networksService = {
  async list(): Promise<DockerNetwork[]> {
    const response = await apiClient.get<ApiSuccess<DockerNetwork[], { count: number }>>('/networks');
    return response.data.data;
  },

  async get(id: string): Promise<DockerNetwork> {
    const response = await apiClient.get<ApiSuccess<DockerNetwork>>(`/networks/${id}`);
    return response.data.data;
  },

  async create(payload: CreateNetworkPayload): Promise<DockerNetwork> {
    const response = await apiClient.post<ApiSuccess<DockerNetwork>>('/networks', payload);
    return response.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/networks/${id}`);
  },

  async connect(networkId: string, containerId: string, ipv4Address?: string): Promise<void> {
    await apiClient.post(`/networks/${networkId}/connect`, {
      containerId,
      ipv4Address,
    });
  },

  async disconnect(networkId: string, containerId: string, force?: boolean): Promise<void> {
    await apiClient.post(`/networks/${networkId}/disconnect`, {
      containerId,
      force,
    });
  },

  async prune(): Promise<PruneNetworksReport> {
    const response = await apiClient.post<ApiSuccess<PruneNetworksReport>>('/networks/prune');
    return response.data.data;
  },
};
