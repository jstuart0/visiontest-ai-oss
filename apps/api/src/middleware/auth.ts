// VisionTest AI - Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, User, Role } from '@visiontest/database';
import { UnauthorizedError, ForbiddenError } from './error';
import { logger } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User & { 
        orgId?: string;
        role?: Role;
      };
      apiKey?: {
        id: string;
        userId: string;
        scopes: string[];
      };
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-jwt-secret-do-not-use-in-production';
    }
    console.error('FATAL: JWT_SECRET environment variable must be set.');
    process.exit(1);
  }
  if (secret.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters long.');
    process.exit(1);
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Authenticate user via JWT or API key
 * Supports: Authorization header, X-API-Key header, or ?token= query param (for img tags)
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;
    const queryToken = req.query.token as string;

    // Try API key first
    if (apiKeyHeader) {
      const apiKey = await validateApiKey(apiKeyHeader);
      if (apiKey) {
        req.apiKey = apiKey;
        req.user = await prisma.user.findUnique({
          where: { id: apiKey.userId },
        }) as any;
        return next();
      }
    }

    // Try JWT from Authorization header
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (payload) {
        if (payload.type !== 'access') {
          return res.status(401).json({ success: false, error: 'Access token required' });
        }

        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (user) {
          req.user = user as any;
          return next();
        }
      }
    }

    // Try JWT from query param (for img tags that can't send headers)
    if (queryToken) {
      const payload = verifyToken(queryToken);

      if (payload) {
        if (payload.type !== 'access') {
          return res.status(401).json({ success: false, error: 'Access token required' });
        }

        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (user) {
          req.user = user as any;
          return next();
        }
      }
    }

    throw UnauthorizedError('Invalid or missing authentication');
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return next(UnauthorizedError('Invalid token'));
    }
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return next(UnauthorizedError('Token expired'));
    }
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no auth provided
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      
      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });
        if (user) {
          req.user = user as any;
        }
      }
    }
    next();
  } catch {
    // Silently continue without auth
    next();
  }
}

/**
 * Require specific roles
 */
export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(UnauthorizedError());
    }

    // Get user's role in the current organization context
    const orgId = req.params.orgId || req.body.orgId || req.query.orgId;
    
    if (!orgId) {
      return next(ForbiddenError('Organization context required'));
    }

    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user.id,
          orgId: orgId as string,
        },
      },
    });

    if (!membership) {
      return next(ForbiddenError('Not a member of this organization'));
    }

    if (!roles.includes(membership.role)) {
      return next(ForbiddenError(`Required role: ${roles.join(' or ')}`));
    }

    req.user.orgId = orgId as string;
    req.user.role = membership.role;
    next();
  };
}

/**
 * Require project access
 */
export async function requireProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next(UnauthorizedError());
  }

  const projectId = req.params.projectId || req.body.projectId || req.query.projectId;

  if (!projectId) {
    return next(ForbiddenError('Project context required'));
  }

  // Get project and verify org membership
  const project = await prisma.project.findUnique({
    where: { id: projectId as string },
    include: {
      org: {
        include: {
          users: {
            where: { userId: req.user.id },
          },
        },
      },
    },
  });

  if (!project) {
    return next(ForbiddenError('Project not found'));
  }

  if (project.org.users.length === 0) {
    return next(ForbiddenError('No access to this project'));
  }

  req.user.orgId = project.orgId;
  req.user.role = project.org.users[0].role;
  next();
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Generate JWT token
 */
export function generateToken(
  userId: string,
  email: string,
  type: 'access' | 'refresh' = 'access'
): string {
  const expiresIn = type === 'access' ? '1d' : '7d';
  
  return jwt.sign(
    { userId, email, type },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Validate API key
 */
async function validateApiKey(key: string): Promise<{
  id: string;
  userId: string;
  scopes: string[];
} | null> {
  try {
    // API keys are in format: vt_xxxxxxxx
    if (!key.startsWith('vt_')) {
      return null;
    }

    const bcrypt = await import('bcrypt');
    
    // Find by prefix (first 8 chars after vt_)
    const keyPrefix = key.substring(3, 11);
    
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(key, apiKey.keyHash);
      if (isValid) {
        // Update last used
        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          id: apiKey.id,
          userId: apiKey.userId,
          scopes: apiKey.scopes,
        };
      }
    }

    return null;
  } catch (error) {
    logger.error('API key validation error:', error);
    return null;
  }
}
