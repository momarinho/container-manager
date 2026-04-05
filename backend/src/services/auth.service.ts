import bcrypt from 'bcrypt';
import { signJwt, verifyJwt } from '../utils/jwt.util';
import { logger } from '../utils/logger';

// Example user store — replace with DB
const users = new Map<string, { id: string; username: string; passwordHash: string }>();
// Seed example (password: 'password123')
(async () => {
  const hash = await bcrypt.hash('password123', 10);
  users.set('alice', { id: 'u1', username: 'alice', passwordHash: hash });
})();

const apiTokens = (process.env.API_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);

export const authService = {
  validateCredentials: async (username?: string, password?: string, apiToken?: string): Promise<boolean> => {
    if (apiToken) {
      return apiTokens.includes(apiToken);
    }
    if (username && password) {
      const user = users.get(username);
      if (!user) return false;
      const ok = await bcrypt.compare(password, user.passwordHash);
      return ok;
    }
    return false;
  },

  generateToken: (userId: string, username: string): string => {
    return signJwt({ userId, username });
  },

  verifyToken: (_token: string): { userId: string; username: string } | null => {
    try {
      const payload = verifyJwt<{ userId: string; username: string }>(_token);
      return { userId: payload.userId, username: payload.username };
    } catch (err) {
      logger.error('Token verification failed:', err);
      return null;
    }
  },
};
