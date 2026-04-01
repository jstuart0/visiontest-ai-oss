// VisionTest AI - Schedules Service Tests
// Hospital-Grade: Schedule management testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schedulesService, validateCronExpression, getNextRun, getUpcomingRuns } from './schedules.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    schedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    testSuite: {
      findFirst: vi.fn(),
    },
    execution: {
      create: vi.fn(),
    },
  },
}));

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('validateCronExpression', () => {
  it('should validate correct cron expressions', () => {
    expect(validateCronExpression('0 0 * * *')).toBe(true); // Daily at midnight
    expect(validateCronExpression('*/5 * * * *')).toBe(true); // Every 5 minutes
    expect(validateCronExpression('0 9 * * 1-5')).toBe(true); // 9 AM weekdays
    expect(validateCronExpression('0 0 1 * *')).toBe(true); // First of month
  });

  it('should reject invalid cron expressions', () => {
    expect(validateCronExpression('invalid')).toBe(false);
    // Note: cron-parser is very lenient with formats
    // Test truly invalid expressions
    expect(validateCronExpression('not a cron at all')).toBe(false);
    expect(validateCronExpression('abc def ghi jkl mno')).toBe(false);
  });
});

describe('getNextRun', () => {
  it('should calculate next run time', () => {
    const nextRun = getNextRun('0 0 * * *', 'UTC');
    expect(nextRun).toBeInstanceOf(Date);
    expect(nextRun.getTime()).toBeGreaterThan(Date.now());
  });

  it('should respect timezone', () => {
    const utcRun = getNextRun('0 12 * * *', 'UTC');
    const laRun = getNextRun('0 12 * * *', 'America/Los_Angeles');
    
    // They should be different times
    expect(utcRun.getTime()).not.toBe(laRun.getTime());
  });
});

describe('getUpcomingRuns', () => {
  it('should return specified number of runs', () => {
    const runs = getUpcomingRuns('*/10 * * * *', 5);
    expect(runs).toHaveLength(5);
  });

  it('should return runs in chronological order', () => {
    const runs = getUpcomingRuns('*/10 * * * *', 3);
    expect(runs[0].getTime()).toBeLessThan(runs[1].getTime());
    expect(runs[1].getTime()).toBeLessThan(runs[2].getTime());
  });

  it('should default to 5 runs', () => {
    const runs = getUpcomingRuns('0 0 * * *');
    expect(runs).toHaveLength(5);
  });
});

// =============================================================================
// SERVICE METHOD TESTS
// =============================================================================

