// VisionTest AI - Integration Test Setup
// Hospital-Grade Testing Infrastructure

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import express, { Express } from 'express';

// Test database URL - use separate test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgresql://test:test@localhost:5432/visiontest_test';

// Test Prisma client
export let testPrisma: PrismaClient;

// Test app instance
export let testApp: Express;

/**
 * Initialize test database and application
 */
export async function setupTestEnvironment() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';

  // Create test Prisma client
  testPrisma = new PrismaClient({
    datasources: {
      db: { url: TEST_DATABASE_URL },
    },
    log: ['error'],
  });

  // Connect to database
  await testPrisma.$connect();

  // Reset database schema
  await resetDatabase();

  console.log('✅ Test database initialized');
}

/**
 * Reset database to clean state
 */
export async function resetDatabase() {
  // Delete all data in reverse order of dependencies
  const tables = [
    'AuditLog',
    'ApprovalRequest',
    'Comparison',
    'Checkpoint',
    'Screenshot',
    'Execution',
    'Schedule',
    'ImpactMapping',
    'FlakyTest',
    'IgnoreMask',
    'BranchBaseline',
    'Baseline',
    'Test',
    'TestSuite',
    'HealingPattern',
    'Project',
    'ApiKey',
    'Session',
    'OrganizationUser',
    'Organization',
    'User',
  ];

  for (const table of tables) {
    try {
      await testPrisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch (error) {
      // Table might not exist yet
    }
  }
}

/**
 * Cleanup after all tests
 */
export async function teardownTestEnvironment() {
  await testPrisma.$disconnect();
  console.log('✅ Test database disconnected');
}

/**
 * Create test user and organization
 */
export async function createTestUser(overrides: Partial<{
  email: string;
  name: string;
  password: string;
}> = {}) {
  const bcrypt = await import('bcrypt');
  
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash(overrides.password || 'Test123!@#', 12);

  const user = await testPrisma.user.create({
    data: {
      email,
      name: overrides.name || 'Test User',
      passwordHash,
      emailVerified: true,
    },
  });

  const org = await testPrisma.organization.create({
    data: {
      name: `${user.name}'s Workspace`,
      slug: `test-org-${Date.now()}`,
    },
  });

  await testPrisma.organizationUser.create({
    data: {
      userId: user.id,
      orgId: org.id,
      role: 'OWNER',
    },
  });

  return { user, org };
}

/**
 * Create test project
 */
export async function createTestProject(orgId: string, overrides: Partial<{
  name: string;
  slug: string;
}> = {}) {
  return testPrisma.project.create({
    data: {
      orgId,
      name: overrides.name || 'Test Project',
      slug: overrides.slug || `test-project-${Date.now()}`,
    },
  });
}

/**
 * Generate test authentication token
 */
export async function generateTestToken(userId: string, email: string) {
  const jwt = await import('jsonwebtoken');
  
  return jwt.sign(
    { userId, email, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

/**
 * Create authenticated test request helper
 */
export function createAuthenticatedAgent(token: string) {
  const supertest = require('supertest');
  const agent = supertest.agent(testApp);
  
  return {
    get: (url: string) => agent.get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => agent.post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => agent.patch(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => agent.put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => agent.delete(url).set('Authorization', `Bearer ${token}`),
  };
}

// Global setup hooks
beforeAll(async () => {
  await setupTestEnvironment();
});

afterAll(async () => {
  await teardownTestEnvironment();
});

beforeEach(async () => {
  // Optional: Reset database before each test for isolation
  // await resetDatabase();
});

afterEach(async () => {
  // Cleanup any test-specific data if needed
});
