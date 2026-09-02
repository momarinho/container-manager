import { useQuery } from "@tanstack/react-query";
import { imagesService } from "../../services/images.service";
import type { DockerImageInfo, HubImageSearchResult } from "../../types/image.types";

export const IMAGES_QUERY_KEY = ["images"] as const;
export const HUB_SEARCH_QUERY_KEY = (query: string) => ["images", "search", query] as const;

export function useImagesQuery() {
  return useQuery<DockerImageInfo[]>({
    queryKey: IMAGES_QUERY_KEY,
    queryFn: () => imagesService.listImages(),
  });
}

export function useHubSearchQuery(query: string) {
  const trimmed = query.trim();
  return useQuery<HubImageSearchResult[]>({
    queryKey: HUB_SEARCH_QUERY_KEY(trimmed),
    queryFn: () => imagesService.searchHubImages(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 30000,
  });
}