describe('SchedulesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list schedules for a project', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockSchedules = [
        {
          id: 'schedule-1',
          projectId: 'project-1',
          name: 'Daily Tests',
          cron: '0 0 * * *',
          timezone: 'UTC',
          config: {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          suite: null,
        },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue(mockSchedules as any);

      const result = await schedulesService.list('user-1', 'project-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Daily Tests');
    });

    it('should filter by active status', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([]);

      await schedulesService.list('user-1', 'project-1', true);

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1', isActive: true },
        })
      );
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(schedulesService.list('user-1', 'project-1')).rejects.toThrow('No access');
    });
  });

  describe('create', () => {
    it('should create a schedule with valid cron', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockSchedule = {
        id: 'schedule-1',
        projectId: 'project-1',
        name: 'Daily Tests',
        cron: '0 0 * * *',
        timezone: 'UTC',
        config: {},
        isActive: true,
        nextRunAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        suite: null,
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.schedule.create).mockResolvedValue(mockSchedule as any);

      const result = await schedulesService.create('user-1', {
        projectId: 'project-1',
        name: 'Daily Tests',
        cron: '0 0 * * *',
      });

      expect(result.name).toBe('Daily Tests');
      expect(result.isActive).toBe(true);
    });

    it('should reject invalid cron expression', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        schedulesService.create('user-1', {
          projectId: 'project-1',
          name: 'Invalid',
          cron: 'not-valid',
        })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should validate suite exists when provided', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.testSuite.findFirst).mockResolvedValue(null);

      await expect(
        schedulesService.create('user-1', {
          projectId: 'project-1',
          name: 'Test',
          cron: '0 0 * * *',
          suiteId: 'invalid-suite',
        })
      ).rejects.toThrow('Suite not found');
    });

    it('should use UTC as default timezone', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.schedule.create).mockResolvedValue({
        id: 'schedule-1',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
        suite: null,
      } as any);

      await schedulesService.create('user-1', {
        projectId: 'project-1',
        name: 'Test',
        cron: '0 0 * * *',
      });

      expect(prisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timezone: 'UTC' }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update a schedule', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        projectId: 'project-1',
        name: 'Old Name',
        cron: '0 0 * * *',
        timezone: 'UTC',
        nextRunAt: new Date(),
        project: { org: { users: [{ userId: 'user-1' }] } },
        suite: null,
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.schedule.update).mockResolvedValue({
        ...mockSchedule,
        name: 'New Name',
        config: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await schedulesService.update('user-1', 'schedule-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should validate new cron expression', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        cron: '0 0 * * *',
        timezone: 'UTC',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);

      await expect(
        schedulesService.update('user-1', 'schedule-1', { cron: 'invalid' })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should recalculate nextRunAt when cron changes', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        cron: '0 0 * * *',
        timezone: 'UTC',
        nextRunAt: new Date(),
        project: { org: { users: [{ userId: 'user-1' }] } },
        suite: null,
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.schedule.update).mockResolvedValue({
        ...mockSchedule,
        cron: '0 12 * * *',
        config: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await schedulesService.update('user-1', 'schedule-1', { cron: '0 12 * * *' });

      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a schedule', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.schedule.delete).mockResolvedValue(mockSchedule as any);

      await schedulesService.delete('user-1', 'schedule-1');

      expect(prisma.schedule.delete).toHaveBeenCalledWith({ where: { id: 'schedule-1' } });
    });
  });

  describe('run', () => {
    it('should trigger a schedule run', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        projectId: 'project-1',
        suiteId: 'suite-1',
        name: 'Daily Tests',
        cron: '0 0 * * *',
        timezone: 'UTC',
        config: { platforms: ['chromium'] },
        project: { org: { users: [{ userId: 'user-1' }] } },
      };
      const mockExecution = { id: 'exec-1' };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.execution.create).mockResolvedValue(mockExecution as any);
      vi.mocked(prisma.schedule.update).mockResolvedValue({} as any);

      const result = await schedulesService.run('user-1', 'schedule-1');

      expect(result.executionId).toBe('exec-1');
      expect(prisma.execution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggeredBy: 'SCHEDULE',
            metadata: expect.objectContaining({ manualTrigger: true }),
          }),
        })
      );
    });

    it('should update lastRunAt and nextRunAt', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        projectId: 'project-1',
        cron: '0 0 * * *',
        timezone: 'UTC',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.execution.create).mockResolvedValue({ id: 'exec-1' } as any);
      vi.mocked(prisma.schedule.update).mockResolvedValue({} as any);

      await schedulesService.run('user-1', 'schedule-1');

      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastRunAt: expect.any(Date),
            nextRunAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('toggle', () => {
    it('should toggle schedule from active to inactive', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        projectId: 'project-1',
        cron: '0 0 * * *',
        timezone: 'UTC',
        isActive: true,
        project: { org: { users: [{ userId: 'user-1' }] } },
        suite: null,
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.schedule.update).mockResolvedValue({
        ...mockSchedule,
        isActive: false,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await schedulesService.toggle('user-1', 'schedule-1');

      expect(result.isActive).toBe(false);
    });

    it('should recalculate nextRunAt when activating', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        cron: '0 0 * * *',
        timezone: 'UTC',
        isActive: false,
        project: { org: { users: [{ userId: 'user-1' }] } },
        suite: null,
      };

      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(mockSchedule as any);
      vi.mocked(prisma.schedule.update).mockResolvedValue({
        ...mockSchedule,
        isActive: true,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await schedulesService.toggle('user-1', 'schedule-1');

      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
            nextRunAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
