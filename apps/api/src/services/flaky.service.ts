// VisionTest.ai - Flaky Test Quarantine Service
// Hospital-Grade: Zero tolerance for unreliable test detection

import { prisma, FlakyStatus, TestStatus } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

export const FLAKY_CONFIG = {
  WINDOW_DAYS: 30,
  MIN_RUNS: 5,
  WARNING_THRESHOLD: 20,
  QUARANTINE_THRESHOLD: 35,
  STABLE_THRESHOLD: 5,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface FlakyRunRecord {
  timestamp: number;
  passed: boolean;
  duration: number;
  executionId?: string;
}

export interface FlakyTestResult {
  id: string;
  testId: string;
  projectId: string;
  flakinessScore: number;
  status: FlakyStatus;
  runHistory: FlakyRunRecord[];
  quarantinedAt: Date | null;
  stabilizedAt: Date | null;
  autoFixAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlakyStats {
  quarantined: number;
  warning: number;
  watching: number;
  stabilized: number;
  timeSaved: number; // minutes
  thresholds: typeof FLAKY_CONFIG;
}

export interface RecordRunInput {
  testId: string;
  passed: boolean;
  duration: number;
  executionId?: string;
}

// =============================================================================
// CORE ALGORITHMS
// =============================================================================

/**
 * Calculate flakiness score based on run history.
 * Score = failure_rate * 100 * (1 + alternation_rate)
 * 
 * Hospital-grade: This algorithm is deterministic and thoroughly tested.
 */
export function calculateFlakinessScore(history: { passed: boolean }[]): number {
  if (history.length < FLAKY_CONFIG.MIN_RUNS) {
    return 0;
  }

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

/**
 * Determine flaky status based on score, run count, and current status.
 * 
 * Hospital-grade: Status transitions are deterministic and auditable.
 */
export function determineStatus(
  score: number,
  runs: number,
  currentStatus: FlakyStatus
): FlakyStatus {
  if (runs < FLAKY_CONFIG.MIN_RUNS) {
    return 'WATCHING';
  }

  if (score >= FLAKY_CONFIG.QUARANTINE_THRESHOLD) {
    return 'QUARANTINED';
  }

  if (score >= FLAKY_CONFIG.WARNING_THRESHOLD) {
    return 'WARNING';
  }

  if (score <= FLAKY_CONFIG.STABLE_THRESHOLD && currentStatus === 'QUARANTINED') {
    return 'STABLE';
  }

  return 'WATCHING';
}

/**
 * Calculate daily aggregates from run history.
 */
export function calculateDailyStats(history: FlakyRunRecord[]): Array<{
  date: string;
  passed: number;
  failed: number;
  total: number;
  passRate: number;
}> {
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

  return Object.entries(dailyStats).map(([date, stats]) => ({
    date,
    ...stats,
    passRate: Math.round((stats.passed / stats.total) * 100),
  }));
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class FlakyService {
  /**
   * List flaky tests for a project.
   */
  async list(projectId: string, userId: string, status?: FlakyStatus): Promise<FlakyTestResult[]> {
    await this.checkProjectAccess(userId, projectId);

    const where: any = { projectId };
    if (status) {
      where.status = status;
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

    return flakyTests.map((ft) => ({
      ...ft,
      runHistory: this.parseRunHistory(ft.runHistory),
    })) as FlakyTestResult[];
  }

  /**
   * Get flaky test statistics for a project.
   */
  async getStats(projectId: string, userId: string): Promise<FlakyStats> {
    await this.checkProjectAccess(userId, projectId);

    const [quarantined, warning, watching, recentlyStabilized] = await Promise.all([
      prisma.flakyTest.count({
        where: { projectId, status: 'QUARANTINED' },
      }),
      prisma.flakyTest.count({
        where: { projectId, status: 'WARNING' },
      }),
      prisma.flakyTest.count({
        where: { projectId, status: 'WATCHING' },
      }),
      prisma.flakyTest.count({
        where: {
          projectId,
          status: 'STABLE',
          stabilizedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Calculate estimated time saved (assume 2 min per quarantined test per day)
    const timeSaved = quarantined * 2 * 7; // minutes per week

    return {
      quarantined,
      warning,
      watching,
      stabilized: recentlyStabilized,
      timeSaved,
      thresholds: FLAKY_CONFIG,
    };
  }

  /**
   * Get flaky data for a specific test.
   */
  async getByTestId(testId: string, userId: string): Promise<FlakyTestResult> {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { testId },
      include: {
        test: {
          include: {
            project: {
              include: {
                org: {
                  include: {
                    users: { where: { userId } },
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

    return {
      ...flakyTest,
      runHistory: this.parseRunHistory(flakyTest.runHistory),
    } as FlakyTestResult;
  }

  /**
   * Get detailed run history with daily aggregates.
   */
  async getHistory(testId: string, userId: string): Promise<{
    runs: FlakyRunRecord[];
    dailyStats: Array<{ date: string; passed: number; failed: number; total: number; passRate: number }>;
    summary: { totalRuns: number; passedRuns: number; failedRuns: number; avgDuration: number };
  }> {
    const flakyTest = await this.getByTestId(testId, userId);
    const history = flakyTest.runHistory;

    const dailyStats = calculateDailyStats(history);
    
    const summary = {
      totalRuns: history.length,
      passedRuns: history.filter((r) => r.passed).length,
      failedRuns: history.filter((r) => !r.passed).length,
      avgDuration: history.length > 0
        ? history.reduce((acc, r) => acc + (r.duration || 0), 0) / history.length
        : 0,
    };

    return { runs: history, dailyStats, summary };
  }

  /**
   * Manually quarantine a test.
   */
  async quarantine(testId: string, userId: string): Promise<FlakyTestResult> {
    const test = await this.getTestWithAccess(testId, userId);

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

    return {
      ...flakyTest,
      runHistory: this.parseRunHistory(flakyTest.runHistory),
    } as FlakyTestResult;
  }

  /**
   * Release a test from quarantine.
   */
  async release(testId: string, userId: string): Promise<FlakyTestResult> {
    const flakyTest = await this.getByTestId(testId, userId);

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

    return {
      ...updated,
      runHistory: this.parseRunHistory(updated.runHistory),
    } as FlakyTestResult;
  }

  /**
   * Record a test execution result. This is the core method called by the worker.
   * 
   * Hospital-grade: This method handles all edge cases for flakiness detection.
   */
  async recordRun(input: RecordRunInput): Promise<FlakyTestResult> {
    const { testId, passed, duration, executionId } = input;

    const test = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    const newRun: FlakyRunRecord = {
      timestamp: Date.now(),
      passed,
      duration,
      executionId,
    };

    // Get or create flaky record
    let flakyTest = await prisma.flakyTest.findUnique({
      where: { testId },
    });

    if (!flakyTest) {
      flakyTest = await prisma.flakyTest.create({
        data: {
          testId,
          projectId: test.projectId,
          runHistory: JSON.stringify([newRun]),
          status: 'WATCHING',
        },
      });

      return {
        ...flakyTest,
        runHistory: [newRun],
      } as FlakyTestResult;
    }

    // Add to history
    const history = this.parseRunHistory(flakyTest.runHistory);
    history.push(newRun);

    // Keep only last 30 days
    const cutoff = Date.now() - FLAKY_CONFIG.WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentHistory = history.filter((h) => h.timestamp > cutoff);

    // Calculate new score and status
    const score = calculateFlakinessScore(recentHistory);
    const newStatus = determineStatus(score, recentHistory.length, flakyTest.status as FlakyStatus);

    // Determine if status changed
    const statusChanged = newStatus !== flakyTest.status;
    const wasQuarantined = flakyTest.status === 'QUARANTINED';
    const nowQuarantined = newStatus === 'QUARANTINED';

    const updated = await prisma.flakyTest.update({
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

    return {
      ...updated,
      runHistory: recentHistory,
    } as FlakyTestResult;
  }

  /**
   * Check if a test should run in CI (not quarantined).
   */
  async shouldRun(testId: string): Promise<{
    testId: string;
    shouldRun: boolean;
    status: FlakyStatus | 'UNKNOWN';
    flakinessScore: number;
  }> {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { testId },
    });

    const shouldRun = !flakyTest || flakyTest.status !== 'QUARANTINED';

    return {
      testId,
      shouldRun,
      status: (flakyTest?.status as FlakyStatus) || 'UNKNOWN',
      flakinessScore: flakyTest?.flakinessScore || 0,
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async checkProjectAccess(userId: string, projectId: string): Promise<void> {
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
  }

  private async getTestWithAccess(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: { where: { userId } },
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

    return test;
  }

  private parseRunHistory(runHistory: any): FlakyRunRecord[] {
    if (typeof runHistory === 'string') {
      return JSON.parse(runHistory);
    }
    return runHistory || [];
  }
}

export const flakyService = new FlakyService();
export default flakyService;
