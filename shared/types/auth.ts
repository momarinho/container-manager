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
  expiresAt: number;
  user: AuthUser;
}
