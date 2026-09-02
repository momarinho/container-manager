export interface AuthUser {
  id: string;
  username: string;
}

export interface LoginCredentials {
  username?: string;
  password?: string;
  apiToken?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  expiresAt: number;
  user: AuthUser;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}
