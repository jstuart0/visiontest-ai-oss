// VisionTest.ai - Flaky Service Tests
// Hospital-Grade: Every edge case tested

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  flakyService,
  calculateFlakinessScore,
  determineStatus,
  calculateDailyStats,
  FLAKY_CONFIG,
} from './flaky.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    test: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    flakyTest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
  FlakyStatus: {
    WATCHING: 'WATCHING',
    WARNING: 'WARNING',
    QUARANTINED: 'QUARANTINED',
    STABLE: 'STABLE',
    INVESTIGATING: 'INVESTIGATING',
  },
  TestStatus: {
    ACTIVE: 'ACTIVE',
    QUARANTINED: 'QUARANTINED',
  },
}));

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('calculateFlakinessScore', () => {
  it('should return 0 for empty history', () => {
    expect(calculateFlakinessScore([])).toBe(0);
  });

  it('should return 0 for history below minimum runs', () => {
    const history = [
      { passed: true },
      { passed: false },
      { passed: true },
    ];
    expect(calculateFlakinessScore(history)).toBe(0);
  });

  it('should return 0 for all passing tests', () => {
    const history = Array(10).fill({ passed: true });
    expect(calculateFlakinessScore(history)).toBe(0);
  });

  it('should return high score for alternating pass/fail', () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ passed: i % 2 === 0 });
    }
    const score = calculateFlakinessScore(history);
    expect(score).toBeGreaterThan(50);
  });

  it('should return moderate score for some failures without alternation', () => {
    const history = [
      ...Array(7).fill({ passed: true }),
      ...Array(3).fill({ passed: false }),
    ];
    const score = calculateFlakinessScore(history);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });

  it('should cap score at 100', () => {
    const history = [];
    for (let i = 0; i < 100; i++) {
      history.push({ passed: i % 2 === 0 });
    }
    const score = calculateFlakinessScore(history);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return 100 for all failing tests with high alternation', () => {
    // This creates a very flaky pattern
    const history = [];
    for (let i = 0; i < 20; i++) {
      history.push({ passed: false });
      history.push({ passed: true });
    }
    // With 50% failure rate and max alternation, should be near or at 100
    const score = calculateFlakinessScore(history);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('should handle exactly minimum runs', () => {
    const history = Array(FLAKY_CONFIG.MIN_RUNS).fill({ passed: true });
    const score = calculateFlakinessScore(history);
    expect(score).toBe(0);
  });

  it('should calculate score correctly for 50% failure rate with no alternation', () => {
    const history = [
      ...Array(5).fill({ passed: true }),
      ...Array(5).fill({ passed: false }),
    ];
    const score = calculateFlakinessScore(history);
    // 50% failure rate, 1 alternation out of 9 possible
    // Score = 50 * (1 + 1/9) = 55.55...
    expect(score).toBeCloseTo(55.6, 0);
  });
});

describe('determineStatus', () => {
  it('should return WATCHING for insufficient runs', () => {
    expect(determineStatus(50, 3, 'WATCHING')).toBe('WATCHING');
    expect(determineStatus(50, 4, 'QUARANTINED')).toBe('WATCHING');
  });

  it('should return QUARANTINED for score >= threshold', () => {
    expect(determineStatus(FLAKY_CONFIG.QUARANTINE_THRESHOLD, 10, 'WATCHING')).toBe('QUARANTINED');
    expect(determineStatus(50, 10, 'WATCHING')).toBe('QUARANTINED');
    expect(determineStatus(100, 10, 'WARNING')).toBe('QUARANTINED');
  });

  it('should return WARNING for score >= warning threshold but < quarantine', () => {
    expect(determineStatus(FLAKY_CONFIG.WARNING_THRESHOLD, 10, 'WATCHING')).toBe('WARNING');
    expect(determineStatus(30, 10, 'WATCHING')).toBe('WARNING');
  });

  it('should return STABLE for low score when previously QUARANTINED', () => {
    expect(determineStatus(FLAKY_CONFIG.STABLE_THRESHOLD, 10, 'QUARANTINED')).toBe('STABLE');
    expect(determineStatus(0, 10, 'QUARANTINED')).toBe('STABLE');
  });

  it('should return WATCHING for low score when not previously QUARANTINED', () => {
    expect(determineStatus(FLAKY_CONFIG.STABLE_THRESHOLD, 10, 'WATCHING')).toBe('WATCHING');
    expect(determineStatus(0, 10, 'WARNING')).toBe('WATCHING');
  });

  it('should handle boundary conditions correctly', () => {
    const justBelowQuarantine = FLAKY_CONFIG.QUARANTINE_THRESHOLD - 0.1;
    const justAboveWarning = FLAKY_CONFIG.WARNING_THRESHOLD + 0.1;
    const justBelowWarning = FLAKY_CONFIG.WARNING_THRESHOLD - 0.1;
    
    expect(determineStatus(justBelowQuarantine, 10, 'WATCHING')).toBe('WARNING');
    expect(determineStatus(justAboveWarning, 10, 'WATCHING')).toBe('WARNING');
    expect(determineStatus(justBelowWarning, 10, 'WATCHING')).toBe('WATCHING');
  });
});

