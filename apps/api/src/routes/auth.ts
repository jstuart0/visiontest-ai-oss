// VisionTest.ai - Authentication Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { authLimiter, passwordResetLimiter, apiKeyLimiter } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/logout
 * Logout user
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.body.refreshToken;
    
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Refresh token is required' },
      });
    }

    const result = await authService.refresh(refreshToken);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/me
 * Get current user
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUser(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/password
 * Change password
 */
router.post('/password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    
    await authService.changePassword(req.user!.id, currentPassword, newPassword);

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.requestPasswordReset(email);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/reset-password/validate
 * Validate reset token
 */
router.get('/reset-password/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Reset token is required' },
      });
    }

    const result = await authService.validateResetToken(token);

    return res.json({
      success: true,
      data: { valid: result.valid },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/api-keys
 * List user's API keys
 */
router.get('/api-keys', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKeys = await authService.listApiKeys(req.user!.id);

    res.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/api-keys
 * Create new API key
 */
router.post('/api-keys', authenticate, apiKeyLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, scopes, expiresAt } = createApiKeySchema.parse(req.body);
    
    const apiKey = await authService.createApiKey(
      req.user!.id,
      name,
      scopes,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.status(201).json({
      success: true,
      data: apiKey,
      warning: 'Save this API key now. It will not be shown again.',
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /auth/api-keys/:id
 * Revoke API key
 */
router.delete('/api-keys/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.revokeApiKey(req.user!.id, req.params.id);

    res.json({
      success: true,
      data: { message: 'API key revoked' },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
