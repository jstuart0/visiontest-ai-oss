// VisionTest.ai - Flaky Test Quarantine Routes
// P1 Feature: Auto-detect and isolate unreliable tests

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, FlakyStatus, TestStatus } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// CONSTANTS
// =============================================================================

const FLAKY_CONFIG = {
  WINDOW_DAYS: 30,
  MIN_RUNS: 5,
  WARNING_THRESHOLD: 20,
  QUARANTINE_THRESHOLD: 35,
  STABLE_THRESHOLD: 5,
};

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const updateFlakySchema = z.object({
  status: z.enum(['WATCHING', 'WARNING', 'QUARANTINED', 'STABLE', 'INVESTIGATING']).optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateFlakinessScore(history: { passed: boolean }[]): number {
  if (history.length < FLAKY_CONFIG.MIN_RUNS) return 0;

  const failures = history.filter((h) => !h.passed).length;
  const failureRate = failures / history.length;

  // Count alternations (pass→fail or fail→pass)
  let alternations = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].passed !== history[i - 1].passed) {
      alternations++;
    }
  }
  const alternationRate = alternations / (history.length - 1);

  // Flakiness = failure rate * alternation factor
  const score = failureRate * 100 * (1 + alternationRate);

  return Math.min(100, Math.round(score * 10) / 10);
}

