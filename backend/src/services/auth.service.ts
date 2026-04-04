import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { JWTPayload, AuthConfig } from '../types/auth.types';

export class AuthService {
  private secret: string;
  private expiresIn: string;

  constructor(authConfig: AuthConfig) {
    this.secret = authConfig.secret;
    this.expiresIn = authConfig.expiresIn;
  }

  generateToken(userId: string, username: string): string {
    const payload: JWTPayload = {
      userId,
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiration(this.expiresIn),
    };

    return jwt.sign(payload, this.secret);
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret) as JWTPayload;
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  validateCredentials(username?: string, password?: string, apiToken?: string): boolean {
    // Simple authentication for MVP
    // In production, use proper user database or external auth provider
    const validApiToken = process.env.API_TOKEN;

    if (apiToken && validApiToken) {
      return apiToken === validApiToken;
    }

    if (username && password) {
      const validUsername = process.env.AUTH_USERNAME || 'admin';
      const validPassword = process.env.AUTH_PASSWORD || 'admin';

      return username === validUsername && password === validPassword;
    }

    return false;
  }

  private parseExpiration(exp: string): number {
    const unit = exp.slice(-1);
    const value = parseInt(exp.slice(0, -1), 10);

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
    };

    return value * (multipliers[unit] || 3600);
  }
}

export const authService = new AuthService({
  secret: config.jwt.secret,
  expiresIn: config.jwt.expiresIn,
});
