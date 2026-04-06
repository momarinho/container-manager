import type { AuthResponse, LoginCredentials } from '../../../shared/types/auth';

export type LoginRequest = LoginCredentials;
export type LoginResponse = AuthResponse;

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
