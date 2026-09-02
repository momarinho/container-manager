export interface DockerImageInfo {
  id: string;
  fullId: string;
  tags: string[];
  primaryTag: string;
  size: number;
  created: string;
}

export interface HubImageSearchResult {
  name: string;
  description: string;
  isOfficial: boolean;
  isAutomated: boolean;
  starCount: number;
}

export interface PullImagePayload {
  image: string;
}
