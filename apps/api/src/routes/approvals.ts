// VisionTest.ai - Approval Delegation Routes
// P2 Feature: Route visual diffs to the right reviewers

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, ApprovalStatus, Severity } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createRuleSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  priority: z.number().optional(),
  conditions: z.object({
    changeType: z.array(z.string()).optional(),
    severity: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
    component: z.array(z.string()).optional(),
    confidence: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }),
  routeTo: z.string(),
  routeType: z.enum(['user', 'team', 'slack', 'email']),
  autoApprove: z.boolean().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /approvals/pending
 * List pending approval requests
 */
router.get('/pending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, assignedTo } = req.query;

    const where: any = {
      status: 'PENDING',
    };

    if (assignedTo) {
      where.assignedTo = assignedTo as string;
    }

    // Get user's organizations to filter
    const memberships = await prisma.organizationUser.findMany({
      where: { userId: req.user!.id },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    const approvals = await prisma.approvalRequest.findMany({
      where: {
        ...where,
        comparison: {
          execution: {
            project: {
              orgId: { in: orgIds },
              ...(projectId && { id: projectId as string }),
            },
          },
        },
      },
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

    res.json({
      success: true,
      data: approvals,
      meta: { total: approvals.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /approvals/stats
 * Get approval statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    // Get user's organizations
    const memberships = await prisma.organizationUser.findMany({
      where: { userId: req.user!.id },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    const baseWhere = {
      comparison: {
        execution: {
          project: {
            orgId: { in: orgIds },
            ...(projectId && { id: projectId as string }),
          },
        },
      },
    };

    const [pending, approvedToday, rejectedToday, avgResolutionTime] = await Promise.all([
      prisma.approvalRequest.count({
        where: { ...baseWhere, status: 'PENDING' },
      }),
      prisma.approvalRequest.count({
        where: {
          ...baseWhere,
          status: 'APPROVED',
          resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.approvalRequest.count({
        where: {
          ...baseWhere,
          status: 'REJECTED',
          resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.approvalRequest.aggregate({
        where: {
          ...baseWhere,
          resolvedAt: { not: null },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _avg: {
          escalations: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        pending,
        approvedToday,
        rejectedToday,
        avgEscalations: avgResolutionTime._avg.escalations || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /approvals/:id/approve
 * Approve a request
 */
router.post('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comment, updateBaseline } = z.object({
      comment: z.string().optional(),
      updateBaseline: z.boolean().optional(),
    }).parse(req.body);

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
      include: {
        comparison: {
          include: {
            execution: {
              include: {
                project: {
                  include: {
                    org: { include: { users: { where: { userId: req.user!.id } } } },
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

    // Update approval
    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
        comment,
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

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /approvals/:id/reject
 * Reject a request
 */
router.post('/:id/reject', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comment } = z.object({
      comment: z.string(),
    }).parse(req.body);

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
      include: {
        comparison: {
          include: {
            execution: {
              include: {
                project: {
                  include: {
                    org: { include: { users: { where: { userId: req.user!.id } } } },
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

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user!.id,
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

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /approvals/:id/delegate
 * Delegate to someone else
 */
router.post('/:id/delegate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignTo, comment } = z.object({
      assignTo: z.string(),
      comment: z.string().optional(),
    }).parse(req.body);

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
      include: {
        comparison: {
          include: {
            execution: {
              include: {
                project: {
                  include: {
                    org: { include: { users: { where: { userId: req.user!.id } } } },
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

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        assignedTo: assignTo,
        escalations: { increment: 1 },
        comment: comment ? `Delegated: ${comment}` : undefined,
      },
    });

    logger.info(`Approval delegated: ${approval.id} -> ${assignTo}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /approvals/rules
 * List approval rules for a project
 */
router.get('/rules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const rules = await prisma.approvalRule.findMany({
      where: { projectId: projectId as string },
      orderBy: { priority: 'desc' },
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /approvals/rules
 * Create an approval rule
 */
router.post('/rules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRuleSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

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

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /approvals/rules/:ruleId
 * Delete an approval rule
 */
router.delete('/rules/:ruleId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await prisma.approvalRule.findUnique({
      where: { id: req.params.ruleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
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

    await prisma.approvalRule.delete({
      where: { id: rule.id },
    });

    logger.info(`Approval rule deleted: ${rule.id}`);

    res.json({
      success: true,
      data: { message: 'Rule deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
