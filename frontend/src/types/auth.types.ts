export interface LoginCredentials {
  username?: string;
  password?: string;
  apiToken?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthResponse["user"] | null;
  server: ServerConfig | null;
  isLoading: boolean;
}

export type AuthAction =
  | {
      type: "LOGIN_SUCCESS";
      payload: {
        token: string;
        user: AuthResponse["user"];
        server: ServerConfig;
      };
    }
  | {
      type: "LOGOUT";
    }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SERVER"; payload: ServerConfig };
