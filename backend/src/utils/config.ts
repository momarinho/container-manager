import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  CORS_ORIGIN: z.string().default('*'),

  DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock'),

  WS_PING_INTERVAL: z.string().default('30000').transform(Number),
  WS_PING_TIMEOUT: z.string().default('5000').transform(Number),

  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  STATS_UPDATE_INTERVAL: z.string().default('5000').transform(Number),
  STATS_HISTORY_SIZE: z.string().default('100').transform(Number),

  LOG_BUFFER_SIZE: z.string().default('100').transform(Number),
  LOG_FLUSH_INTERVAL: z.string().default('100').transform(Number),

  TERMINAL_IDLE_TIMEOUT: z.string().default('600000').transform(Number),
  TERMINAL_MAX_SESSIONS: z.string().default('10').transform(Number),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');
  parsedEnv.error.errors.forEach((err) => {
    console.error(`  ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

export const config = {
  port: parsedEnv.data.PORT,
  nodeEnv: parsedEnv.data.NODE_ENV,
  logLevel: parsedEnv.data.LOG_LEVEL,

  jwt: {
    secret: parsedEnv.data.JWT_SECRET,
    expiresIn: parsedEnv.data.JWT_EXPIRES_IN,
  },

  cors: {
    origin: parsedEnv.data.CORS_ORIGIN,
  },

  docker: {
    socketPath: parsedEnv.data.DOCKER_SOCKET_PATH,
  },

  websocket: {
    pingInterval: parsedEnv.data.WS_PING_INTERVAL,
    pingTimeout: parsedEnv.data.WS_PING_TIMEOUT,
  },

  rateLimit: {
    windowMs: parsedEnv.data.RATE_LIMIT_WINDOW_MS,
    maxRequests: parsedEnv.data.RATE_LIMIT_MAX_REQUESTS,
  },

  stats: {
    updateInterval: parsedEnv.data.STATS_UPDATE_INTERVAL,
    historySize: parsedEnv.data.STATS_HISTORY_SIZE,
  },

  logs: {
    bufferSize: parsedEnv.data.LOG_BUFFER_SIZE,
    flushInterval: parsedEnv.data.LOG_FLUSH_INTERVAL,
  },

  terminal: {
    idleTimeout: parsedEnv.data.TERMINAL_IDLE_TIMEOUT,
    maxSessions: parsedEnv.data.TERMINAL_MAX_SESSIONS,
  },
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