function determineStatus(
  score: number,
  runs: number,
  currentStatus: FlakyStatus
): FlakyStatus {
  if (runs < FLAKY_CONFIG.MIN_RUNS) return 'WATCHING';

  if (score >= FLAKY_CONFIG.QUARANTINE_THRESHOLD) return 'QUARANTINED';
  if (score >= FLAKY_CONFIG.WARNING_THRESHOLD) return 'WARNING';
  if (score <= FLAKY_CONFIG.STABLE_THRESHOLD && currentStatus === 'QUARANTINED') {
    return 'STABLE';
  }

  return 'WATCHING';
}

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

  if (!project || project.org.users.length === 0) {
    throw ForbiddenError('No access to this project');
  }

  return project;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /flaky
 * List flaky tests for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, status } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    await checkProjectAccess(req.user!.id, projectId as string);

    const where: any = { projectId: projectId as string };
    if (status) {
      where.status = status as string;
    }

    const flakyTests = await prisma.flakyTest.findMany({
      where,
      orderBy: { flakinessScore: 'desc' },
      include: {
        test: {
          select: {
            id: true,
            name: true,
            tags: true,
            status: true,
            suiteId: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: flakyTests.map((ft) => ({
        ...ft,
        runHistory: JSON.parse(ft.runHistory as string),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /flaky/stats
 * Get flaky test statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    await checkProjectAccess(req.user!.id, projectId as string);

    const [quarantined, warning, watching, recentlyStabilized] = await Promise.all([
      prisma.flakyTest.count({
        where: { projectId: projectId as string, status: 'QUARANTINED' },
      }),
      prisma.flakyTest.count({
        where: { projectId: projectId as string, status: 'WARNING' },
      }),
      prisma.flakyTest.count({
        where: { projectId: projectId as string, status: 'WATCHING' },
      }),
      prisma.flakyTest.count({
        where: {
          projectId: projectId as string,
          status: 'STABLE',
          stabilizedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Calculate estimated time saved (assume 2 min per quarantined test per day)
    const timeSaved = quarantined * 2 * 7; // minutes per week

    res.json({
      success: true,
      data: {
        quarantined,
        warning,
        watching,
        stabilized: recentlyStabilized,
        timeSaved,
        thresholds: FLAKY_CONFIG,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /flaky/:testId
 * Get flaky data for a specific test
 */
router.get('/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { testId: req.params.testId },
      include: {
        test: {
          include: {
            project: {
              include: {
                org: {
                  include: {
                    users: { where: { userId: req.user!.id } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!flakyTest) {
      throw NotFoundError('Flaky test data');
    }

    if (flakyTest.test.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: {
        ...flakyTest,
        runHistory: JSON.parse(flakyTest.runHistory as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /flaky/:testId/history
 * Get detailed run history
 */
router.get('/:testId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { testId: req.params.testId },
      include: {
        test: {
          include: {
            project: {
              include: {
                org: {
                  include: {
                    users: { where: { userId: req.user!.id } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!flakyTest) {
      throw NotFoundError('Flaky test data');
    }

    if (flakyTest.test.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const history = JSON.parse(flakyTest.runHistory as string);

    // Calculate daily aggregates
    const dailyStats: Record<string, { passed: number; failed: number; total: number }> = {};
    
    for (const run of history) {
      const date = new Date(run.timestamp).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { passed: 0, failed: 0, total: 0 };
      }
      dailyStats[date].total++;
      if (run.passed) {
        dailyStats[date].passed++;
      } else {
        dailyStats[date].failed++;
      }
    }

    res.json({
      success: true,
      data: {
        runs: history,
        dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          ...stats,
          passRate: Math.round((stats.passed / stats.total) * 100),
        })),
        summary: {
          totalRuns: history.length,
          passedRuns: history.filter((r: any) => r.passed).length,
          failedRuns: history.filter((r: any) => !r.passed).length,
          avgDuration: history.reduce((acc: number, r: any) => acc + (r.duration || 0), 0) / history.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /flaky/:testId/quarantine
 * Manually quarantine a test
 */
router.post('/:testId/quarantine', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: { where: { userId: req.user!.id } },
              },
            },
          },
        },
        flakyData: true,
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Update or create flaky record
    const flakyTest = await prisma.flakyTest.upsert({
      where: { testId: test.id },
      create: {
        testId: test.id,
        projectId: test.projectId,
        status: 'QUARANTINED',
        quarantinedAt: new Date(),
        runHistory: JSON.stringify([]),
      },
      update: {
        status: 'QUARANTINED',
        quarantinedAt: new Date(),
      },
    });

    // Update test status
    await prisma.test.update({
      where: { id: test.id },
      data: { status: TestStatus.QUARANTINED },
    });

    logger.info(`Test manually quarantined: ${test.id}`);

    res.json({
      success: true,
      data: flakyTest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /flaky/:testId/release
 * Release a test from quarantine
 */
router.post('/:testId/release', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { testId: req.params.testId },
      include: {
        test: {
          include: {
            project: {
              include: {
                org: {
                  include: {
                    users: { where: { userId: req.user!.id } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!flakyTest) {
      throw NotFoundError('Flaky test data');
    }

    if (flakyTest.test.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Update flaky record
    const updated = await prisma.flakyTest.update({
      where: { id: flakyTest.id },
      data: {
        status: 'WATCHING',
        stabilizedAt: new Date(),
      },
    });

    // Update test status
    await prisma.test.update({
      where: { id: flakyTest.testId },
      data: { status: TestStatus.ACTIVE },
    });

    logger.info(`Test released from quarantine: ${flakyTest.testId}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /flaky/record
 * Record a test execution result (called by worker)
 */
router.post('/record', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testId, passed, duration, executionId } = z.object({
      testId: z.string().cuid(),
      passed: z.boolean(),
      duration: z.number(),
      executionId: z.string().cuid().optional(),
    }).parse(req.body);

    const test = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    // Get or create flaky record
    let flakyTest = await prisma.flakyTest.findUnique({
      where: { testId },
    });

    const newRun = {
      timestamp: Date.now(),
      passed,
      duration,
      executionId,
    };

    if (!flakyTest) {
      flakyTest = await prisma.flakyTest.create({
        data: {
          testId,
          projectId: test.projectId,
          runHistory: JSON.stringify([newRun]),
          status: 'WATCHING',
        },
      });
    } else {
      // Add to history
      const history = JSON.parse(flakyTest.runHistory as string);
      history.push(newRun);

      // Keep only last 30 days
      const cutoff = Date.now() - FLAKY_CONFIG.WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const recentHistory = history.filter((h: any) => h.timestamp > cutoff);

      // Calculate new score and status
      const score = calculateFlakinessScore(recentHistory);
      const newStatus = determineStatus(score, recentHistory.length, flakyTest.status as FlakyStatus);

      // Determine if status changed
      const statusChanged = newStatus !== flakyTest.status;
      const wasQuarantined = flakyTest.status === 'QUARANTINED';
      const nowQuarantined = newStatus === 'QUARANTINED';

      flakyTest = await prisma.flakyTest.update({
        where: { id: flakyTest.id },
        data: {
          runHistory: JSON.stringify(recentHistory),
          flakinessScore: score,
          status: newStatus,
          lastAnalyzedAt: new Date(),
          ...(nowQuarantined && !wasQuarantined && { quarantinedAt: new Date() }),
          ...(wasQuarantined && !nowQuarantined && { stabilizedAt: new Date() }),
        },
      });

      // Update test status if quarantine changed
      if (statusChanged) {
        if (nowQuarantined) {
          await prisma.test.update({
            where: { id: testId },
            data: { status: TestStatus.QUARANTINED },
          });
          logger.info(`Test auto-quarantined: ${testId} (score: ${score}%)`);
        } else if (wasQuarantined && newStatus === 'STABLE') {
          await prisma.test.update({
            where: { id: testId },
            data: { status: TestStatus.ACTIVE },
          });
          logger.info(`Test stabilized: ${testId} (score: ${score}%)`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...flakyTest,
        runHistory: JSON.parse(flakyTest.runHistory as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /flaky/should-run/:testId
 * Check if a test should run in CI (not quarantined)
 */
router.get('/should-run/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { testId: req.params.testId },
    });

    const shouldRun = !flakyTest || flakyTest.status !== 'QUARANTINED';

    res.json({
      success: true,
      data: {
        testId: req.params.testId,
        shouldRun,
        status: flakyTest?.status || 'UNKNOWN',
        flakinessScore: flakyTest?.flakinessScore || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
