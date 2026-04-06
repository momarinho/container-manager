import { Request, Response } from 'express';
import { authService } from '../../services/auth.service';
import { logger } from '../../utils/logger';
import { verifyJwt } from '../../utils/jwt.util';
import { fail, ok } from '../../utils/http';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { LoginRequest } from '../../types/auth.types';
import type { LoginResponse } from '../../types/auth.types';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, apiToken } = req.body as LoginRequest;

    logger.info(`Login attempt - Username: ${username}, Has password: ${!!password}, Has API token: ${!!apiToken}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);

    if (!username && !apiToken) {
      logger.warn('Login failed: No credentials provided');
      fail(res, 400, 'AUTH_CREDENTIALS_REQUIRED', 'Username/password or API token required');
      return;
    }

    const isValid = await authService.validateCredentials(username, password, apiToken);

    logger.info(`Validation result for ${username}: ${isValid}`);

    if (!isValid) {
      logger.warn(`Failed login attempt for user: ${username}`);
      fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials');
      return;
    }

    const userId = username || 'api-user';
    const token = authService.generateToken(userId, username || 'api-user');
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const response: LoginResponse = {
      token,
      expiresAt: Date.now() + parseExpiration(expiresIn),
      user: {
        id: userId,
        username: username || 'api-user',
      },
    };

    logger.info(`Login successful for user: ${username}, Response: ${JSON.stringify(response)}`);

    ok(res, response);
  } catch (error) {
    logger.error('Login error:', error);
    fail(res, 500, 'AUTH_LOGIN_FAILED', 'Login failed');
  }
};

export const verify = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    ok(res, {
      valid: true,
      user: req.user,
    });
  } catch (error) {
    fail(res, 401, 'AUTH_TOKEN_INVALID', 'Invalid token');
  }
};

export const validate = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info(`Validate request - Method: ${req.method}, Headers: ${JSON.stringify(req.headers)}`);

    // Try to get token from body (POST) or header (GET)
    let token = req.body.token;

    if (!token && req.headers.authorization) {
      const match = req.headers.authorization.match(/^Bearer (.+)$/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      logger.warn('Validate failed: No token provided');
      fail(res, 400, 'AUTH_TOKEN_REQUIRED', 'Token required');
      return;
    }

    logger.info('Validating token...');
    const payload = verifyJwt<{ userId: string; username: string }>(token);
    logger.info(`Token valid for user: ${payload.username}`);

    const response = {
      valid: true,
      user: {
        id: payload.userId,
        username: payload.username,
      },
    };

    logger.info(`Validate successful: ${JSON.stringify(response)}`);
    ok(res, response);
  } catch (error) {
    logger.error('Validate error:', error);
    fail(res, 401, 'AUTH_TOKEN_INVALID', 'Invalid token');
  }
};

function parseExpiration(exp: string): number {
  const unit = exp.slice(-1);
  const value = parseInt(exp.slice(0, -1), 10);

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000,
  };

  return value * (multipliers[unit] || 3600000);
}
