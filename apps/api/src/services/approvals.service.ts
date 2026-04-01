// VisionTest AI - Approvals Service
// Hospital-Grade: Approval delegation for visual diffs

import { prisma, ApprovalStatus, Severity } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface ApprovalRequestResult {
  id: string;
  comparisonId: string;
  changeType: string;
  severity: Severity;
  confidence: number;
  assignedTo: string | null;
  status: ApprovalStatus;
  approvedBy: string | null;
  comment: string | null;
  escalations: number;
  createdAt: Date;
  resolvedAt: Date | null;
  dueAt: Date | null;
}

export interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgEscalations: number;
}

export interface ApprovalRuleInput {
  projectId: string;
  name: string;
  priority?: number;
  conditions: {
    changeType?: string[];
    severity?: Severity[];
    component?: string[];
    confidence?: { min?: number; max?: number };
  };
  routeTo: string;
  routeType: 'user' | 'team' | 'slack' | 'email';
  autoApprove?: boolean;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ApprovalsService {
  /**
   * List pending approval requests.
   */
  async listPending(userId: string, options?: {
    projectId?: string;
    assignedTo?: string;
  }): Promise<ApprovalRequestResult[]> {
    // Get user's organizations
    const memberships = await prisma.organizationUser.findMany({
      where: { userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    if (orgIds.length === 0) {
      return [];
    }

    const where: any = {
      status: 'PENDING',
      comparison: {
        execution: {
          project: {
            orgId: { in: orgIds },
            ...(options?.projectId && { id: options.projectId }),
          },
        },
      },
    };

    if (options?.assignedTo) {
      where.assignedTo = options.assignedTo;
    }

    const approvals = await prisma.approvalRequest.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        comparison: {
          include: {
            baseline: { select: { id: true, name: true } },
            screenshot: { select: { id: true, name: true, url: true } },
            execution: {
              select: {
                id: true,
                project: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return approvals.map((a) => ({
      id: a.id,
      comparisonId: a.comparisonId,
      changeType: a.changeType,
      severity: a.severity,
      confidence: a.confidence,
      assignedTo: a.assignedTo,
      status: a.status,
      approvedBy: a.approvedBy,
      comment: a.comment,
      escalations: a.escalations,
      createdAt: a.createdAt,
      resolvedAt: a.resolvedAt,
      dueAt: a.dueAt,
    }));
  }

  /**
   * Get approval statistics.
   */
  async getStats(userId: string, projectId?: string): Promise<ApprovalStats> {
    const memberships = await prisma.organizationUser.findMany({
      where: { userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    if (orgIds.length === 0) {
      return { pending: 0, approvedToday: 0, rejectedToday: 0, avgEscalations: 0 };
    }

    const baseWhere = {
      comparison: {
        execution: {
          project: {
            orgId: { in: orgIds },
            ...(projectId && { id: projectId }),
          },
        },
      },
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [pending, approvedToday, rejectedToday, avgEscalations] = await Promise.all([
      prisma.approvalRequest.count({
        where: { ...baseWhere, status: 'PENDING' },
      }),
      prisma.approvalRequest.count({
        where: {
          ...baseWhere,
          status: 'APPROVED',
          resolvedAt: { gte: todayStart },
        },
      }),
      prisma.approvalRequest.count({
        where: {
          ...baseWhere,
          status: 'REJECTED',
          resolvedAt: { gte: todayStart },
        },
      }),
      prisma.approvalRequest.aggregate({
        where: {
          ...baseWhere,
          resolvedAt: { not: null },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _avg: { escalations: true },
      }),
    ]);

    return {
      pending,
      approvedToday,
      rejectedToday,
      avgEscalations: avgEscalations._avg.escalations || 0,
    };
  }

  /**
   * Approve a request.
   */
  async approve(userId: string, approvalId: string, options?: {
    comment?: string;
    updateBaseline?: boolean;
  }): Promise<ApprovalRequestResult> {
    const approval = await this.getApprovalWithAccess(userId, approvalId);

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        comment: options?.comment,
        resolvedAt: new Date(),
      },
    });

    // Update comparison
    await prisma.comparison.update({
      where: { id: approval.comparisonId },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
      },
    });

    logger.info(`Approval approved: ${approval.id}`);

    return {
      id: updated.id,
      comparisonId: updated.comparisonId,
      changeType: updated.changeType,
      severity: updated.severity,
      confidence: updated.confidence,
      assignedTo: updated.assignedTo,
      status: updated.status,
      approvedBy: updated.approvedBy,
      comment: updated.comment,
      escalations: updated.escalations,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
      dueAt: updated.dueAt,
    };
  }

  /**
   * Reject a request.
   */
  async reject(userId: string, approvalId: string, comment: string): Promise<ApprovalRequestResult> {
    const approval = await this.getApprovalWithAccess(userId, approvalId);

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
        comment,
        resolvedAt: new Date(),
      },
    });

    await prisma.comparison.update({
      where: { id: approval.comparisonId },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
      },
    });

    logger.info(`Approval rejected: ${approval.id}`);

    return {
      id: updated.id,
      comparisonId: updated.comparisonId,
      changeType: updated.changeType,
      severity: updated.severity,
      confidence: updated.confidence,
      assignedTo: updated.assignedTo,
      status: updated.status,
      approvedBy: updated.approvedBy,
      comment: updated.comment,
      escalations: updated.escalations,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
      dueAt: updated.dueAt,
    };
  }

  /**
   * Delegate to someone else.
   */
  async delegate(userId: string, approvalId: string, assignTo: string, comment?: string): Promise<ApprovalRequestResult> {
    const approval = await this.getApprovalWithAccess(userId, approvalId);

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        assignedTo: assignTo,
        escalations: { increment: 1 },
        comment: comment ? `Delegated: ${comment}` : undefined,
      },
    });

    logger.info(`Approval delegated: ${approval.id} -> ${assignTo}`);

    return {
      id: updated.id,
      comparisonId: updated.comparisonId,
      changeType: updated.changeType,
      severity: updated.severity,
      confidence: updated.confidence,
      assignedTo: updated.assignedTo,
      status: updated.status,
      approvedBy: updated.approvedBy,
      comment: updated.comment,
      escalations: updated.escalations,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
      dueAt: updated.dueAt,
    };
  }

  /**
   * List approval rules for a project.
   */
  async listRules(userId: string, projectId: string) {
    await this.checkProjectAccess(userId, projectId);

    return prisma.approvalRule.findMany({
      where: { projectId },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * Create an approval rule.
   */
  async createRule(userId: string, input: ApprovalRuleInput) {
    await this.checkProjectAccess(userId, input.projectId);

    const rule = await prisma.approvalRule.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        priority: input.priority || 0,
        conditions: input.conditions,
        routeTo: input.routeTo,
        routeType: input.routeType,
        autoApprove: input.autoApprove || false,
      },
    });

    logger.info(`Approval rule created: ${rule.id}`);

    return rule;
  }

  /**
   * Delete an approval rule.
   */
  async deleteRule(userId: string, ruleId: string): Promise<void> {
    const rule = await prisma.approvalRule.findUnique({
      where: { id: ruleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId } } } },
          },
        },
      },
    });

    if (!rule) {
      throw NotFoundError('Approval rule');
    }

    if (rule.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    await prisma.approvalRule.delete({ where: { id: ruleId } });

    logger.info(`Approval rule deleted: ${ruleId}`);
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async checkProjectAccess(userId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: { include: { users: { where: { userId } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }
  }

  private async getApprovalWithAccess(userId: string, approvalId: string) {
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: {
        comparison: {
          include: {
            execution: {
              include: {
                project: {
                  include: {
                    org: { include: { users: { where: { userId } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!approval) {
      throw NotFoundError('Approval request');
    }

    if (approval.comparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    return approval;
  }
}

export const approvalsService = new ApprovalsService();
export default approvalsService;
