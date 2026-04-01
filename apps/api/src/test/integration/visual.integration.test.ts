// VisionTest.ai - Visual Regression Integration Tests
// Hospital-Grade: Core VRT functionality testing

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

describe('Visual Regression Integration Tests', () => {
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

  describe('Baselines', () => {
    describe('POST /api/v1/baselines', () => {
      it('should create a baseline', async () => {
        const response = await request(app)
          .post('/api/v1/baselines')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            name: 'homepage-desktop',
            branch: 'main',
            screenshots: [
              { name: 'header', url: 'minio://screenshots/header.png', width: 1920, height: 200 },
              { name: 'hero', url: 'minio://screenshots/hero.png', width: 1920, height: 600 },
            ],
          });

        expect(response.status).toBe(201);
        expect(response.body.data.name).toBe('homepage-desktop');
        expect(response.body.data.branch).toBe('main');
      });

      it('should reject duplicate baseline name on same branch', async () => {
        await request(app)
          .post('/api/v1/baselines')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            name: 'homepage-desktop',
            branch: 'main',
            screenshots: [],
          });

        const response = await request(app)
          .post('/api/v1/baselines')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            name: 'homepage-desktop',
            branch: 'main',
            screenshots: [],
          });

        expect(response.status).toBe(409);
      });

      it('should allow same name on different branches', async () => {
        await request(app)
          .post('/api/v1/baselines')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            name: 'homepage-desktop',
            branch: 'main',
            screenshots: [],
          });

        const response = await request(app)
          .post('/api/v1/baselines')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            name: 'homepage-desktop',
            branch: 'feature/new-design',
            screenshots: [],
          });

        expect(response.status).toBe(201);
      });
    });

    describe('GET /api/v1/baselines', () => {
      beforeEach(async () => {
        for (const name of ['login', 'dashboard', 'settings']) {
          await testPrisma.baseline.create({
            data: {
              projectId,
              name,
              branch: 'main',
              screenshots: JSON.stringify([]),
            },
          });
        }
      });

      it('should list baselines for project', async () => {
        const response = await request(app)
          .get(`/api/v1/baselines?projectId=${projectId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(3);
      });

      it('should filter by branch', async () => {
        await testPrisma.baseline.create({
          data: {
            projectId,
            name: 'feature-page',
            branch: 'feature/test',
            screenshots: JSON.stringify([]),
          },
        });

        const response = await request(app)
          .get(`/api/v1/baselines?projectId=${projectId}&branch=feature/test`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('feature-page');
      });
    });
  });

  describe('Comparisons', () => {
    let baselineId: string;
    let executionId: string;

    beforeEach(async () => {
      const baseline = await testPrisma.baseline.create({
        data: {
          projectId,
          name: 'test-baseline',
          branch: 'main',
          screenshots: JSON.stringify([
            { name: 'page', url: 'minio://baselines/page.png' },
          ]),
        },
      });
      baselineId = baseline.id;

      const execution = await testPrisma.execution.create({
        data: {
          projectId,
          status: 'PASSED',
        },
      });
      executionId = execution.id;
    });

    describe('POST /api/v1/comparisons', () => {
      it('should create a comparison', async () => {
        const response = await request(app)
          .post('/api/v1/comparisons')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            executionId,
            baselineId,
            diffScore: 5.5,
            status: 'PENDING',
          });

        expect(response.status).toBe(201);
        expect(response.body.data.diffScore).toBe(5.5);
        expect(response.body.data.status).toBe('PENDING');
      });
    });

    describe('POST /api/v1/comparisons/:id/approve', () => {
      let comparisonId: string;

      beforeEach(async () => {
        const comparison = await testPrisma.comparison.create({
          data: {
            executionId,
            baselineId,
            diffScore: 3.2,
            status: 'PENDING',
          },
        });
        comparisonId = comparison.id;
      });

      it('should approve comparison and update baseline', async () => {
        const response = await request(app)
          .post(`/api/v1/comparisons/${comparisonId}/approve`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ updateBaseline: true });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('APPROVED');

        // Verify comparison was updated
        const comparison = await testPrisma.comparison.findUnique({
          where: { id: comparisonId },
        });
        expect(comparison!.status).toBe('APPROVED');
        expect(comparison!.resolvedAt).not.toBeNull();
      });

      it('should approve without updating baseline', async () => {
        const response = await request(app)
          .post(`/api/v1/comparisons/${comparisonId}/approve`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ updateBaseline: false });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('APPROVED');
      });
    });

    describe('POST /api/v1/comparisons/:id/reject', () => {
      let comparisonId: string;

      beforeEach(async () => {
        const comparison = await testPrisma.comparison.create({
          data: {
            executionId,
            baselineId,
            diffScore: 15.0,
            status: 'PENDING',
          },
        });
        comparisonId = comparison.id;
      });

      it('should reject comparison', async () => {
        const response = await request(app)
          .post(`/api/v1/comparisons/${comparisonId}/reject`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ reason: 'Unexpected layout change' });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('REJECTED');
      });
    });

    describe('POST /api/v1/comparisons/bulk-approve', () => {
      let comparisonIds: string[];

      beforeEach(async () => {
        comparisonIds = [];
        for (let i = 0; i < 5; i++) {
          const comparison = await testPrisma.comparison.create({
            data: {
              executionId,
              baselineId,
              diffScore: i * 2,
              status: 'PENDING',
            },
          });
          comparisonIds.push(comparison.id);
        }
      });

      it('should bulk approve multiple comparisons', async () => {
        const response = await request(app)
          .post('/api/v1/comparisons/bulk-approve')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            comparisonIds: comparisonIds.slice(0, 3),
            updateBaselines: false,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.approved).toBe(3);

        // Verify comparisons were approved
        const approved = await testPrisma.comparison.count({
          where: { status: 'APPROVED' },
        });
        expect(approved).toBe(3);
      });
    });
  });

  describe('Ignore Masks', () => {
    let baselineId: string;

    beforeEach(async () => {
      const baseline = await testPrisma.baseline.create({
        data: {
          projectId,
          name: 'masked-page',
          branch: 'main',
          screenshots: JSON.stringify([]),
        },
      });
      baselineId = baseline.id;
    });

    describe('POST /api/v1/masks', () => {
      it('should create a rectangle mask', async () => {
        const response = await request(app)
          .post('/api/v1/masks')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            baselineId,
            type: 'RECTANGLE',
            value: JSON.stringify({ x: 100, y: 50, width: 200, height: 100 }),
            reason: 'Dynamic timestamp',
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe('RECTANGLE');
        expect(response.body.data.reason).toBe('Dynamic timestamp');
      });

      it('should create a selector mask', async () => {
        const response = await request(app)
          .post('/api/v1/masks')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            baselineId,
            type: 'SELECTOR',
            value: '.ad-banner',
            reason: 'Advertisement',
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe('SELECTOR');
        expect(response.body.data.value).toBe('.ad-banner');
      });

      it('should create project-wide mask', async () => {
        const response = await request(app)
          .post('/api/v1/masks')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectId,
            type: 'SELECTOR',
            value: '[data-testid="timestamp"]',
            reason: 'Dynamic timestamp across all pages',
            isGlobal: false,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.baselineId).toBeNull();
      });
    });

    describe('GET /api/v1/masks', () => {
      beforeEach(async () => {
        await testPrisma.ignoreMask.createMany({
          data: [
            {
              projectId,
              baselineId,
              type: 'RECTANGLE',
              value: JSON.stringify({ x: 0, y: 0, width: 100, height: 50 }),
              reason: 'Mask 1',
              createdBy: userId,
              isActive: true,
            },
            {
              projectId,
              baselineId,
              type: 'SELECTOR',
              value: '.mask-2',
              reason: 'Mask 2',
              createdBy: userId,
              isActive: true,
            },
            {
              projectId,
              type: 'SELECTOR',
              value: '.project-wide',
              reason: 'Project-wide mask',
              createdBy: userId,
              isActive: true,
            },
          ],
        });
      });

      it('should list masks for baseline', async () => {
        const response = await request(app)
          .get(`/api/v1/masks?projectId=${projectId}&baselineId=${baselineId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });

      it('should include project-wide masks', async () => {
        const response = await request(app)
          .get(`/api/v1/masks?projectId=${projectId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        const projectWideMask = response.body.data.find(
          (m: any) => m.value === '.project-wide'
        );
        expect(projectWideMask).toBeDefined();
      });
    });

    describe('DELETE /api/v1/masks/:id', () => {
      let maskId: string;

      beforeEach(async () => {
        const mask = await testPrisma.ignoreMask.create({
          data: {
            projectId,
            baselineId,
            type: 'RECTANGLE',
            value: JSON.stringify({ x: 0, y: 0, width: 100, height: 50 }),
            createdBy: userId,
          },
        });
        maskId = mask.id;
      });

      it('should delete mask', async () => {
        const response = await request(app)
          .delete(`/api/v1/masks/${maskId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);

        const mask = await testPrisma.ignoreMask.findUnique({
          where: { id: maskId },
        });
        expect(mask).toBeNull();
      });
    });
  });

  describe('Branch Baseline Inheritance', () => {
    beforeEach(async () => {
      // Create main branch baseline
      await testPrisma.baseline.create({
        data: {
          projectId,
          name: 'login-page',
          branch: 'main',
          screenshots: JSON.stringify([
            { name: 'desktop', url: 'minio://main/login-desktop.png' },
          ]),
        },
      });
    });

    describe('GET /api/v1/baselines/resolve', () => {
      it('should return main branch baseline when feature branch has none', async () => {
        const response = await request(app)
          .get(`/api/v1/baselines/resolve?projectId=${projectId}&name=login-page&branch=feature/new`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.branch).toBe('main');
        expect(response.body.data.inherited).toBe(true);
      });

      it('should return feature branch baseline when it exists', async () => {
        await testPrisma.baseline.create({
          data: {
            projectId,
            name: 'login-page',
            branch: 'feature/new',
            screenshots: JSON.stringify([
              { name: 'desktop', url: 'minio://feature/login-desktop.png' },
            ]),
          },
        });

        const response = await request(app)
          .get(`/api/v1/baselines/resolve?projectId=${projectId}&name=login-page&branch=feature/new`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.body.data.branch).toBe('feature/new');
        expect(response.body.data.inherited).toBe(false);
      });
    });

    describe('POST /api/v1/baselines/promote', () => {
      let featureBaselineId: string;

      beforeEach(async () => {
        const baseline = await testPrisma.baseline.create({
          data: {
            projectId,
            name: 'new-feature',
            branch: 'feature/test',
            screenshots: JSON.stringify([
              { name: 'page', url: 'minio://feature/page.png' },
            ]),
          },
        });
        featureBaselineId = baseline.id;
      });

      it('should promote feature baseline to main', async () => {
        const response = await request(app)
          .post('/api/v1/baselines/promote')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            baselineId: featureBaselineId,
            targetBranch: 'main',
          });

        expect(response.status).toBe(200);

        // Verify main branch baseline was created/updated
        const mainBaseline = await testPrisma.baseline.findFirst({
          where: { projectId, name: 'new-feature', branch: 'main' },
        });
        expect(mainBaseline).not.toBeNull();
      });
    });
  });
});

