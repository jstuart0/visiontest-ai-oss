// VisionTest.ai - Project Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createProjectSchema = z.object({
  orgId: z.string().cuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  repoUrl: z.string().url().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  repoUrl: z.string().url().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: {
        include: {
          users: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!project) {
    throw NotFoundError('Project');
  }

  if (project.org.users.length === 0) {
    throw ForbiddenError('No access to this project');
  }

  return { project, role: project.org.users[0].role };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /projects
 * List projects user has access to
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.query;

    // Get user's organizations
    const memberships = await prisma.organizationUser.findMany({
      where: { 
        userId: req.user!.id,
        ...(orgId && { orgId: orgId as string }),
      },
      select: { orgId: true },
    });

    const orgIds = memberships.map((m) => m.orgId);

    // Get projects
    const projects = await prisma.project.findMany({
      where: { orgId: { in: orgIds }, deletedAt: null },
      include: {
        _count: {
          select: {
            tests: true,
            suites: true,
            baselines: true,
            executions: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: projects.map((p) => ({
        ...p,
        testCount: p._count.tests,
        suiteCount: p._count.suites,
        baselineCount: p._count.baselines,
        recentExecutions: p._count.executions,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects
 * Create a new project
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, name, slug, description, repoUrl } = createProjectSchema.parse(req.body);

    // Check org membership (at least member)
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user!.id,
          orgId,
        },
      },
    });

    if (!membership) {
      throw ForbiddenError('Not a member of this organization');
    }

    // Generate slug if not provided
    let projectSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Check if slug is unique within org
    const existing = await prisma.project.findUnique({
      where: {
        orgId_slug: {
          orgId,
          slug: projectSlug,
        },
      },
    });

    if (existing) {
      throw BadRequestError('Project slug already exists in this organization');
    }

    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        slug: projectSlug,
        description,
        repoUrl,
        settings: {
          defaultBrowser: 'chromium',
          defaultViewport: { width: 1920, height: 1080 },
          screenshotOnFailure: true,
          videoOnFailure: false,
          flakyThreshold: 35,
          ciBlockQuarantined: false,
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId,
        userId: req.user!.id,
        action: 'project.created',
        resource: 'project',
        resourceId: project.id,
      },
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId
 * Get project details
 */
router.get('/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project, role } = await checkProjectAccess(req.user!.id, req.params.projectId);

    // Get counts
    const [testCount, suiteCount, baselineCount, flakyCount] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.testSuite.count({ where: { projectId: project.id } }),
      prisma.baseline.count({ where: { projectId: project.id } }),
      prisma.flakyTest.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
    ]);

    // Get recent executions
    const recentExecutions = await prisma.execution.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        triggeredBy: true,
        duration: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        ...project,
        role,
        stats: {
          testCount,
          suiteCount,
          baselineCount,
          flakyCount,
        },
        recentExecutions,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /projects/:projectId
 * Update project
 */
router.patch('/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project, role } = await checkProjectAccess(req.user!.id, req.params.projectId);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required');
    }

    const updates = updateProjectSchema.parse(req.body);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        name: updates.name,
        description: updates.description,
        repoUrl: updates.repoUrl,
        ...(updates.settings && {
          settings: {
            ...(project.settings as any),
            ...updates.settings,
          } as Prisma.InputJsonValue,
        }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        userId: req.user!.id,
        action: 'project.updated',
        resource: 'project',
        resourceId: project.id,
        details: { name: updates.name, description: updates.description, repoUrl: updates.repoUrl } as Prisma.InputJsonValue,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /projects/:projectId
 * Delete project
 */
router.delete('/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project, role } = await checkProjectAccess(req.user!.id, req.params.projectId);

    if (role !== 'OWNER') {
      throw ForbiddenError('Owner access required');
    }

    // Soft delete - set deletedAt timestamp instead of hard delete
    await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        userId: req.user!.id,
        action: 'project.deleted',
        resource: 'project',
        resourceId: project.id,
      },
    });

    res.json({
      success: true,
      data: { message: 'Project deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/stats
 * Get project statistics
 */
router.get('/:projectId/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project } = await checkProjectAccess(req.user!.id, req.params.projectId);

    // Date ranges
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get statistics
    const [
      totalTests,
      activeTests,
      quarantinedTests,
      totalExecutions,
      passedExecutions,
      failedExecutions,
      executionsToday,
      executionsWeek,
      avgDuration,
    ] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.test.count({ where: { projectId: project.id, status: 'ACTIVE' } }),
      prisma.test.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: month } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'PASSED', createdAt: { gte: month } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'FAILED', createdAt: { gte: month } } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: day } } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: week } } }),
      prisma.execution.aggregate({
        where: { projectId: project.id, duration: { not: null }, createdAt: { gte: month } },
        _avg: { duration: true },
      }),
    ]);

    const passRate = totalExecutions > 0 
      ? Math.round((passedExecutions / totalExecutions) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        tests: {
          total: totalTests,
          active: activeTests,
          quarantined: quarantinedTests,
        },
        executions: {
          total: totalExecutions,
          passed: passedExecutions,
          failed: failedExecutions,
          passRate,
          today: executionsToday,
          thisWeek: executionsWeek,
          avgDuration: avgDuration._avg.duration,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /projects/:projectId/dashboard/stats
 * Get dashboard statistics (frontend-friendly format)
 */
router.get('/:projectId/dashboard/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project } = await checkProjectAccess(req.user!.id, req.params.projectId);

    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalTests,
      quarantinedTests,
      flakyTests,
      passedExecutions,
      failedExecutions,
      pendingComparisons,
      executionsToday,
    ] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.test.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
      prisma.flakyTest.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'PASSED' } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'FAILED' } }),
      prisma.comparison.count({ where: { execution: { projectId: project.id }, status: 'PENDING' } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: day } } }),
    ]);

    res.json({
      success: true,
      data: {
        totalTests,
        passingTests: passedExecutions,
        failingTests: failedExecutions,
        flakyTests: flakyTests || quarantinedTests,
        pendingVisuals: pendingComparisons,
        testsRunToday: executionsToday,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /projects/:projectId/tests/:testId/run
 * Run a specific test (nested route for frontend compatibility)
 */
router.post('/:projectId/tests/:testId/run', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, testId } = req.params;
    const { branch, environment } = req.body;

    // Check project access
    await checkProjectAccess(req.user!.id, projectId);

    // Get the test
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { project: true },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.projectId !== projectId) {
      throw BadRequestError('Test does not belong to this project');
    }

    if (test.status === 'QUARANTINED') {
      throw BadRequestError('Cannot run quarantined test');
    }

    // Create execution
    const execution = await prisma.execution.create({
      data: {
        projectId: test.projectId,
        testId: test.id,
        status: 'PENDING',
        triggeredBy: 'MANUAL',
        metadata: {
          branch: branch || 'main',
          environment: environment || 'development',
          triggeredByUser: req.user!.id,
        },
      },
    });

    // Queue the job
    try {
      const { queueExecution } = await import('../lib/queue');
      await queueExecution({
        executionId: execution.id,
        projectId: test.projectId,
        testId: test.id,
        config: {
          browser: req.body.browser || 'chromium',
          branch: branch || 'main',
          environment: environment || 'development',
        },
      });
    } catch (e) {
      logger.error({ error: e, executionId: execution.id }, 'Failed to queue execution');
    }

    res.status(201).json({
      success: true,
      data: { execution, test },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
