export type TunnelProvider = "tailscale" | "wireguard";

export type TunnelState =
  | "connected"
  | "connecting"
  | "disconnected"
  | "needs_login"
  | "error";

export interface TunnelStatus {
  provider: TunnelProvider;
  state: TunnelState;
  connected: boolean;
  needsLogin: boolean;
  backendState: string;
  hostname: string | null;
  magicDnsName: string | null;
  tailnet: string | null;
  ip: string | null;
  health: string[];
  updatedAt: number;
}

export interface TunnelConnectPayload {
  provider: TunnelProvider;
  authKey?: string;
  hostname?: string;
}