describe('Flaky Test Quarantine Integration Tests', () => {
  let accessToken: string;
  let projectId: string;
  let testId: string;

  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await resetDatabase();
    
    const { user, org } = await createTestUser();
    accessToken = await generateTestToken(user.id, user.email);

    const project = await createTestProject(org.id);
    projectId = project.id;

    const test = await testPrisma.test.create({
      data: {
        projectId,
        name: 'Flaky Test',
        steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
      },
    });
    testId = test.id;
  });

  describe('GET /api/v1/flaky', () => {
    beforeEach(async () => {
      await testPrisma.flakyTest.create({
        data: {
          testId,
          projectId,
          flakinessScore: 45,
          status: 'QUARANTINED',
          runHistory: JSON.stringify([
            { timestamp: Date.now() - 1000, passed: true },
            { timestamp: Date.now() - 2000, passed: false },
            { timestamp: Date.now() - 3000, passed: true },
            { timestamp: Date.now() - 4000, passed: false },
            { timestamp: Date.now() - 5000, passed: false },
          ]),
        },
      });
    });

    it('should list flaky tests', async () => {
      const response = await request(app)
        .get(`/api/v1/flaky?projectId=${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].flakinessScore).toBe(45);
      expect(response.body.data[0].status).toBe('QUARANTINED');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/v1/flaky?projectId=${projectId}&status=WARNING`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/v1/flaky/:testId/quarantine', () => {
    it('should manually quarantine a test', async () => {
      const response = await request(app)
        .post(`/api/v1/flaky/${testId}/quarantine`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Consistently failing in CI' });

      expect(response.status).toBe(200);

      // Verify test was quarantined
      const test = await testPrisma.test.findUnique({
        where: { id: testId },
      });
      expect(test!.status).toBe('QUARANTINED');
    });
  });

  describe('POST /api/v1/flaky/:testId/release', () => {
    beforeEach(async () => {
      await testPrisma.test.update({
        where: { id: testId },
        data: { status: 'QUARANTINED' },
      });

      await testPrisma.flakyTest.create({
        data: {
          testId,
          projectId,
          flakinessScore: 5,
          status: 'QUARANTINED',
          runHistory: JSON.stringify([]),
        },
      });
    });

    it('should release a quarantined test', async () => {
      const response = await request(app)
        .post(`/api/v1/flaky/${testId}/release`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);

      // Verify test was released
      const test = await testPrisma.test.findUnique({
        where: { id: testId },
      });
      expect(test!.status).toBe('ACTIVE');
    });
  });

  describe('GET /api/v1/flaky/stats', () => {
    beforeEach(async () => {
      const tests = [];
      for (let i = 0; i < 10; i++) {
        const t = await testPrisma.test.create({
          data: {
            projectId,
            name: `Test ${i}`,
            steps: JSON.stringify([]),
          },
        });
        tests.push(t);
      }

      // Create varied flaky data
      await testPrisma.flakyTest.createMany({
        data: [
          { testId: tests[0].id, projectId, status: 'QUARANTINED', flakinessScore: 50, runHistory: '[]' },
          { testId: tests[1].id, projectId, status: 'QUARANTINED', flakinessScore: 45, runHistory: '[]' },
          { testId: tests[2].id, projectId, status: 'WARNING', flakinessScore: 25, runHistory: '[]' },
          { testId: tests[3].id, projectId, status: 'WARNING', flakinessScore: 22, runHistory: '[]' },
          { testId: tests[4].id, projectId, status: 'WATCHING', flakinessScore: 10, runHistory: '[]' },
        ],
      });
    });

    it('should return flaky test statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/flaky/stats?projectId=${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.quarantined).toBe(2);
      expect(response.body.data.warning).toBe(2);
      expect(response.body.data.watching).toBe(1);
    });
  });

  describe('GET /api/v1/flaky/should-run', () => {
    beforeEach(async () => {
      await testPrisma.test.update({
        where: { id: testId },
        data: { status: 'QUARANTINED' },
      });
    });

    it('should return false for quarantined tests', async () => {
      const response = await request(app)
        .get(`/api/v1/flaky/should-run?testId=${testId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shouldRun).toBe(false);
      expect(response.body.data.reason).toContain('quarantined');
    });
  });
});
