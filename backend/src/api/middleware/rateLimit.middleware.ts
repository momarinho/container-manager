import rateLimit from 'express-rate-limit';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(config.rateLimit.windowMs / 1000),
    });
  },
});

export const createAuthRateLimit = (maxRequests: number) => {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: maxRequests,
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: 'Too many login attempts',
        retryAfter: Math.round(config.rateLimit.windowMs / 1000),
      });
    },
  });
};

export const authRateLimit = createAuthRateLimit(5);
