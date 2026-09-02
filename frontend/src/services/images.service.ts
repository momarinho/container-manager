import type { ApiSuccess } from "../../../shared/types/api";
import type {
  DockerImageInfo,
  HubImageSearchResult,
  PullImagePayload,
} from "../types/image.types";
import { apiClient } from "./apiClient";

export const imagesService = {
  async listImages(): Promise<DockerImageInfo[]> {
    const response = await apiClient.get<ApiSuccess<DockerImageInfo[]>>("/images");
    return response.data.data;
  },

  async searchHubImages(query: string): Promise<HubImageSearchResult[]> {
    const response = await apiClient.get<ApiSuccess<HubImageSearchResult[]>>(
      "/images/search",
      { params: { query } }
    );
    return response.data.data;
  },

  async pullImage(payload: PullImagePayload): Promise<{ image: string; pulled: boolean }> {
    const response = await apiClient.post<
      ApiSuccess<{ image: string; pulled: boolean }>
    >("/images/pull", payload);
    return response.data.data;
  },

  async removeImage(imageId: string, force: boolean = false): Promise<void> {
    await apiClient.delete(`/images/${encodeURIComponent(imageId)}`, {
      params: { force },
    });
  },
};

export default imagesService;
