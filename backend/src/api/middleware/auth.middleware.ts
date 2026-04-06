import { Request, Response, NextFunction } from 'express';
import { fail } from '../../utils/http';
import { verifyJwt } from '../../utils/jwt.util';

export interface AuthRequest extends Request {
  user?: { id: string; username: string; [k: string]: any };
}

export function jwtMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('Authorization') || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    fail(res, 401, 'AUTH_TOKEN_MISSING', 'Missing token');
    return;
  }
  const token = match[1];
  try {
    const payload = verifyJwt<{ userId: string; username: string }>(token);
    // payload expected to contain userId, username
    req.user = { id: payload.userId, username: payload.username };
    return next();
  } catch (err) {
    fail(res, 401, 'AUTH_TOKEN_INVALID', 'Invalid or expired token');
    return;
  }
}

// Export as alias for routes
export const authMiddleware = jwtMiddleware;
