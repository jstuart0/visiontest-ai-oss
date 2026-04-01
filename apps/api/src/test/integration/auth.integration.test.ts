// VisionTest AI - Authentication Integration Tests
// Hospital-Grade: Full authentication flow testing

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { 
  setupTestEnvironment, 
  teardownTestEnvironment, 
  resetDatabase,
  testPrisma,
  generateTestToken
} from './setup';

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('newuser@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      // Verify user was created in database
      const user = await testPrisma.user.findUnique({
        where: { email: 'newuser@example.com' },
      });
      expect(user).not.toBeNull();

      // Verify organization was created
      const orgUser = await testPrisma.organizationUser.findFirst({
        where: { userId: user!.id },
        include: { org: true },
      });
      expect(orgUser).not.toBeNull();
      expect(orgUser!.role).toBe('OWNER');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject weak passwords', async () => {
      const weakPasswords = [
        'short1!',           // Too short
        'nouppercase123!',   // No uppercase
        'NOLOWERCASE123!',   // No lowercase
        'NoNumbers!@#',      // No numbers
        'NoSpecial123',      // No special characters
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `test-${Date.now()}@example.com`,
            password,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should reject duplicate email addresses', async () => {
      // Register first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
        });

      // Try to register with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'DifferentPass123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should create audit log entry', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'audit@example.com',
          password: 'SecurePass123!',
        });

      const auditLog = await testPrisma.auditLog.findFirst({
        where: { action: 'user.registered' },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog!.resource).toBe('user');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      // Should not reveal if email exists
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should create session on login', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        });

      const user = await testPrisma.user.findUnique({
        where: { email: 'login@example.com' },
      });

      const sessions = await testPrisma.session.findMany({
        where: { userId: user!.id },
      });

      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should update lastLoginAt', async () => {
      const beforeLogin = new Date();

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        });

      const user = await testPrisma.user.findUnique({
        where: { email: 'login@example.com' },
      });

      expect(user!.lastLoginAt).not.toBeNull();
      expect(user!.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePass123!',
        });

      refreshToken = registerResponse.body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'SecurePass123!',
        });

      accessToken = registerResponse.body.data.accessToken;
      refreshToken = registerResponse.body.data.refreshToken;
    });

    it('should logout and invalidate session', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify refresh token is invalidated
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'me@example.com',
          password: 'SecurePass123!',
          name: 'Test User',
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('me@example.com');
      expect(response.body.data.name).toBe('Test User');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('API Keys', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'apikey@example.com',
          password: 'SecurePass123!',
        });

      accessToken = registerResponse.body.data.accessToken;
      userId = registerResponse.body.data.user.id;
    });

    describe('POST /api/v1/auth/api-keys', () => {
      it('should create API key', async () => {
        const response = await request(app)
          .post('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Test API Key' });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.key).toMatch(/^vt_/);
        expect(response.body.data.name).toBe('Test API Key');
        expect(response.body.warning).toBeDefined(); // Warning about key only shown once
      });

      it('should create API key with custom scopes', async () => {
        const response = await request(app)
          .post('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            name: 'Read Only Key',
            scopes: ['read'],
          });

        expect(response.status).toBe(201);
        expect(response.body.data.scopes).toEqual(['read']);
      });
    });

    describe('GET /api/v1/auth/api-keys', () => {
      beforeEach(async () => {
        await request(app)
          .post('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Key 1' });

        await request(app)
          .post('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Key 2' });
      });

      it('should list API keys', async () => {
        const response = await request(app)
          .get('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        // Full key should not be returned in list
        expect(response.body.data[0]).not.toHaveProperty('keyHash');
        expect(response.body.data[0].keyPrefix).toBeDefined();
      });
    });

    describe('DELETE /api/v1/auth/api-keys/:id', () => {
      let apiKeyId: string;

      beforeEach(async () => {
        const createResponse = await request(app)
          .post('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'To Delete' });

        apiKeyId = createResponse.body.data.id;
      });

      it('should revoke API key', async () => {
        const response = await request(app)
          .delete(`/api/v1/auth/api-keys/${apiKeyId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);

        // Verify key is revoked
        const apiKey = await testPrisma.apiKey.findUnique({
          where: { id: apiKeyId },
        });
        expect(apiKey!.revokedAt).not.toBeNull();
      });

      it('should not show revoked keys in list', async () => {
        await request(app)
          .delete(`/api/v1/auth/api-keys/${apiKeyId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        const listResponse = await request(app)
          .get('/api/v1/auth/api-keys')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(listResponse.body.data).toHaveLength(0);
      });
    });
  });

  describe('Password Change', () => {
    let accessToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'password@example.com',
          password: 'OldPassword123!',
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should change password with valid current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'password@example.com',
          password: 'NewPassword123!',
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should reject change with wrong current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(400);
    });

    it('should invalidate all sessions after password change', async () => {
      const refreshToken = (await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'password@example.com',
          password: 'OldPassword123!',
        })).body.data.refreshToken;

      await request(app)
        .post('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

      // Old refresh token should be invalid
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });
});
