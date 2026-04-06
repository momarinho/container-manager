import { apiClient } from "./apiClient";
import type { ApiSuccess } from "../../../shared/types/api";
import type { SystemStats, SystemInfo } from "../types/system.types";

export const systemService = {
  async getStats(): Promise<SystemStats> {
    const response = await apiClient.get<ApiSuccess<SystemStats>>("/system/stats");
    return response.data.data;
  },

  async getStatsHistory(limit?: number): Promise<SystemStats[]> {
    const params = limit ? { limit } : {};
    const response = await apiClient.get<ApiSuccess<SystemStats[]>>("/system/stats/history", {
      params,
    });
    return response.data.data;
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const response = await apiClient.get<ApiSuccess<SystemInfo>>("/system/info");
    return response.data.data;
  },
};
