import type { ApiSuccess } from "../../../shared/types/api";
import type {
  TunnelConnectPayload,
  TunnelStatus,
} from "../types/tunnel.types";
import { apiClient } from "./apiClient";

export const tunnelService = {
  async getStatus(): Promise<TunnelStatus> {
    const response = await apiClient.get<ApiSuccess<TunnelStatus>>("/tunnel/status");
    return response.data.data;
  },

  async connect(payload: TunnelConnectPayload): Promise<TunnelStatus> {
    const response = await apiClient.post<ApiSuccess<TunnelStatus>>(
      "/tunnel/connect",
      payload,
    );
    return response.data.data;
  },

  async disconnect(): Promise<TunnelStatus> {
    const response = await apiClient.post<ApiSuccess<TunnelStatus>>(
      "/tunnel/disconnect",
    );
    return response.data.data;
  },
};
