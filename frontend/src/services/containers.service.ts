import { apiClient } from './apiClient';
import type { ApiSuccess } from '../../../shared/types/api';
import type { Container, ContainerStats } from '../types/container.types';

export const containersService = {
  /**
   * Lista todos os containers
   * @param params - Filtros opcionais (all, status, name)
   */
  async list(params?: {
    all?: boolean;
    status?: string;
    name?: string;
  }): Promise<Container[]> {
    const response = await apiClient.get<ApiSuccess<Container[], { count: number }>>('/containers', {
      params,
    });
    return response.data.data;
  },

  /**
   * Obtém detalhes de um container específico
   */
  async get(id: string): Promise<Container> {
    const response = await apiClient.get<ApiSuccess<Container>>(`/containers/${id}`);
    return response.data.data;
  },

  /**
   * Inicia um container
   */
  async start(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/start`);
  },

  /**
   * Para um container
   */
  async stop(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/stop`);
  },

  /**
   * Reinicia um container
   */
  async restart(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/restart`);
  },

  /**
   * Pausa um container
   */
  async pause(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/pause`);
  },

  /**
   * Despausa um container
   */
  async unpause(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/unpause`);
  },

  /**
   * Remove um container
   */
  async remove(id: string, force?: boolean): Promise<void> {
    const params = force ? { force: true } : {};
    await apiClient.delete(`/containers/${id}`, { params });
  },

  /**
   * Obtém estatísticas em tempo real de um container
   */
  async getStats(id: string): Promise<ContainerStats> {
    const response = await apiClient.get<ApiSuccess<ContainerStats>>(`/containers/${id}/stats`);
    return response.data.data;
  },
};
