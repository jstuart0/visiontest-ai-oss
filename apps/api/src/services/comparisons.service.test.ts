// VisionTest AI - Comparisons Service Tests
// Hospital-Grade: Visual comparison testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { comparisonsService } from './comparisons.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    comparison: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    approvalRequest: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    baseline: {
      update: vi.fn(),
    },
  },
  ComparisonStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    AUTO_APPROVED: 'AUTO_APPROVED',
    ESCALATED: 'ESCALATED',
  },
}));

describe('ComparisonsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list comparisons for a project', async () => {
      const mockComparison = {
        id: 'comparison-1',
        executionId: 'exec-1',
        baselineId: 'baseline-1',
        diffScore: 0.05,
        status: 'PENDING',
        masksApplied: 0,
        createdAt: new Date(),
        execution: {
          project: { org: { users: [{ userId: 'user-1' }] } },
        },
      };

      vi.mocked(prisma.comparison.findFirst).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.comparison.findMany).mockResolvedValue([mockComparison] as any);
      vi.mocked(prisma.comparison.count).mockResolvedValue(1);

      const result = await comparisonsService.list('user-1', { projectId: 'project-1' });

      expect(result.comparisons).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw BadRequestError when no filter provided', async () => {
      await expect(comparisonsService.list('user-1', {})).rejects.toThrow('projectId or executionId is required');
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.comparison.findFirst).mockResolvedValue({
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
      } as any);
      vi.mocked(prisma.comparison.findMany).mockResolvedValue([]);
      vi.mocked(prisma.comparison.count).mockResolvedValue(0);

      await comparisonsService.list('user-1', { executionId: 'exec-1', status: 'PENDING' });

      expect(prisma.comparison.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('should support pagination', async () => {
      vi.mocked(prisma.comparison.findFirst).mockResolvedValue({
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
      } as any);
      vi.mocked(prisma.comparison.findMany).mockResolvedValue([]);
      vi.mocked(prisma.comparison.count).mockResolvedValue(50);

      const result = await comparisonsService.list('user-1', { executionId: 'exec-1', page: 2, limit: 10 });

      expect(prisma.comparison.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
      expect(result.hasMore).toBe(true);
    });
  });

  describe('getById', () => {
    it('should get comparison by ID', async () => {
      const mockComparison = {
        id: 'comparison-1',
        executionId: 'exec-1',
        baselineId: 'baseline-1',
        diffScore: 0.05,
        status: 'PENDING',
        masksApplied: 0,
        createdAt: new Date(),
        execution: {
          project: { org: { users: [{ userId: 'user-1' }] } },
        },
        baseline: { id: 'baseline-1', name: 'Baseline' },
        screenshot: null,
        approval: null,
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);

      const result = await comparisonsService.getById('user-1', 'comparison-1');

      expect(result.id).toBe('comparison-1');
    });

    it('should throw NotFoundError for missing comparison', async () => {
      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(null);

      await expect(comparisonsService.getById('user-1', 'comparison-1')).rejects.toThrow('not found');
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.comparison.findUnique).mockResolvedValue({
        id: 'comparison-1',
        execution: { project: { org: { users: [] } } },
      } as any);

      await expect(comparisonsService.getById('user-1', 'comparison-1')).rejects.toThrow('No access');
    });
  });

  describe('approve', () => {
    it('should approve a comparison', async () => {
      const mockComparison = {
        id: 'comparison-1',
        executionId: 'exec-1',
        baselineId: 'baseline-1',
        metadata: {},
        status: 'PENDING',
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        baseline: { screenshots: '[]' },
        screenshot: null,
        approval: null,
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({
        ...mockComparison,
        status: 'APPROVED',
        resolvedAt: new Date(),
        masksApplied: 0,
        createdAt: new Date(),
      } as any);

      const result = await comparisonsService.approve('user-1', 'comparison-1', { comment: 'Looks good' });

      expect(result.status).toBe('APPROVED');
    });

    it('should update approval request if exists', async () => {
      const mockComparison = {
        id: 'comparison-1',
        metadata: {},
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        baseline: { screenshots: '[]' },
        screenshot: null,
        approval: { id: 'approval-1' },
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({
        ...mockComparison,
        status: 'APPROVED',
        masksApplied: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any);

      await comparisonsService.approve('user-1', 'comparison-1');

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-1' },
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
    });

    it('should update baseline when requested', async () => {
      const mockComparison = {
        id: 'comparison-1',
        baselineId: 'baseline-1',
        metadata: {},
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        baseline: { id: 'baseline-1', screenshots: '[]' },
        screenshot: { name: 'home.png', url: 'https://...', width: 1920, height: 1080 },
        approval: null,
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({
        ...mockComparison,
        status: 'APPROVED',
        masksApplied: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.baseline.update).mockResolvedValue({} as any);

      await comparisonsService.approve('user-1', 'comparison-1', { updateBaseline: true });

      expect(prisma.baseline.update).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should reject a comparison', async () => {
      const mockComparison = {
        id: 'comparison-1',
        metadata: {},
        status: 'PENDING',
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        baseline: { screenshots: '[]' },
        screenshot: null,
        approval: null,
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({
        ...mockComparison,
        status: 'REJECTED',
        masksApplied: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.approvalRequest.updateMany).mockResolvedValue({ count: 0 });

      const result = await comparisonsService.reject('user-1', 'comparison-1', 'Bug found');

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('bulkApprove', () => {
    it('should approve multiple comparisons', async () => {
      const mockComparison = {
        id: 'comparison-1',
        metadata: {},
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        baseline: { screenshots: '[]' },
        screenshot: null,
        approval: null,
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.comparison.updateMany).mockResolvedValue({ count: 3 });
      vi.mocked(prisma.approvalRequest.updateMany).mockResolvedValue({ count: 3 });

      const result = await comparisonsService.bulkApprove('user-1', ['c-1', 'c-2', 'c-3']);

      expect(result.approved).toBe(3);
    });

    it('should verify access to all comparisons', async () => {
      vi.mocked(prisma.comparison.findUnique)
        .mockResolvedValueOnce({
          execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
          baseline: { screenshots: '[]' },
        } as any)
        .mockResolvedValueOnce({
          execution: { project: { org: { users: [] } } }, // No access
        } as any);

      await expect(
        comparisonsService.bulkApprove('user-1', ['c-1', 'c-2'])
      ).rejects.toThrow('No access');
    });
  });
});
