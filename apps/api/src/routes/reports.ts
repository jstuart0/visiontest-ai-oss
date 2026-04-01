// VisionTest AI - Report Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: {
        include: {
          users: { where: { userId } },
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
 * GET /reports
 * Generate report data for a project
 * Query params: projectId, type (summary|detailed)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, type } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const reportType = (type as string) || 'summary';
    if (!['summary', 'detailed'].includes(reportType)) {
      throw BadRequestError('type must be "summary" or "detailed"');
    }

    const { project } = await checkProjectAccess(req.user!.id, projectId as string);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Core stats
    const [
      totalTests,
      activeTests,
      quarantinedTests,
      disabledTests,
      totalExecutions30d,
      passedExecutions30d,
      failedExecutions30d,
      totalExecutions7d,
      passedExecutions7d,
      failedExecutions7d,
      pendingComparisons,
      totalBaselines,
      flakyTests,
      avgDuration,
    ] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.test.count({ where: { projectId: project.id, status: 'ACTIVE' } }),
      prisma.test.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
      prisma.test.count({ where: { projectId: project.id, status: 'DISABLED' } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'PASSED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'FAILED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: sevenDaysAgo } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'PASSED', createdAt: { gte: sevenDaysAgo } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'FAILED', createdAt: { gte: sevenDaysAgo } } }),
      prisma.comparison.count({ where: { execution: { projectId: project.id }, status: 'PENDING' } }),
      prisma.baseline.count({ where: { projectId: project.id } }),
      prisma.flakyTest.findMany({
        where: { projectId: project.id },
        select: { id: true, flakinessScore: true, status: true, testId: true },
      }),
      prisma.execution.aggregate({
        where: { projectId: project.id, duration: { not: null }, createdAt: { gte: thirtyDaysAgo } },
        _avg: { duration: true },
      }),
    ]);

    const summaryReport = {
      generatedAt: now.toISOString(),
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      tests: {
        total: totalTests,
        active: activeTests,
        quarantined: quarantinedTests,
        disabled: disabledTests,
      },
      executions: {
        last30d: {
          total: totalExecutions30d,
          passed: passedExecutions30d,
          failed: failedExecutions30d,
          passRate: totalExecutions30d > 0
            ? Math.round((passedExecutions30d / totalExecutions30d) * 100)
            : 0,
        },
        last7d: {
          total: totalExecutions7d,
          passed: passedExecutions7d,
          failed: failedExecutions7d,
          passRate: totalExecutions7d > 0
            ? Math.round((passedExecutions7d / totalExecutions7d) * 100)
            : 0,
        },
        avgDuration: avgDuration._avg.duration,
      },
      visuals: {
        baselines: totalBaselines,
        pendingComparisons,
      },
      flaky: {
        total: flakyTests.length,
        quarantined: flakyTests.filter((f) => f.status === 'QUARANTINED').length,
        warning: flakyTests.filter((f) => f.status === 'WARNING').length,
        avgScore: flakyTests.length > 0
          ? Math.round(flakyTests.reduce((sum, f) => sum + f.flakinessScore, 0) / flakyTests.length)
          : 0,
      },
    };

    // For detailed reports, include additional data
    if (reportType === 'detailed') {
      const [recentExecutions, topFlakyTests, recentComparisons, suites] = await Promise.all([
        prisma.execution.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            status: true,
            triggeredBy: true,
            duration: true,
            createdAt: true,
            completedAt: true,
            test: { select: { id: true, name: true } },
          },
        }),
        prisma.flakyTest.findMany({
          where: { projectId: project.id },
          orderBy: { flakinessScore: 'desc' },
          take: 10,
          include: {
            test: { select: { id: true, name: true, status: true } },
          },
        }),
        prisma.comparison.findMany({
          where: { execution: { projectId: project.id } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            diffScore: true,
            status: true,
            createdAt: true,
            baseline: { select: { id: true, name: true } },
          },
        }),
        prisma.testSuite.findMany({
          where: { projectId: project.id },
          include: {
            _count: { select: { tests: true } },
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          ...summaryReport,
          details: {
            recentExecutions,
            topFlakyTests,
            recentComparisons,
            suites: suites.map((s) => ({
              id: s.id,
              name: s.name,
              testCount: s._count.tests,
            })),
          },
        },
      });
      return;
    }

    res.json({
      success: true,
      data: summaryReport,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
