import { apiClient } from "./apiClient";

export interface TerminalOptions {
  shell?: string;
  cols?: number;
  rows?: number;
}

export const terminalService = {
  /**
   * Obtém lista de containers disponíveis para abrir terminal
   */
  async getAvailableContainers(): Promise<
    { id: string; name: string; image: string }[]
  > {
    const response = await apiClient.get("/containers", {
      params: { all: false },
    });
    return response.data.data.map((c: any) => ({
      id: c.id,
      name: c.names[0]?.replace(/^\//, "") || c.id.slice(0, 12),
      image: c.image,
    }));
  },

  /**
   * Obtém detalhes de um container específico
   */
  async getContainerDetails(containerId: string): Promise<any> {
    const response = await apiClient.get(`/containers/${containerId}`);
    return response.data.data;
  },
};
