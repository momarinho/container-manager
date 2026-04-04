import { Request, Response } from 'express';
import { authService } from '../../services/auth.service';
import { logger } from '../../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { LoginRequest } from '../../types/auth.types';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, apiToken } = req.body as LoginRequest;

    if (!username && !apiToken) {
      res.status(400).json({ error: 'Username/password or API token required' });
      return;
    }

    const isValid = authService.validateCredentials(username, password, apiToken);

    if (!isValid) {
      logger.warn('Failed login attempt');
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const userId = username || 'api-user';
    const token = authService.generateToken(userId, username || 'api-user');
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    res.json({
      token,
      expiresAt: Date.now() + parseExpiration(expiresIn),
      user: {
        id: userId,
        username: username || 'api-user',
      },
    });
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
