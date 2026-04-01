// VisionTest.ai - Baselines Service Tests
// Hospital-Grade: Baseline management testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { baselinesService } from './baselines.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    baseline: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    branchBaseline: {
      findUnique: vi.fn(),
    },
  },
  BaselineType: {
    PROJECT: 'PROJECT',
    BRANCH: 'BRANCH',
    ENVIRONMENT: 'ENVIRONMENT',
    DYNAMIC: 'DYNAMIC',
  },
}));

describe('BaselinesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list baselines for a project', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockBaselines = [
        {
          id: 'baseline-1',
          projectId: 'project-1',
          name: 'Homepage',
          branch: 'main',
          type: 'PROJECT',
          screenshots: JSON.stringify([{ name: 'home.png', url: 'https://...', width: 1920, height: 1080 }]),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { comparisons: 5, ignoreMasks: 2 },
        },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findMany).mockResolvedValue(mockBaselines as any);

      const result = await baselinesService.list('user-1', 'project-1');

      expect(result).toHaveLength(1);
      expect(result[0].screenshots).toHaveLength(1);
    });

    it('should filter by branch', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findMany).mockResolvedValue([]);

      await baselinesService.list('user-1', 'project-1', 'feature-branch');

      expect(prisma.baseline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1', branch: 'feature-branch' },
        })
      );
    });
  });

  describe('create', () => {
    it('should create a baseline', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockBaseline = {
        id: 'baseline-1',
        projectId: 'project-1',
        name: 'Homepage',
        branch: 'main',
        type: 'PROJECT',
        screenshots: JSON.stringify([]),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.baseline.create).mockResolvedValue(mockBaseline as any);

      const result = await baselinesService.create('user-1', {
        projectId: 'project-1',
        name: 'Homepage',
        screenshots: [],
      });

      expect(result.name).toBe('Homepage');
      expect(result.branch).toBe('main');
    });

    it('should reject duplicate name/branch', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(
        baselinesService.create('user-1', {
          projectId: 'project-1',
          name: 'Homepage',
          screenshots: [],
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('getById', () => {
    it('should get baseline by ID', async () => {
      const mockBaseline = {
        id: 'baseline-1',
        projectId: 'project-1',
        name: 'Homepage',
        branch: 'main',
        type: 'PROJECT',
        screenshots: JSON.stringify([]),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(mockBaseline as any);

      const result = await baselinesService.getById('user-1', 'baseline-1');

      expect(result.id).toBe('baseline-1');
    });

    it('should throw NotFoundError for missing baseline', async () => {
      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(null);

      await expect(baselinesService.getById('user-1', 'baseline-1')).rejects.toThrow('not found');
    });
  });

  describe('update', () => {
    it('should update a baseline', async () => {
      const mockBaseline = {
        id: 'baseline-1',
        projectId: 'project-1',
        name: 'Old Name',
        branch: 'main',
        type: 'PROJECT',
        screenshots: '[]',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(mockBaseline as any);
      vi.mocked(prisma.baseline.update).mockResolvedValue({
        ...mockBaseline,
        name: 'New Name',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await baselinesService.update('user-1', 'baseline-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should update screenshots', async () => {
      const mockBaseline = {
        id: 'baseline-1',
        screenshots: '[]',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(mockBaseline as any);
      vi.mocked(prisma.baseline.update).mockResolvedValue({
        ...mockBaseline,
        screenshots: JSON.stringify([{ name: 'new.png' }]),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await baselinesService.update('user-1', 'baseline-1', {
        screenshots: [{ name: 'new.png', url: 'https://...', width: 1920, height: 1080 }],
      });

      expect(prisma.baseline.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            screenshots: expect.any(String),
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a baseline', async () => {
      const mockBaseline = {
        id: 'baseline-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(mockBaseline as any);
      vi.mocked(prisma.baseline.delete).mockResolvedValue(mockBaseline as any);

      await baselinesService.delete('user-1', 'baseline-1');

      expect(prisma.baseline.delete).toHaveBeenCalledWith({ where: { id: 'baseline-1' } });
    });
  });

  describe('getForBranch', () => {
    it('should get baseline for specific branch', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockBaseline = {
        id: 'baseline-1',
        projectId: 'project-1',
        name: 'Homepage',
        branch: 'feature',
        type: 'PROJECT',
        screenshots: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findFirst).mockResolvedValue(mockBaseline as any);

      const result = await baselinesService.getForBranch('user-1', 'project-1', 'feature');

      expect(result.inherited).toBe(false);
      expect(result.requestedBranch).toBe('feature');
    });

    it('should inherit from parent branch', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockBaseline = {
        id: 'baseline-1',
        branch: 'main',
        type: 'PROJECT',
        screenshots: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findFirst)
        .mockResolvedValueOnce(null) // No baseline for feature branch
        .mockResolvedValueOnce(mockBaseline as any); // Found in main
      vi.mocked(prisma.branchBaseline.findUnique).mockResolvedValue(null); // No custom inheritance

      const result = await baselinesService.getForBranch('user-1', 'project-1', 'feature');

      expect(result.inherited).toBe(true);
      expect(result.branch).toBe('main');
    });

    it('should throw NotFoundError when no baseline found', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.branchBaseline.findUnique).mockResolvedValue(null);

      await expect(
        baselinesService.getForBranch('user-1', 'project-1', 'feature')
      ).rejects.toThrow('not found');
    });
  });

  describe('getInheritanceChain', () => {
    it('should return inheritance chain', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.branchBaseline.findUnique)
        .mockResolvedValueOnce({ inheritsFrom: 'develop' } as any)
        .mockResolvedValueOnce({ inheritsFrom: 'main' } as any)
        .mockResolvedValueOnce(null);

      const result = await baselinesService.getInheritanceChain('user-1', 'project-1', 'feature');

      expect(result).toEqual(['feature', 'develop', 'main']);
    });

    it('should default to main for branches without config', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.branchBaseline.findUnique).mockResolvedValue(null);

      const result = await baselinesService.getInheritanceChain('user-1', 'project-1', 'feature');

      expect(result).toEqual(['feature', 'main']);
    });
  });

  describe('promote', () => {
    it('should promote baselines between branches', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockBaselines = [
        { name: 'Homepage', screenshots: '[]', type: 'PROJECT' },
        { name: 'Settings', screenshots: '[]', type: 'PROJECT' },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findMany).mockResolvedValue(mockBaselines as any);
      vi.mocked(prisma.baseline.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.baseline.create).mockResolvedValue({} as any);

      const result = await baselinesService.promote('user-1', 'project-1', 'feature', 'main');

      expect(result.promoted).toHaveLength(2);
      expect(result.promoted[0].action).toBe('created');
    });

    it('should update existing baselines', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockBaselines = [{ name: 'Homepage', screenshots: '[]', type: 'PROJECT' }];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findMany).mockResolvedValue(mockBaselines as any);
      vi.mocked(prisma.baseline.findUnique).mockResolvedValue({ id: 'existing-1' } as any);
      vi.mocked(prisma.baseline.update).mockResolvedValue({} as any);

      const result = await baselinesService.promote('user-1', 'project-1', 'feature', 'main');

      expect(result.promoted[0].action).toBe('updated');
    });

    it('should throw when no baselines to promote', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.baseline.findMany).mockResolvedValue([]);

      await expect(
        baselinesService.promote('user-1', 'project-1', 'feature', 'main')
      ).rejects.toThrow('No baselines found');
    });
  });
});
