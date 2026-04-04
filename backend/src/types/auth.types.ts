export interface LoginRequest {
  username?: string;
  password?: string;
  apiToken?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  user?: {
    id: string;
    username: string;
  };
}

export interface JWTPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

export interface AuthConfig {
  secret: string;
  expiresIn: string;
}
