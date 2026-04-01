// VisionTest AI - Projects & Tests Integration Tests
// Hospital-Grade: Full project and test management flow testing

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { 
  setupTestEnvironment, 
  teardownTestEnvironment, 
  resetDatabase,
  testPrisma,
  createTestUser,
  createTestProject,
  generateTestToken
} from './setup';

describe('Projects Integration Tests', () => {
  let accessToken: string;
  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await resetDatabase();
    
    // Create test user
    const { user, org } = await createTestUser();
    userId = user.id;
    orgId = org.id;
    accessToken = await generateTestToken(user.id, user.email);
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'New Project',
          description: 'A test project',
          orgId,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Project');
      expect(response.body.data.slug).toBe('new-project');

      // Verify in database
      const project = await testPrisma.project.findFirst({
        where: { name: 'New Project' },
      });
      expect(project).not.toBeNull();
    });

    it('should generate unique slugs for duplicate names', async () => {
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'My Project', orgId });

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'My Project', orgId });

      expect(response.status).toBe(201);
      expect(response.body.data.slug).not.toBe('my-project');
    });

    it('should reject project creation without org access', async () => {
      const { org: otherOrg } = await createTestUser({ email: 'other@example.com' });

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Unauthorized Project', orgId: otherOrg.id });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/projects', () => {
    beforeEach(async () => {
      await createTestProject(orgId, { name: 'Project 1', slug: 'project-1' });
      await createTestProject(orgId, { name: 'Project 2', slug: 'project-2' });
    });

    it('should list user projects', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should not list projects from other organizations', async () => {
      const { user: otherUser, org: otherOrg } = await createTestUser({ 
        email: 'other@example.com' 
      });
      await createTestProject(otherOrg.id, { name: 'Other Project' });

      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((p: any) => p.name)).not.toContain('Other Project');
    });

    it('should support pagination', async () => {
      // Add more projects
      for (let i = 3; i <= 15; i++) {
        await createTestProject(orgId, { name: `Project ${i}`, slug: `project-${i}` });
      }

      const response = await request(app)
        .get('/api/v1/projects?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.meta.total).toBe(15);
      expect(response.body.meta.hasMore).toBe(true);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await createTestProject(orgId, { name: 'Detail Project' });
      projectId = project.id;
    });

    it('should get project details', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Detail Project');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/v1/projects/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized project', async () => {
      const { org: otherOrg } = await createTestUser({ email: 'other@example.com' });
      const otherProject = await createTestProject(otherOrg.id);

      const response = await request(app)
        .get(`/api/v1/projects/${otherProject.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await createTestProject(orgId, { name: 'Update Project' });
      projectId = project.id;
    });

    it('should update project', async () => {
      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
          description: 'New description',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.description).toBe('New description');
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await createTestProject(orgId, { name: 'Delete Project' });
      projectId = project.id;
    });

    it('should delete project', async () => {
      const response = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const project = await testPrisma.project.findUnique({
        where: { id: projectId },
      });
      expect(project).toBeNull();
    });
  });
});

describe('Tests Integration Tests', () => {
  let accessToken: string;
  let userId: string;
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await resetDatabase();
    
    const { user, org } = await createTestUser();
    userId = user.id;
    orgId = org.id;
    accessToken = await generateTestToken(user.id, user.email);

    const project = await createTestProject(orgId);
    projectId = project.id;
  });

  describe('POST /api/v1/tests', () => {
    it('should create a new test', async () => {
      const testSteps = [
        { type: 'navigate', url: 'https://example.com' },
        { type: 'click', selector: '#login-button' },
        { type: 'type', selector: '#email', value: 'test@example.com' },
        { type: 'assert', selector: '.welcome', assertion: 'visible' },
      ];

      const response = await request(app)
        .post('/api/v1/tests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectId,
          name: 'Login Flow Test',
          description: 'Tests the login flow',
          steps: testSteps,
          tags: ['auth', 'smoke'],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Login Flow Test');
      expect(response.body.data.steps).toEqual(testSteps);
      expect(response.body.data.tags).toEqual(['auth', 'smoke']);
    });

    it('should validate step types', async () => {
      const response = await request(app)
        .post('/api/v1/tests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectId,
          name: 'Invalid Test',
          steps: [{ type: 'invalid-step' }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/tests', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await testPrisma.test.create({
          data: {
            projectId,
            name: `Test ${i}`,
            steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
            tags: i % 2 === 0 ? ['even'] : ['odd'],
            status: i === 5 ? 'DISABLED' : 'ACTIVE',
          },
        });
      }
    });

    it('should list tests for project', async () => {
      const response = await request(app)
        .get(`/api/v1/tests?projectId=${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(5);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/v1/tests?projectId=${projectId}&status=ACTIVE`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(4);
    });

    it('should filter by tags', async () => {
      const response = await request(app)
        .get(`/api/v1/tests?projectId=${projectId}&tags=even`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(2);
    });

    it('should search by name', async () => {
      const response = await request(app)
        .get(`/api/v1/tests?projectId=${projectId}&search=Test 1`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test 1');
    });
  });

  describe('POST /api/v1/tests/:testId/run', () => {
    let testId: string;

    beforeEach(async () => {
      const test = await testPrisma.test.create({
        data: {
          projectId,
          name: 'Run Test',
          steps: JSON.stringify([
            { type: 'navigate', url: 'https://example.com' },
          ]),
        },
      });
      testId = test.id;
    });

    it('should create execution for test', async () => {
      const response = await request(app)
        .post(`/api/v1/tests/${testId}/run`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ browser: 'chromium' });

      expect(response.status).toBe(201);
      expect(response.body.data.testId).toBe(testId);
      expect(response.body.data.status).toBe('PENDING');

      // Verify execution was created
      const execution = await testPrisma.execution.findUnique({
        where: { id: response.body.data.id },
      });
      expect(execution).not.toBeNull();
    });

    it('should reject running quarantined test', async () => {
      await testPrisma.test.update({
        where: { id: testId },
        data: { status: 'QUARANTINED' },
      });

      const response = await request(app)
        .post(`/api/v1/tests/${testId}/run`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/tests/:testId/duplicate', () => {
    let testId: string;

    beforeEach(async () => {
      const test = await testPrisma.test.create({
        data: {
          projectId,
          name: 'Original Test',
          description: 'Original description',
          steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
          tags: ['original'],
        },
      });
      testId = test.id;
    });

    it('should duplicate test', async () => {
      const response = await request(app)
        .post(`/api/v1/tests/${testId}/duplicate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Duplicated Test' });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Duplicated Test');
      expect(response.body.data.tags).toEqual(['original']);

      // Verify two tests exist
      const tests = await testPrisma.test.findMany({ where: { projectId } });
      expect(tests).toHaveLength(2);
    });

    it('should generate default name if not provided', async () => {
      const response = await request(app)
        .post(`/api/v1/tests/${testId}/duplicate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.body.data.name).toBe('Original Test (copy)');
    });
  });

  describe('GET /api/v1/tests/:testId/history', () => {
    let testId: string;

    beforeEach(async () => {
      const test = await testPrisma.test.create({
        data: {
          projectId,
          name: 'History Test',
          steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
        },
      });
      testId = test.id;

      // Create execution history
      for (let i = 0; i < 10; i++) {
        await testPrisma.execution.create({
          data: {
            projectId,
            testId,
            status: i % 3 === 0 ? 'FAILED' : 'PASSED',
            duration: 1000 + i * 100,
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          },
        });
      }
    });

    it('should return test execution history', async () => {
      const response = await request(app)
        .get(`/api/v1/tests/${testId}/history`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.total).toBe(10);
    });

    it('should paginate history', async () => {
      const response = await request(app)
        .get(`/api/v1/tests/${testId}/history?page=1&limit=5`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.meta.hasMore).toBe(true);
    });
  });
});
