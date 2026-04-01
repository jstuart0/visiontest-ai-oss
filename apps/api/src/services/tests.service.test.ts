// VisionTest AI - Tests Service Tests
// Hospital-Grade: Complete test management testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testsService } from './tests.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    test: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    testSuite: {
      findFirst: vi.fn(),
    },
    execution: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
  TestStatus: {
    ACTIVE: 'ACTIVE',
    DISABLED: 'DISABLED',
    QUARANTINED: 'QUARANTINED',
    ARCHIVED: 'ARCHIVED',
  },
}));

describe('TestsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list tests for a project', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1' }] },
      };
      const mockTests = [
        {
          id: 'test-1',
          projectId: 'project-1',
          name: 'Test 1',
          steps: '[]',
          tags: ['smoke'],
          config: {},
          coveredFiles: [],
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          suite: null,
          flakyData: null,
          _count: { executions: 5 },
        },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.findMany).mockResolvedValue(mockTests as any);
      vi.mocked(prisma.test.count).mockResolvedValue(1);

      const result = await testsService.list('user-1', { projectId: 'project-1' });

      expect(result.tests).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by suite', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.findMany).mockResolvedValue([]);
      vi.mocked(prisma.test.count).mockResolvedValue(0);

      await testsService.list('user-1', { projectId: 'project-1', suiteId: 'suite-1' });

      expect(prisma.test.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ suiteId: 'suite-1' }),
        })
      );
    });

    it('should filter by tags', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.findMany).mockResolvedValue([]);
      vi.mocked(prisma.test.count).mockResolvedValue(0);

      await testsService.list('user-1', { projectId: 'project-1', tags: ['smoke', 'critical'] });

      expect(prisma.test.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tags: { hasSome: ['smoke', 'critical'] } }),
        })
      );
    });

    it('should support search', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.findMany).mockResolvedValue([]);
      vi.mocked(prisma.test.count).mockResolvedValue(0);

      await testsService.list('user-1', { projectId: 'project-1', search: 'login' });

      expect(prisma.test.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'login', mode: 'insensitive' } },
              { description: { contains: 'login', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should support pagination', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.findMany).mockResolvedValue([]);
      vi.mocked(prisma.test.count).mockResolvedValue(100);

      const result = await testsService.list('user-1', { projectId: 'project-1', page: 2, limit: 10 });

      expect(prisma.test.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
      expect(result.hasMore).toBe(true);
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(
        testsService.list('user-1', { projectId: 'project-1' })
      ).rejects.toThrow('No access');
    });
  });

  describe('create', () => {
    it('should create a test with valid input', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        name: 'New Test',
        steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
        tags: [],
        config: {},
        coveredFiles: [],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        suite: null,
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.create).mockResolvedValue(mockTest as any);

      const result = await testsService.create('user-1', {
        projectId: 'project-1',
        name: 'New Test',
        steps: [{ type: 'navigate', url: 'https://example.com' }],
      });

      expect(result.name).toBe('New Test');
      expect(result.steps).toHaveLength(1);
    });

    it('should validate suite exists when provided', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.testSuite.findFirst).mockResolvedValue(null);

      await expect(
        testsService.create('user-1', {
          projectId: 'project-1',
          name: 'New Test',
          suiteId: 'invalid-suite',
          steps: [{ type: 'navigate', url: 'https://example.com' }],
        })
      ).rejects.toThrow('Suite not found');
    });

    it('should validate navigate step has url', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        testsService.create('user-1', {
          projectId: 'project-1',
          name: 'New Test',
          steps: [{ type: 'navigate' }], // Missing url
        })
      ).rejects.toThrow('Navigate step requires url');
    });

    it('should validate click step has selector', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        testsService.create('user-1', {
          projectId: 'project-1',
          name: 'New Test',
          steps: [{ type: 'click' }], // Missing selector
        })
      ).rejects.toThrow('click step requires selector');
    });

    it('should validate type step has selector', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        testsService.create('user-1', {
          projectId: 'project-1',
          name: 'New Test',
          steps: [{ type: 'type', value: 'hello' }], // Missing selector
        })
      ).rejects.toThrow('type step requires selector');
    });

    it('should reject invalid step types', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        testsService.create('user-1', {
          projectId: 'project-1',
          name: 'New Test',
          steps: [{ type: 'invalid-type' }],
        })
      ).rejects.toThrow('Invalid step type');
    });
  });

  describe('getById', () => {
    it('should return test with details', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        name: 'Test 1',
        steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
        tags: ['smoke'],
        config: {},
        coveredFiles: [],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        suite: null,
        flakyData: null,
        ignoreMasks: [],
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      const result = await testsService.getById('user-1', 'test-1');

      expect(result.name).toBe('Test 1');
      expect(result.recentExecutions).toEqual([]);
    });

    it('should throw NotFoundError for missing test', async () => {
      vi.mocked(prisma.test.findUnique).mockResolvedValue(null);

      await expect(testsService.getById('user-1', 'test-1')).rejects.toThrow('not found');
    });

    it('should throw ForbiddenError when no access', async () => {
      const mockTest = {
        id: 'test-1',
        project: { org: { users: [] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);

      await expect(testsService.getById('user-1', 'test-1')).rejects.toThrow('No access');
    });
  });

  describe('update', () => {
    it('should update a test', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        name: 'Old Name',
        steps: '[]',
        tags: [],
        config: {},
        project: { org: { users: [{ userId: 'user-1' }] } },
      };
      const updatedTest = {
        ...mockTest,
        name: 'New Name',
        suite: null,
        flakyData: null,
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.test.update).mockResolvedValue(updatedTest as any);

      const result = await testsService.update('user-1', 'test-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should validate suite when changing', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.testSuite.findFirst).mockResolvedValue(null);

      await expect(
        testsService.update('user-1', 'test-1', { suiteId: 'invalid-suite' })
      ).rejects.toThrow('Suite not found');
    });

    it('should validate steps when provided', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);

      await expect(
        testsService.update('user-1', 'test-1', { steps: [{ type: 'click' }] })
      ).rejects.toThrow('click step requires selector');
    });
  });

  describe('delete', () => {
    it('should delete a test', async () => {
      const mockTest = {
        id: 'test-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.test.delete).mockResolvedValue(mockTest as any);

      await testsService.delete('user-1', 'test-1');

      expect(prisma.test.delete).toHaveBeenCalledWith({ where: { id: 'test-1' } });
    });
  });

  describe('run', () => {
    it('should create execution for a test', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        status: 'ACTIVE',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };
      const mockExecution = { id: 'exec-1' };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.execution.create).mockResolvedValue(mockExecution as any);

      const result = await testsService.run('user-1', 'test-1');

      expect(result.executionId).toBe('exec-1');
    });

    it('should reject running quarantined test', async () => {
      const mockTest = {
        id: 'test-1',
        status: 'QUARANTINED',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);

      await expect(testsService.run('user-1', 'test-1')).rejects.toThrow('Cannot run quarantined');
    });

    it('should pass custom config to execution', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        status: 'ACTIVE',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.execution.create).mockResolvedValue({ id: 'exec-1' } as any);

      await testsService.run('user-1', 'test-1', {
        browser: 'firefox',
        viewport: { width: 1280, height: 720 },
      });

      expect(prisma.execution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {
              browser: 'firefox',
              viewport: { width: 1280, height: 720 },
            },
          }),
        })
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate a test', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        suiteId: null,
        name: 'Original Test',
        description: 'A test',
        steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
        tags: ['smoke'],
        config: {},
        coveredFiles: [],
        project: { org: { users: [{ userId: 'user-1' }] } },
      };
      const duplicatedTest = {
        ...mockTest,
        id: 'test-2',
        name: 'Original Test (copy)',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        suite: null,
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.test.create).mockResolvedValue(duplicatedTest as any);

      const result = await testsService.duplicate('user-1', 'test-1');

      expect(result.name).toBe('Original Test (copy)');
      expect(result.id).toBe('test-2');
    });

    it('should use custom name when provided', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        name: 'Original Test',
        steps: '[]',
        tags: [],
        config: {},
        coveredFiles: [],
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.test.create).mockResolvedValue({
        ...mockTest,
        id: 'test-2',
        name: 'Custom Name',
        suite: null,
      } as any);

      const result = await testsService.duplicate('user-1', 'test-1', 'Custom Name');

      expect(result.name).toBe('Custom Name');
    });
  });

  describe('getHistory', () => {
    it('should return execution history', async () => {
      const mockTest = {
        id: 'test-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };
      const mockExecutions = [
        {
          id: 'exec-1',
          status: 'PASSED',
          triggeredBy: 'MANUAL',
          duration: 5000,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.execution.findMany).mockResolvedValue(mockExecutions as any);
      vi.mocked(prisma.execution.count).mockResolvedValue(1);

      const result = await testsService.getHistory('user-1', 'test-1');

      expect(result.executions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should support pagination', async () => {
      const mockTest = {
        id: 'test-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);
      vi.mocked(prisma.execution.count).mockResolvedValue(50);

      const result = await testsService.getHistory('user-1', 'test-1', 2, 10);

      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
      expect(result.hasMore).toBe(true);
    });
  });
});
