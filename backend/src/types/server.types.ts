export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerRequest {
  name: string;
  url: string;
}

export interface UpdateServerRequest {
  name?: string;
  url?: string;
  isDefault?: boolean;
}
