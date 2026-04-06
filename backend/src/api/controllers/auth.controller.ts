import { Request, Response } from 'express';
import { authService } from '../../services/auth.service';
import { logger } from '../../utils/logger';
import { verifyJwt } from '../../utils/jwt.util';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { LoginRequest } from '../../types/auth.types';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, apiToken } = req.body as LoginRequest;

    logger.info(`Login attempt - Username: ${username}, Has password: ${!!password}, Has API token: ${!!apiToken}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);

    if (!username && !apiToken) {
      logger.warn('Login failed: No credentials provided');
      res.status(400).json({ error: 'Username/password or API token required' });
      return;
    }

    const isValid = await authService.validateCredentials(username, password, apiToken);

    logger.info(`Validation result for ${username}: ${isValid}`);

    if (!isValid) {
      logger.warn(`Failed login attempt for user: ${username}`);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const userId = username || 'api-user';
    const token = authService.generateToken(userId, username || 'api-user');
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const response = {
      token,
      expiresAt: Date.now() + parseExpiration(expiresIn),
      user: {
        id: userId,
        username: username || 'api-user',
      },
    };

    logger.info(`Login successful for user: ${username}, Response: ${JSON.stringify(response)}`);

    res.json(response);
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const verify = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      valid: true,
      user: req.user,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
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
      res.status(400).json({ valid: false, error: 'Token required' });
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
    res.json(response);
  } catch (error) {
    logger.error('Validate error:', error);
    res.json({
      valid: false,
      error: 'Invalid token',
    });
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
