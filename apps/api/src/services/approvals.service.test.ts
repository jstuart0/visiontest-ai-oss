// VisionTest AI - Approvals Service Tests
// Hospital-Grade: Approval delegation testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvalsService } from './approvals.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    organizationUser: {
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    approvalRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    approvalRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    comparison: {
      update: vi.fn(),
    },
  },
  ApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    ESCALATED: 'ESCALATED',
  },
  Severity: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
}));

describe('ApprovalsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listPending', () => {
    it('should list pending approvals', async () => {
      const mockMemberships = [{ orgId: 'org-1' }];
      const mockApprovals = [
        {
          id: 'approval-1',
          comparisonId: 'comparison-1',
          changeType: 'layout',
          severity: 'MEDIUM',
          confidence: 0.85,
          status: 'PENDING',
          escalations: 0,
          createdAt: new Date(),
          comparison: {
            baseline: { id: 'baseline-1', name: 'Baseline' },
            screenshot: { id: 'screen-1', name: 'Screenshot', url: 'https://...' },
            execution: { id: 'exec-1', project: { id: 'project-1', name: 'Project' } },
          },
        },
      ];

      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue(mockApprovals as any);

      const result = await approvalsService.listPending('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });

    it('should return empty array when user has no organizations', async () => {
      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue([]);

      const result = await approvalsService.listPending('user-1');

      expect(result).toEqual([]);
      expect(prisma.approvalRequest.findMany).not.toHaveBeenCalled();
    });

    it('should filter by assignedTo', async () => {
      const mockMemberships = [{ orgId: 'org-1' }];

      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([]);

      await approvalsService.listPending('user-1', { assignedTo: 'user-2' });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedTo: 'user-2' }),
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return approval statistics', async () => {
      const mockMemberships = [{ orgId: 'org-1' }];

      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(prisma.approvalRequest.count)
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5)  // approvedToday
        .mockResolvedValueOnce(2); // rejectedToday
      vi.mocked(prisma.approvalRequest.aggregate).mockResolvedValue({
        _avg: { escalations: 1.5 },
      } as any);

      const result = await approvalsService.getStats('user-1');

      expect(result.pending).toBe(10);
      expect(result.approvedToday).toBe(5);
      expect(result.rejectedToday).toBe(2);
      expect(result.avgEscalations).toBe(1.5);
    });

    it('should return zeros when user has no organizations', async () => {
      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue([]);

      const result = await approvalsService.getStats('user-1');

      expect(result).toEqual({
        pending: 0,
        approvedToday: 0,
        rejectedToday: 0,
        avgEscalations: 0,
      });
    });
  });

  describe('approve', () => {
    it('should approve a request', async () => {
      const mockApproval = {
        id: 'approval-1',
        comparisonId: 'comparison-1',
        changeType: 'layout',
        severity: 'MEDIUM',
        confidence: 0.85,
        status: 'PENDING',
        escalations: 0,
        comparison: {
          execution: {
            project: { org: { users: [{ userId: 'user-1' }] } },
          },
        },
      };
      const updatedApproval = {
        ...mockApproval,
        status: 'APPROVED',
        approvedBy: 'user-1',
        resolvedAt: new Date(),
        createdAt: new Date(),
      };

      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(mockApproval as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue(updatedApproval as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({} as any);

      const result = await approvalsService.approve('user-1', 'approval-1');

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe('user-1');
    });

    it('should update comparison status', async () => {
      const mockApproval = {
        id: 'approval-1',
        comparisonId: 'comparison-1',
        comparison: {
          execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        },
      };

      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(mockApproval as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({
        ...mockApproval,
        status: 'APPROVED',
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({} as any);

      await approvalsService.approve('user-1', 'approval-1');

      expect(prisma.comparison.update).toHaveBeenCalledWith({
        where: { id: 'comparison-1' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      });
    });

    it('should throw NotFoundError for missing approval', async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(null);

      await expect(approvalsService.approve('user-1', 'approval-1')).rejects.toThrow('not found');
    });
  });

  describe('reject', () => {
    it('should reject a request with comment', async () => {
      const mockApproval = {
        id: 'approval-1',
        comparisonId: 'comparison-1',
        changeType: 'layout',
        severity: 'MEDIUM',
        comparison: {
          execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        },
      };

      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(mockApproval as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({
        ...mockApproval,
        status: 'REJECTED',
        approvedBy: 'user-1',
        comment: 'Regression bug',
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({} as any);

      const result = await approvalsService.reject('user-1', 'approval-1', 'Regression bug');

      expect(result.status).toBe('REJECTED');
      expect(result.comment).toBe('Regression bug');
    });
  });

  describe('delegate', () => {
    it('should delegate to another user', async () => {
      const mockApproval = {
        id: 'approval-1',
        comparisonId: 'comparison-1',
        escalations: 0,
        comparison: {
          execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        },
      };

      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(mockApproval as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({
        ...mockApproval,
        assignedTo: 'user-2',
        escalations: 1,
        createdAt: new Date(),
      } as any);

      const result = await approvalsService.delegate('user-1', 'approval-1', 'user-2', 'Please review');

      expect(result.assignedTo).toBe('user-2');
      expect(result.escalations).toBe(1);
    });

    it('should increment escalation count', async () => {
      const mockApproval = {
        id: 'approval-1',
        escalations: 2,
        comparison: {
          execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
        },
      };

      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(mockApproval as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({
        ...mockApproval,
        escalations: 3,
        createdAt: new Date(),
      } as any);

      await approvalsService.delegate('user-1', 'approval-1', 'user-3');

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ escalations: { increment: 1 } }),
        })
      );
    });
  });

  describe('listRules', () => {
    it('should list rules for a project', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockRules = [
        { id: 'rule-1', name: 'Critical Changes', priority: 100 },
        { id: 'rule-2', name: 'Low Priority', priority: 10 },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.approvalRule.findMany).mockResolvedValue(mockRules as any);

      const result = await approvalsService.listRules('user-1', 'project-1');

      expect(result).toHaveLength(2);
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(approvalsService.listRules('user-1', 'project-1')).rejects.toThrow('No access');
    });
  });

  describe('createRule', () => {
    it('should create an approval rule', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockRule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Critical Changes',
        priority: 100,
        conditions: { severity: ['CRITICAL'] },
        routeTo: 'team-leads',
        routeType: 'team',
        autoApprove: false,
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.approvalRule.create).mockResolvedValue(mockRule as any);

      const result = await approvalsService.createRule('user-1', {
        projectId: 'project-1',
        name: 'Critical Changes',
        priority: 100,
        conditions: { severity: ['CRITICAL'] },
        routeTo: 'team-leads',
        routeType: 'team',
      });

      expect(result.name).toBe('Critical Changes');
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      const mockRule = {
        id: 'rule-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.approvalRule.findUnique).mockResolvedValue(mockRule as any);
      vi.mocked(prisma.approvalRule.delete).mockResolvedValue(mockRule as any);

      await approvalsService.deleteRule('user-1', 'rule-1');

      expect(prisma.approvalRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    });

    it('should throw NotFoundError when rule not found', async () => {
      vi.mocked(prisma.approvalRule.findUnique).mockResolvedValue(null);

      await expect(approvalsService.deleteRule('user-1', 'rule-1')).rejects.toThrow('not found');
    });
  });
});