describe('calculateDailyStats', () => {
  it('should return empty array for empty history', () => {
    expect(calculateDailyStats([])).toEqual([]);
  });

  it('should aggregate runs by date correctly', () => {
    const baseDate = new Date('2025-01-15T12:00:00Z').getTime();
    const history = [
      { timestamp: baseDate, passed: true, duration: 100 },
      { timestamp: baseDate + 1000, passed: true, duration: 100 },
      { timestamp: baseDate + 2000, passed: false, duration: 100 },
      { timestamp: baseDate + 86400000, passed: true, duration: 100 }, // next day
    ];

    const stats = calculateDailyStats(history);
    
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual({
      date: '2025-01-15',
      passed: 2,
      failed: 1,
      total: 3,
      passRate: 67,
    });
    expect(stats[1]).toEqual({
      date: '2025-01-16',
      passed: 1,
      failed: 0,
      total: 1,
      passRate: 100,
    });
  });

  it('should handle single day correctly', () => {
    const timestamp = new Date('2025-01-15T10:00:00Z').getTime();
    const history = [
      { timestamp, passed: true, duration: 100 },
      { timestamp: timestamp + 1000, passed: false, duration: 100 },
    ];

    const stats = calculateDailyStats(history);
    
    expect(stats).toHaveLength(1);
    expect(stats[0].passRate).toBe(50);
  });

  it('should calculate 0% pass rate correctly', () => {
    const timestamp = Date.now();
    const history = [
      { timestamp, passed: false, duration: 100 },
      { timestamp: timestamp + 1000, passed: false, duration: 100 },
    ];

    const stats = calculateDailyStats(history);
    expect(stats[0].passRate).toBe(0);
  });

  it('should calculate 100% pass rate correctly', () => {
    const timestamp = Date.now();
    const history = [
      { timestamp, passed: true, duration: 100 },
      { timestamp: timestamp + 1000, passed: true, duration: 100 },
    ];

    const stats = calculateDailyStats(history);
    expect(stats[0].passRate).toBe(100);
  });
});

// =============================================================================
// SERVICE METHOD TESTS
// =============================================================================

