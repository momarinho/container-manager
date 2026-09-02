export type StackStatus = "running" | "partially_running" | "stopped";

export interface StackContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  labels?: Record<string, string>;
}

export interface StackInfo {
  name: string;
  status: StackStatus;
  servicesCount: number;
  services: string[];
  containersCount: number;
  containers: StackContainerInfo[];
  hasComposeFile: boolean;
  createdAt?: number | null;
  composeYaml?: string | null;
}

export interface DeployStackPayload {
  name: string;
  composeYaml: string;
  envVars?: Record<string, string>;
}
