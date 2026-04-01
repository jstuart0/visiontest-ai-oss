// VisionTest AI - Auth Service Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './auth.service';
import { prisma } from '@visiontest/database';
import bcrypt from 'bcrypt';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    organizationUser: {
      create: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    apiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
  Role: {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
    VIEWER: 'VIEWER',
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user with valid credentials', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: 'hashed',
        name: 'Test User',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrg = {
        id: 'test-org-id',
        name: "Test User's Workspace",
        slug: 'test',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue(mockOrg as any);
      vi.mocked(prisma.organizationUser.create).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.session.create).mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Test123!@#',
        name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should reject invalid email format', async () => {
      await expect(
        authService.register({
          email: 'invalid-email',
          password: 'Test123!@#',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should reject weak passwords', async () => {
      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'weak',
        })
      ).rejects.toThrow('Password requirements not met');
    });

    it('should reject duplicate emails', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      } as any);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Test123!@#',
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Test123!@#', 12);
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.session.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject invalid email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Test123!@#',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject invalid password', async () => {
      const hashedPassword = await bcrypt.hash('Test123!@#', 12);
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const mockApiKey = {
        id: 'api-key-id',
        userId: 'user-id',
        name: 'Test API Key',
        keyPrefix: 'vt_12345',
        keyHash: 'hashed',
        scopes: ['read', 'write'],
        createdAt: new Date(),
      };

      vi.mocked(prisma.apiKey.create).mockResolvedValue(mockApiKey as any);

      const result = await authService.createApiKey(
        'user-id',
        'Test API Key',
        ['read', 'write']
      );

      expect(result.id).toBe('api-key-id');
      expect(result.name).toBe('Test API Key');
      expect(result.key).toMatch(/^vt_/);
      expect(result.scopes).toEqual(['read', 'write']);
    });
  });

  describe('logout', () => {
    it('should delete session on logout', async () => {
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 1 });

      await authService.logout('some-refresh-token');

      expect(prisma.session.deleteMany).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should return new access token with valid refresh token', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);

      // We need to generate a real refresh token for this test
      const { generateToken } = await import('../middleware/auth');
      const refreshToken = generateToken('user-id', 'test@example.com', 'refresh');

      const result = await authService.refresh(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refresh('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired session', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const { generateToken } = await import('../middleware/auth');
      const refreshToken = generateToken('user-id', 'test@example.com', 'refresh');

      await expect(authService.refresh(refreshToken)).rejects.toThrow('Session expired or invalid');
    });

    it('should reject access token used as refresh token', async () => {
      const { generateToken } = await import('../middleware/auth');
      const accessToken = generateToken('user-id', 'test@example.com', 'access');

      await expect(authService.refresh(accessToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('getUser', () => {
    it('should return user without passwordHash', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: 'secret-hash',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await authService.getUser('user-id');

      expect(result).toBeDefined();
      expect(result!.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await authService.getUser('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('should return list of non-revoked API keys', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'Test Key 1',
          keyPrefix: 'vt_12345',
          scopes: ['read'],
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
        },
        {
          id: 'key-2',
          name: 'Test Key 2',
          keyPrefix: 'vt_67890',
          scopes: ['read', 'write'],
          lastUsedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.apiKey.findMany).mockResolvedValue(mockKeys as any);

      const result = await authService.listApiKeys('user-id');

      expect(result).toHaveLength(2);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-id', revokedAt: null },
        })
      );
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an existing API key', async () => {
      const mockApiKey = {
        id: 'key-id',
        userId: 'user-id',
        name: 'Test Key',
      };

      // Need to mock apiKey.findFirst
      vi.mocked(prisma.apiKey as any).findFirst = vi.fn().mockResolvedValue(mockApiKey);
      vi.mocked(prisma.apiKey.update).mockResolvedValue({
        ...mockApiKey,
        revokedAt: new Date(),
      } as any);

      await authService.revokeApiKey('user-id', 'key-id');

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-id' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundError for non-existent key', async () => {
      vi.mocked(prisma.apiKey as any).findFirst = vi.fn().mockResolvedValue(null);

      await expect(authService.revokeApiKey('user-id', 'non-existent-key')).rejects.toThrow('API key not found');
    });

    it('should throw NotFoundError for key belonging to another user', async () => {
      vi.mocked(prisma.apiKey as any).findFirst = vi.fn().mockResolvedValue(null);

      await expect(authService.revokeApiKey('user-id', 'other-users-key')).rejects.toThrow('API key not found');
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      const hashedPassword = await bcrypt.hash('OldP@ss123!', 12);
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 1 });

      await authService.changePassword('user-id', 'OldP@ss123!', 'NewP@ss456!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { passwordHash: expect.any(String) },
      });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.changePassword('non-existent-id', 'OldP@ss123!', 'NewP@ss456!')
      ).rejects.toThrow('User not found');
    });

    it('should throw BadRequestError for incorrect current password', async () => {
      const hashedPassword = await bcrypt.hash('OldP@ss123!', 12);
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      await expect(
        authService.changePassword('user-id', 'WrongP@ss123!', 'NewP@ss456!')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const hashedPassword = await bcrypt.hash('OldP@ss123!', 12);
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      await expect(
        authService.changePassword('user-id', 'OldP@ss123!', 'weak')
      ).rejects.toThrow('Password requirements not met');
    });
  });

  describe('login with metadata', () => {
    it('should store userAgent and ipAddress in session', async () => {
      const hashedPassword = await bcrypt.hash('Test123!@#', 12);
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.session.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser);

      await authService.login(
        { email: 'test@example.com', password: 'Test123!@#' },
        { userAgent: 'Mozilla/5.0', ipAddress: '192.168.1.1' }
      );

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }),
      });
    });
  });

  describe('createApiKey with expiration', () => {
    it('should create API key with expiration date', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const mockApiKey = {
        id: 'api-key-id',
        userId: 'user-id',
        name: 'Expiring Key',
        keyPrefix: 'vt_12345',
        keyHash: 'hashed',
        scopes: ['read'],
        expiresAt,
        createdAt: new Date(),
      };

      vi.mocked(prisma.apiKey.create).mockResolvedValue(mockApiKey as any);

      const result = await authService.createApiKey('user-id', 'Expiring Key', ['read'], expiresAt);

      expect(result.id).toBe('api-key-id');
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt,
        }),
      });
    });
  });

  describe('slug generation edge cases', () => {
    it('should handle slug collision with fallback to random suffix', async () => {
      // Mock finding existing slug 100+ times to trigger random fallback
      let callCount = 0;
      vi.mocked(prisma.organization.findUnique).mockImplementation(async () => {
        callCount++;
        if (callCount <= 101) {
          return { id: 'existing', slug: 'test' } as any;
        }
        return null;
      });

      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: 'hashed',
        name: 'Test',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: 'org-id',
        name: "Test's Workspace",
        slug: 'test-abc123',
      } as any);
      vi.mocked(prisma.organizationUser.create).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.session.create).mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Test123!@#',
        name: 'Test',
      });

      expect(result.user).toBeDefined();
    });

    it('should register user without name (default workspace)', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: 'hashed',
        name: null,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: 'org-id',
        name: 'My Workspace',
        slug: 'test-example-com',
      } as any);
      vi.mocked(prisma.organizationUser.create).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.session.create).mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(result.user).toBeDefined();
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'My Workspace',
        }),
      });
    });
  });

  describe('password validation', () => {
    it('should require minimum 8 characters', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Aa1!',
        })
      ).rejects.toThrow('Password requirements not met');
    });

    it('should require uppercase letter', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'abcdefgh1!',
        })
      ).rejects.toThrow('Password requirements not met');
    });

    it('should require lowercase letter', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'ABCDEFGH1!',
        })
      ).rejects.toThrow('Password requirements not met');
    });

    it('should require number', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Abcdefgh!',
        })
      ).rejects.toThrow('Password requirements not met');
    });

    it('should require special character', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Abcdefgh1',
        })
      ).rejects.toThrow('Password requirements not met');
    });

    it('should accept valid strong password', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: 'hashed',
        name: null,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({} as any);
      vi.mocked(prisma.organizationUser.create).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.session.create).mockResolvedValue({} as any);

      // This should not throw
      const result = await authService.register({
        email: 'test@example.com',
        password: 'ValidP@ss123!',
      });

      expect(result.user).toBeDefined();
    });
  });
});