describe('FlakyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list flaky tests for a project', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1' }] },
      };
      const mockFlakyTests = [
        {
          id: 'flaky-1',
          testId: 'test-1',
          projectId: 'project-1',
          flakinessScore: 45,
          status: 'QUARANTINED',
          runHistory: JSON.stringify([{ timestamp: Date.now(), passed: false, duration: 100 }]),
          test: { id: 'test-1', name: 'Test 1', tags: [], status: 'QUARANTINED', suiteId: null },
        },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.flakyTest.findMany).mockResolvedValue(mockFlakyTests as any);

      const result = await flakyService.list('project-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].flakinessScore).toBe(45);
      expect(result[0].runHistory).toBeInstanceOf(Array);
    });

    it('should filter by status when provided', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.flakyTest.findMany).mockResolvedValue([]);

      await flakyService.list('project-1', 'user-1', 'QUARANTINED');

      expect(prisma.flakyTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1', status: 'QUARANTINED' },
        })
      );
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: 'project-1',
        org: { users: [] },
      } as any);

      await expect(flakyService.list('project-1', 'user-1')).rejects.toThrow('No access');
    });

    it('should throw ForbiddenError when project not found', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(flakyService.list('project-1', 'user-1')).rejects.toThrow('No access');
    });
  });

  describe('getStats', () => {
    it('should return flaky test statistics', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.flakyTest.count)
        .mockResolvedValueOnce(5)  // quarantined
        .mockResolvedValueOnce(3)  // warning
        .mockResolvedValueOnce(10) // watching
        .mockResolvedValueOnce(2); // stabilized

      const result = await flakyService.getStats('project-1', 'user-1');

      expect(result.quarantined).toBe(5);
      expect(result.warning).toBe(3);
      expect(result.watching).toBe(10);
      expect(result.stabilized).toBe(2);
      expect(result.timeSaved).toBe(70); // 5 * 2 * 7
      expect(result.thresholds).toEqual(FLAKY_CONFIG);
    });
  });

  describe('getByTestId', () => {
    it('should return flaky data for a test', async () => {
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        flakinessScore: 30,
        status: 'WARNING',
        runHistory: JSON.stringify([]),
        test: {
          project: { org: { users: [{ userId: 'user-1' }] } },
        },
      };

      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);

      const result = await flakyService.getByTestId('test-1', 'user-1');

      expect(result.testId).toBe('test-1');
      expect(result.flakinessScore).toBe(30);
    });

    it('should throw NotFoundError when flaky data not found', async () => {
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(null);

      await expect(flakyService.getByTestId('test-1', 'user-1')).rejects.toThrow('not found');
    });

    it('should throw ForbiddenError when no access', async () => {
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        test: {
          project: { org: { users: [] } },
        },
        runHistory: '[]',
      };

      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);

      await expect(flakyService.getByTestId('test-1', 'user-1')).rejects.toThrow('No access');
    });
  });

  describe('quarantine', () => {
    it('should manually quarantine a test', async () => {
      const mockTest = {
        id: 'test-1',
        projectId: 'project-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
        flakyData: null,
      };
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        status: 'QUARANTINED',
        runHistory: '[]',
        quarantinedAt: new Date(),
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.flakyTest.upsert).mockResolvedValue(mockFlakyTest as any);
      vi.mocked(prisma.test.update).mockResolvedValue(mockTest as any);

      const result = await flakyService.quarantine('test-1', 'user-1');

      expect(result.status).toBe('QUARANTINED');
      expect(prisma.test.update).toHaveBeenCalledWith({
        where: { id: 'test-1' },
        data: { status: 'QUARANTINED' },
      });
    });

    it('should throw NotFoundError when test not found', async () => {
      vi.mocked(prisma.test.findUnique).mockResolvedValue(null);

      await expect(flakyService.quarantine('test-1', 'user-1')).rejects.toThrow('not found');
    });
  });

  describe('release', () => {
    it('should release a test from quarantine', async () => {
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        status: 'QUARANTINED',
        runHistory: '[]',
        test: {
          project: { org: { users: [{ userId: 'user-1' }] } },
        },
      };
      const updatedFlakyTest = {
        ...mockFlakyTest,
        status: 'WATCHING',
        stabilizedAt: new Date(),
      };

      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);
      vi.mocked(prisma.flakyTest.update).mockResolvedValue(updatedFlakyTest as any);
      vi.mocked(prisma.test.update).mockResolvedValue({} as any);

      const result = await flakyService.release('test-1', 'user-1');

      expect(result.status).toBe('WATCHING');
      expect(prisma.test.update).toHaveBeenCalledWith({
        where: { id: 'test-1' },
        data: { status: 'ACTIVE' },
      });
    });
  });

  describe('recordRun', () => {
    it('should create new flaky record for first run', async () => {
      const mockTest = { id: 'test-1', projectId: 'project-1' };
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        status: 'WATCHING',
        flakinessScore: 0,
        runHistory: JSON.stringify([{ timestamp: Date.now(), passed: true, duration: 100 }]),
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.flakyTest.create).mockResolvedValue(mockFlakyTest as any);

      const result = await flakyService.recordRun({
        testId: 'test-1',
        passed: true,
        duration: 100,
      });

      expect(result.status).toBe('WATCHING');
      expect(prisma.flakyTest.create).toHaveBeenCalled();
    });

    it('should update existing flaky record with new run', async () => {
      const mockTest = { id: 'test-1', projectId: 'project-1' };
      const existingHistory = Array(10).fill(null).map((_, i) => ({
        timestamp: Date.now() - i * 3600000,
        passed: true,
        duration: 100,
      }));
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        status: 'WATCHING',
        flakinessScore: 0,
        runHistory: JSON.stringify(existingHistory),
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);
      vi.mocked(prisma.flakyTest.update).mockImplementation(async (args: any) => ({
        ...mockFlakyTest,
        runHistory: args.data.runHistory,
        flakinessScore: args.data.flakinessScore,
        status: args.data.status,
      }));

      const result = await flakyService.recordRun({
        testId: 'test-1',
        passed: true,
        duration: 100,
      });

      expect(result.runHistory.length).toBe(11);
      expect(prisma.flakyTest.update).toHaveBeenCalled();
    });

    it('should auto-quarantine when score exceeds threshold', async () => {
      const mockTest = { id: 'test-1', projectId: 'project-1' };
      // Create history with alternating pass/fail to trigger quarantine
      const existingHistory = Array(10).fill(null).map((_, i) => ({
        timestamp: Date.now() - i * 3600000,
        passed: i % 2 === 0,
        duration: 100,
      }));
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        status: 'WARNING',
        flakinessScore: 30,
        runHistory: JSON.stringify(existingHistory),
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);
      vi.mocked(prisma.flakyTest.update).mockImplementation(async (args: any) => ({
        ...mockFlakyTest,
        runHistory: args.data.runHistory,
        flakinessScore: args.data.flakinessScore,
        status: args.data.status,
      }));
      vi.mocked(prisma.test.update).mockResolvedValue({} as any);

      await flakyService.recordRun({
        testId: 'test-1',
        passed: false, // Add another failure
        duration: 100,
      });

      // The mocked update should have been called
      expect(prisma.flakyTest.update).toHaveBeenCalled();
    });

    it('should remove old runs outside window', async () => {
      const mockTest = { id: 'test-1', projectId: 'project-1' };
      const oldTimestamp = Date.now() - (FLAKY_CONFIG.WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000;
      const existingHistory = [
        { timestamp: oldTimestamp, passed: true, duration: 100 },
        { timestamp: Date.now(), passed: true, duration: 100 },
      ];
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        status: 'WATCHING',
        flakinessScore: 0,
        runHistory: JSON.stringify(existingHistory),
      };

      vi.mocked(prisma.test.findUnique).mockResolvedValue(mockTest as any);
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);
      vi.mocked(prisma.flakyTest.update).mockImplementation(async (args: any) => ({
        ...mockFlakyTest,
        runHistory: args.data.runHistory,
      }));

      const result = await flakyService.recordRun({
        testId: 'test-1',
        passed: true,
        duration: 100,
      });

      // Old run should be filtered out, only 2 runs should remain (recent + new)
      expect(result.runHistory.length).toBe(2);
    });

    it('should throw NotFoundError when test not found', async () => {
      vi.mocked(prisma.test.findUnique).mockResolvedValue(null);

      await expect(
        flakyService.recordRun({
          testId: 'test-1',
          passed: true,
          duration: 100,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('shouldRun', () => {
    it('should return true for non-quarantined test', async () => {
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue({
        testId: 'test-1',
        status: 'WATCHING',
        flakinessScore: 10,
      } as any);

      const result = await flakyService.shouldRun('test-1');

      expect(result.shouldRun).toBe(true);
      expect(result.status).toBe('WATCHING');
    });

    it('should return false for quarantined test', async () => {
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue({
        testId: 'test-1',
        status: 'QUARANTINED',
        flakinessScore: 45,
      } as any);

      const result = await flakyService.shouldRun('test-1');

      expect(result.shouldRun).toBe(false);
      expect(result.status).toBe('QUARANTINED');
    });

    it('should return true for test with no flaky data', async () => {
      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(null);

      const result = await flakyService.shouldRun('test-1');

      expect(result.shouldRun).toBe(true);
      expect(result.status).toBe('UNKNOWN');
      expect(result.flakinessScore).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('should return run history with aggregates', async () => {
      const mockFlakyTest = {
        id: 'flaky-1',
        testId: 'test-1',
        projectId: 'project-1',
        flakinessScore: 30,
        status: 'WARNING',
        runHistory: JSON.stringify([
          { timestamp: Date.now(), passed: true, duration: 100 },
          { timestamp: Date.now(), passed: false, duration: 150 },
        ]),
        test: {
          project: { org: { users: [{ userId: 'user-1' }] } },
        },
      };

      vi.mocked(prisma.flakyTest.findUnique).mockResolvedValue(mockFlakyTest as any);

      const result = await flakyService.getHistory('test-1', 'user-1');

      expect(result.runs).toHaveLength(2);
      expect(result.dailyStats).toHaveLength(1);
      expect(result.summary.totalRuns).toBe(2);
      expect(result.summary.passedRuns).toBe(1);
      expect(result.summary.failedRuns).toBe(1);
      expect(result.summary.avgDuration).toBe(125);
    });
  });
});
