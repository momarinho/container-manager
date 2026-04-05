import jwt, { SignOptions } from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'your_secret_key';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export function signJwt(payload: object): string {
  const options: SignOptions = { expiresIn: EXPIRES_IN as any };
  return jwt.sign(payload, SECRET, options);
}

export function verifyJwt<T = any>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}
