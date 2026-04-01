// VisionTest.ai - Error Handling Middleware

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@visiontest/database';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common errors
export const BadRequestError = (message: string, details?: Record<string, unknown>) =>
  new AppError(message, 400, 'BAD_REQUEST', details);

export const UnauthorizedError = (message: string = 'Unauthorized') =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const ForbiddenError = (message: string = 'Forbidden') =>
  new AppError(message, 403, 'FORBIDDEN');

export const NotFoundError = (resource: string = 'Resource') =>
  new AppError(`${resource} not found`, 404, 'NOT_FOUND');

export const ConflictError = (message: string) =>
  new AppError(message, 409, 'CONFLICT');

export const ValidationError = (details: Record<string, unknown>) =>
  new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);

export const RateLimitError = () =>
  new AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');

// Not found handler
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  next(NotFoundError(`Route ${req.method} ${req.path}`));
}

// Sensitive field redaction for error logs
const SENSITIVE_FIELDS = new Set([
  'password', 'passwordHash', 'currentPassword', 'newPassword',
  'token', 'apiKey', 'secret', 'refreshToken', 'accessToken',
  'encryptedToken', 'authorization',
]);

function redactSensitiveFields(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    redacted[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  return redacted;
}

// Error handler
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error({
    err,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    body: redactSensitiveFields(req.body),
    user: (req as any).user?.id,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          errors: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    });
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          details: { fields: err.meta?.target },
        },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
        },
      });
    }
  }

  // Handle operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle unknown errors
  const statusCode = 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}
