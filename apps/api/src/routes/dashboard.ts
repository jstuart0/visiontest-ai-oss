// VisionTest.ai - Dashboard Routes

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

function getPeriodDays(period: string): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 7;
  }
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /dashboard/stats
 * Dashboard stats: total tests, pass/fail, flaky count, pending visuals, runs today
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const { project } = await checkProjectAccess(req.user!.id, projectId as string);

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalTests,
      passedExecutions,
      failedExecutions,
      flakyCount,
      pendingVisuals,
      runsToday,
    ] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.execution.count({
        where: { projectId: project.id, status: 'PASSED' },
      }),
      prisma.execution.count({
        where: { projectId: project.id, status: 'FAILED' },
      }),
      prisma.flakyTest.count({
        where: {
          projectId: project.id,
          status: { in: ['QUARANTINED', 'WARNING', 'WATCHING'] },
        },
      }),
      prisma.comparison.count({
        where: {
          execution: { projectId: project.id },
          status: 'PENDING',
        },
      }),
      prisma.execution.count({
        where: {
          projectId: project.id,
          createdAt: { gte: dayAgo },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalTests,
        passingTests: passedExecutions,
        failingTests: failedExecutions,
        flakyTests: flakyCount,
        flakyCount,
        pendingVisuals,
        testsRunToday: runsToday,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dashboard/analytics
 * Trend data: daily pass/fail counts, execution times, flaky trends
 */
router.get('/analytics', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, period } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const { project } = await checkProjectAccess(req.user!.id, projectId as string);

    const days = getPeriodDays((period as string) || '7d');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get all executions in the period
    const executions = await prisma.execution.findMany({
      where: {
        projectId: project.id,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        duration: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyStats: Record<string, {
      date: string;
      passed: number;
      failed: number;
      total: number;
      avgDuration: number;
      durations: number[];
    }> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = {
        date: dateKey,
        passed: 0,
        failed: 0,
        total: 0,
        avgDuration: 0,
        durations: [],
      };
    }

    for (const exec of executions) {
      const dateKey = exec.createdAt.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) continue;

      dailyStats[dateKey].total++;
      if (exec.status === 'PASSED') {
        dailyStats[dateKey].passed++;
      } else if (exec.status === 'FAILED') {
        dailyStats[dateKey].failed++;
      }
      if (exec.duration) {
        dailyStats[dateKey].durations.push(exec.duration);
      }
    }

    // Calculate averages
    const trend = Object.values(dailyStats).map((day) => {
      const avgDuration = day.durations.length > 0
        ? Math.round(day.durations.reduce((a, b) => a + b, 0) / day.durations.length)
        : 0;
      return {
        date: day.date,
        passed: day.passed,
        failed: day.failed,
        total: day.total,
        passRate: day.total > 0 ? Math.round((day.passed / day.total) * 100) : 0,
        avgDuration,
      };
    });

    // Get flaky trend
    const flakyTests = await prisma.flakyTest.findMany({
      where: {
        projectId: project.id,
      },
      select: {
        flakinessScore: true,
        status: true,
        updatedAt: true,
      },
    });

    const flakyByStatus = {
      quarantined: flakyTests.filter((f) => f.status === 'QUARANTINED').length,
      warning: flakyTests.filter((f) => f.status === 'WARNING').length,
      watching: flakyTests.filter((f) => f.status === 'WATCHING').length,
      stable: flakyTests.filter((f) => f.status === 'STABLE').length,
    };

    // Top failing tests
    const failedExecutions = await prisma.execution.groupBy({
      by: ['testId'],
      where: {
        projectId: project.id,
        status: 'FAILED',
        createdAt: { gte: startDate },
        testId: { not: null },
      },
      _count: { testId: true },
      orderBy: { _count: { testId: 'desc' } },
      take: 10,
    });

    const failedTestIds = failedExecutions.map((e) => e.testId).filter(Boolean) as string[];
    const failedTests = failedTestIds.length > 0
      ? await prisma.test.findMany({
          where: { id: { in: failedTestIds } },
          select: { id: true, name: true },
        })
      : [];

    const topFailingTests = failedExecutions.map((e) => ({
      testId: e.testId,
      testName: failedTests.find((t) => t.id === e.testId)?.name || 'Unknown',
      failureCount: e._count.testId,
    }));

    // Recent activity
    const recentActivity = await prisma.execution.findMany({
      where: {
        projectId: project.id,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        createdAt: true,
        triggeredBy: true,
        test: { select: { id: true, name: true } },
      },
    });

    // Average diff score
    const comparisons = await prisma.comparison.findMany({
      where: {
        execution: { projectId: project.id, createdAt: { gte: startDate } },
        diffScore: { gt: 0 },
      },
      select: { diffScore: true },
    });
    const avgDiff = comparisons.length > 0
      ? comparisons.reduce((sum, c) => sum + (c.diffScore || 0), 0) / comparisons.length
      : 0;

    res.json({
      success: true,
      data: {
        period: `${days}d`,
        trend,
        summary: {
          totalExecutions: executions.length,
          totalPassed: executions.filter((e) => e.status === 'PASSED').length,
          totalFailed: executions.filter((e) => e.status === 'FAILED').length,
          overallPassRate: executions.length > 0
            ? Math.round((executions.filter((e) => e.status === 'PASSED').length / executions.length) * 100)
            : 0,
          avgDiff,
        },
        flaky: flakyByStatus,
        topFailingTests,
        recentActivity: recentActivity.map((e) => ({
          id: e.id,
          testName: e.test?.name || 'Unknown',
          status: e.status,
          triggeredBy: e.triggeredBy,
          createdAt: e.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
