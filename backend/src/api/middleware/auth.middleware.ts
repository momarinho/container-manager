import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../../utils/jwt.util';

export interface AuthRequest extends Request {
  user?: { id: string; username: string; [k: string]: any };
}

export function jwtMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('Authorization') || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Missing token' });
  const token = match[1];
  try {
    const payload = verifyJwt(token);
    // payload expected to contain userId, username
    req.user = { id: (payload as any).userId, username: (payload as any).username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Export as alias for routes
export const authMiddleware = jwtMiddleware;
