import type { ApiSuccess } from "../../../shared/types/api";
import type { DeployStackPayload, StackInfo } from "../types/stack.types";
import { apiClient } from "./apiClient";

export const stacksService = {
  async listStacks(): Promise<StackInfo[]> {
    const response = await apiClient.get<ApiSuccess<StackInfo[]>>("/stacks");
    return response.data.data;
  },

  async getStack(name: string): Promise<StackInfo> {
    const response = await apiClient.get<ApiSuccess<StackInfo>>(`/stacks/${name}`);
    return response.data.data;
  },

  async getStackCompose(name: string): Promise<string> {
    const response = await apiClient.get<ApiSuccess<{ name: string; composeYaml: string }>>(
      `/stacks/${name}/compose`
    );
    return response.data.data.composeYaml;
  },

  async deployStack(payload: DeployStackPayload): Promise<StackInfo> {
    const response = await apiClient.post<ApiSuccess<StackInfo>>("/stacks", payload);
    return response.data.data;
  },

  async upStack(name: string): Promise<StackInfo> {
    const response = await apiClient.post<ApiSuccess<StackInfo>>(`/stacks/${name}/up`);
    return response.data.data;
  },

  async downStack(name: string): Promise<StackInfo> {
    const response = await apiClient.post<ApiSuccess<StackInfo>>(`/stacks/${name}/down`);
    return response.data.data;
  },

  async deleteStack(name: string): Promise<void> {
    await apiClient.delete<ApiSuccess<{ name: string; deleted: boolean }>>(`/stacks/${name}`);
  },

  async getStackLogs(name: string, tail: number = 100): Promise<string> {
    const response = await apiClient.get<ApiSuccess<{ name: string; logs: string }>>(
      `/stacks/${name}/logs`,
      { params: { tail } }
    );
    return response.data.data.logs;
  },
};

export default stacksService;
