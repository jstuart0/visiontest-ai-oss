// VisionTest.ai - Rate Limiting Middleware
//
// Route-class specific rate limiting:
// - Aggressive on auth endpoints
// - Moderate on mutation endpoints
// - Exempt for SSE/streaming/artifacts/health
//
// Uses Redis-backed store for distributed rate limiting across replicas.

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request } from 'express';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const rateLimitRedis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
rateLimitRedis.connect().catch(() => {});

function createRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      rateLimitRedis.call(args[0], ...args.slice(1)) as any,
    prefix: `rl:${prefix}:`,
  });
}

// Auth endpoints: 5 attempts per 15 min (production), 200 per 15 min (development)
const isDev = process.env.NODE_ENV !== 'production';
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 5,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts. Try again in 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'unknown',
  store: createRedisStore('auth'),
});

// Password reset: 3 attempts per hour per IP
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts. Try again in 1 hour.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('pwreset'),
});

// Mutation endpoints: 60 requests per minute (production), 500 (development)
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 60,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.id || req.ip || 'unknown',
  store: createRedisStore('mutation'),
});

// API key creation: 10 per hour
export const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'API key creation rate limited.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('apikey'),
});
