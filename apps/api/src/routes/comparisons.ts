// VisionTest.ai - Comparison Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, ComparisonStatus, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /comparisons
 * List comparisons for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, executionId, status, page = '1', limit = '20' } = req.query;

    if (!projectId && !executionId) {
      throw BadRequestError('projectId or executionId is required');
    }

    // Build query
    const where: any = {};
    
    if (executionId) {
      where.executionId = executionId as string;
    }

    if (projectId) {
      where.execution = { projectId: projectId as string };
    }

    if (status) {
      // Convert to uppercase for Prisma enum
      const statusUpper = (status as string).toUpperCase();
      if (Object.values(ComparisonStatus).includes(statusUpper as ComparisonStatus)) {
        where.status = statusUpper as ComparisonStatus;
      }
    }

    // Check access via execution
    const sampleComparison = await prisma.comparison.findFirst({
      where,
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
    });

    if (sampleComparison && sampleComparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [comparisons, total] = await Promise.all([
      prisma.comparison.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          baseline: { select: { id: true, name: true, branch: true } },
          screenshot: { select: { id: true, name: true, url: true } },
          approval: true,
        },
      }),
      prisma.comparison.count({ where }),
    ]);

    res.json({
      success: true,
      data: comparisons,
      meta: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        hasMore: skip + comparisons.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /comparisons/:comparisonId
 * Get comparison details
 */
router.get('/:comparisonId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comparison = await prisma.comparison.findUnique({
      where: { id: req.params.comparisonId },
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
        baseline: true,
        screenshot: true,
        approval: true,
      },
    });

    if (!comparison) {
      throw NotFoundError('Comparison');
    }

    if (comparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /comparisons/:comparisonId/approve
 * Approve a comparison
 */
router.post('/:comparisonId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comment, updateBaseline } = z.object({
      comment: z.string().optional(),
      updateBaseline: z.boolean().optional(),
    }).parse(req.body);

    const comparison = await prisma.comparison.findUnique({
      where: { id: req.params.comparisonId },
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
        baseline: true,
        screenshot: true,
        approval: true,
      },
    });

    if (!comparison) {
      throw NotFoundError('Comparison');
    }

    if (comparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Update comparison
    const updated = await prisma.comparison.update({
      where: { id: comparison.id },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
        metadata: {
          ...(comparison.metadata as any || {}),
          approvedBy: req.user!.id,
          approvedAt: new Date().toISOString(),
          comment,
        },
      },
    });

    // Update approval request if exists
    if (comparison.approval) {
      await prisma.approvalRequest.update({
        where: { id: comparison.approval.id },
        data: {
          status: 'APPROVED',
          approvedBy: req.user!.id,
          comment,
          resolvedAt: new Date(),
        },
      });
    }

    // Update baseline if requested
    if (updateBaseline && comparison.screenshot) {
      const currentScreenshots = JSON.parse(comparison.baseline.screenshots as string);
      const screenshotIndex = currentScreenshots.findIndex((s: any) => s.name === comparison.screenshot!.name);
      
      if (screenshotIndex >= 0) {
        currentScreenshots[screenshotIndex] = {
          name: comparison.screenshot.name,
          url: comparison.screenshot.url,
          width: comparison.screenshot.width,
          height: comparison.screenshot.height,
        };
      } else {
        currentScreenshots.push({
          name: comparison.screenshot.name,
          url: comparison.screenshot.url,
          width: comparison.screenshot.width,
          height: comparison.screenshot.height,
        });
      }

      await prisma.baseline.update({
        where: { id: comparison.baselineId },
        data: {
          screenshots: JSON.stringify(currentScreenshots),
        },
      });

      logger.info(`Baseline updated from approval: ${comparison.baselineId}`);
    }

    logger.info(`Comparison approved: ${comparison.id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /comparisons/:comparisonId/reject
 * Reject a comparison
 */
router.post('/:comparisonId/reject', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comment, createBug } = z.object({
      comment: z.string(),
      createBug: z.boolean().optional(),
    }).parse(req.body);

    const comparison = await prisma.comparison.findUnique({
      where: { id: req.params.comparisonId },
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
    });

    if (!comparison) {
      throw NotFoundError('Comparison');
    }

    if (comparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const updated = await prisma.comparison.update({
      where: { id: comparison.id },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        metadata: {
          ...(comparison.metadata as any || {}),
          rejectedBy: req.user!.id,
          rejectedAt: new Date().toISOString(),
          comment,
        },
      },
    });

    // Update approval request if exists
    await prisma.approvalRequest.updateMany({
      where: { comparisonId: comparison.id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user!.id,
        comment,
        resolvedAt: new Date(),
      },
    });

    // Create bug in issue tracker if requested
    if (createBug) {
      const { issueTrackerService } = await import('../services/issueTracker.service');
      const bugResult = await issueTrackerService.createBug({
        projectId: comparison.execution.project.id,
        comparisonId: comparison.id,
        title: `Visual regression detected in comparison`,
        description: comment,
        severity: 'MEDIUM',
        diffUrl: comparison.diffUrl || undefined,
      });
      logger.info(`Bug created for comparison: ${comparison.id}`, { bug: bugResult });
    }

    logger.info(`Comparison rejected: ${comparison.id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /comparisons/bulk-approve
 * Bulk approve comparisons
 */
router.post('/bulk-approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comparisonIds, updateBaseline } = z.object({
      comparisonIds: z.array(z.string().cuid()),
      updateBaseline: z.boolean().optional(),
    }).parse(req.body);

    // Verify access to all comparisons
    const comparisons = await prisma.comparison.findMany({
      where: { id: { in: comparisonIds } },
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
    });

    for (const comparison of comparisons) {
      if (comparison.execution.project.org.users.length === 0) {
        throw ForbiddenError('No access to one or more comparisons');
      }
    }

    // Update all
    await prisma.comparison.updateMany({
      where: { id: { in: comparisonIds } },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
      },
    });

    // Update approval requests
    await prisma.approvalRequest.updateMany({
      where: { comparisonId: { in: comparisonIds } },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
        resolvedAt: new Date(),
      },
    });

    logger.info(`Bulk approved ${comparisonIds.length} comparisons`);

    res.json({
      success: true,
      data: { approved: comparisonIds.length },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
