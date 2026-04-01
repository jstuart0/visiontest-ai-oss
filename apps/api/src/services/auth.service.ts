// VisionTest.ai - Authentication Service
// Hospital-Grade Security

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma, User, Role } from '@visiontest/database';
import { generateToken, JWTPayload, verifyToken } from '../middleware/auth';
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../middleware/error';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = 12; // Hospital-grade: higher rounds for better security
const API_KEY_PREFIX = 'vt_';
const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  key: string; // Only returned once!
  scopes: string[];
  createdAt: Date;
}

class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const { email, password, name } = input;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw BadRequestError('Invalid email format');
    }

    // Validate password strength (hospital-grade requirements)
    this.validatePassword(password);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw ConflictError('Registration failed. Please try again or use a different email.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user and default organization in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          emailVerified: false, // In production, require email verification
        },
      });

      // Create default organization
      const orgSlug = this.generateSlug(name || email);
      const org = await tx.organization.create({
        data: {
          name: name ? `${name}'s Workspace` : `My Workspace`,
          slug: await this.ensureUniqueSlug(tx, orgSlug),
        },
      });

      // Add user as owner
      await tx.organizationUser.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: Role.OWNER,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          orgId: org.id,
          userId: user.id,
          action: 'user.registered',
          resource: 'user',
          resourceId: user.id,
          details: { email: user.email },
        },
      });

      return user;
    });

    // Generate tokens
    const accessToken = generateToken(result.id, result.email, 'access');
    const refreshToken = generateToken(result.id, result.email, 'refresh');

    // Create session
    await prisma.session.create({
      data: {
        userId: result.id,
        token: await this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    logger.info(`User registered: ${result.email}`);

    return {
      user: this.sanitizeUser(result),
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthResult> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Use same error message to prevent user enumeration
      throw UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      logger.warn(`Failed login attempt for: ${email}`);
      throw UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateToken(user.id, user.email, 'access');
    const refreshToken = generateToken(user.id, user.email, 'refresh');

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: await this.hashToken(refreshToken),
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
    };
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = await this.hashToken(refreshToken);
    
    await prisma.session.deleteMany({
      where: { token: tokenHash },
    });

    logger.info('User logged out');
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    // Verify refresh token
    const payload = verifyToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      throw UnauthorizedError('Invalid refresh token');
    }

    // Check session exists
    const tokenHash = await this.hashToken(refreshToken);
    const session = await prisma.session.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw UnauthorizedError('Session expired or invalid');
    }

    // Generate new access token
    const accessToken = generateToken(payload.userId, payload.email, 'access');

    return {
      accessToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
    };
  }

  /**
   * Get current user
   */
  async getUser(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    return user ? this.sanitizeUser(user) : null;
  }

  /**
   * Create API key
   */
  async createApiKey(
    userId: string,
    name: string,
    scopes: string[] = ['read', 'write'],
    expiresAt?: Date
  ): Promise<ApiKeyResult> {
    // Generate secure random key
    const keyBytes = crypto.randomBytes(32);
    const key = `${API_KEY_PREFIX}${keyBytes.toString('hex')}`;
    const keyPrefix = key.substring(3, 11);

    // Hash the full key for storage
    const keyHash = await bcrypt.hash(key, BCRYPT_ROUNDS);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyPrefix,
        keyHash,
        scopes,
        expiresAt,
      },
    });

    logger.info(`API key created for user ${userId}: ${name}`);

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      key, // Only returned once!
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * List user's API keys
   */
  async listApiKeys(userId: string) {
    return prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw NotFoundError('API key');
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    logger.info(`API key revoked: ${keyId}`);
  }

  /**
   * Request password reset (generates token and sends email)
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return { success: true, message: 'If an account exists, a reset email will be sent' };
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY);

    // Store reset token in session table with special type
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `reset:${tokenHash}`,
        expiresAt,
      },
    });

    // Send reset email (in production, use proper email service)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    logger.info(`Password reset token generated for: ${email}`);
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Reset URL (dev only): ${resetUrl}`);
    }

    // If email service is configured, send the email
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    if (emailServiceUrl) {
      try {
        await this.sendResetEmail(email, resetUrl, user.name);
      } catch (error) {
        logger.error('Failed to send reset email:', error);
        // Don't fail the request, user can retry
      }
    }

    return { success: true, message: 'If an account exists, a reset email will be sent' };
  }

  /**
   * Validate password reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await prisma.session.findFirst({
      where: {
        token: `reset:${tokenHash}`,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return { valid: false };
    }

    return { valid: true, userId: session.userId };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    const validation = await this.validateResetToken(token);

    if (!validation.valid || !validation.userId) {
      throw BadRequestError('Invalid or expired reset token');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and invalidate all sessions
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: validation.userId },
        data: { passwordHash },
      });

      // Delete all sessions including reset tokens
      await tx.session.deleteMany({
        where: { userId: validation.userId },
      });
    });

    logger.info(`Password reset completed for user: ${validation.userId}`);

    return { success: true };
  }

  /**
   * Send password reset email
   */
  private async sendResetEmail(
    email: string,
    resetUrl: string,
    userName?: string | null
  ): Promise<void> {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    if (!emailServiceUrl) return;

    const response = await fetch(`${emailServiceUrl}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EMAIL_SERVICE_TOKEN || ''}`,
      },
      body: JSON.stringify({
        to: email,
        subject: 'Reset your VisionTest.ai password',
        template: 'password-reset',
        data: {
          userName: userName || 'User',
          resetUrl,
          expiresIn: '1 hour',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Email service responded with ${response.status}`);
    }
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw NotFoundError('User');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw BadRequestError('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash and update
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    logger.info(`Password changed for user: ${userId}`);
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw BadRequestError('Password requirements not met', { errors });
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private async ensureUniqueSlug(tx: any, baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await tx.organization.findUnique({
        where: { slug },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;

      if (counter > 100) {
        // Fallback to random suffix
        slug = `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
        return slug;
      }
    }
  }

  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export const authService = new AuthService();
export default authService;
