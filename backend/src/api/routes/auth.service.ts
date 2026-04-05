import bcrypt from 'bcrypt';
import { signJwt } from '../../utils/jwt.util';

// Example user store — replace with DB
const users = new Map<string, { id: string; username: string; passwordHash: string }>();

// Seed example (password: 'password123')
(async () => {
  const hash = await bcrypt.hash('password123', 10);
  users.set('alice', { id: 'u1', username: 'alice', passwordHash: hash });
})();

const apiTokens = (process.env.API_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);

export async function authenticateWithPassword(username: string, password: string) {
  const user = users.get(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, username: user.username };
}

export function authenticateWithApiToken(token: string) {
  // simple validation: token must be in configured list; could map to user
  if (apiTokens.includes(token)) return { id: 'api-user', username: 'api' };
  return null;
}

export function createAccessToken(user: { id: string; username: string }) {
  return signJwt({ sub: user.id, username: user.username });
}
