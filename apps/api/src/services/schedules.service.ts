// VisionTest.ai - Schedules Service
// Hospital-Grade: Reliable test scheduling

import { prisma, Prisma } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import * as cronParser from 'cron-parser';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateScheduleInput {
  projectId: string;
  suiteId?: string;
  name: string;
  cron: string;
  timezone?: string;
  config?: ScheduleConfig;
}

export interface UpdateScheduleInput {
  name?: string;
  cron?: string;
  timezone?: string;
  config?: ScheduleConfig;
  isActive?: boolean;
}

export interface ScheduleConfig {
  platforms?: ('chromium' | 'firefox' | 'webkit')[];
  environments?: string[];
  notifications?: {
    slack?: string;
    email?: string[];
  };
  failureThreshold?: number;
}

export interface ScheduleResult {
  id: string;
  projectId: string;
  suiteId: string | null;
  name: string;
  cron: string;
  timezone: string;
  config: ScheduleConfig;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  suite?: { id: string; name: string } | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate a cron expression.
 */
export function validateCronExpression(cron: string): boolean {
  try {
    cronParser.parseExpression(cron);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate the next run time for a cron expression.
 */
export function getNextRun(cron: string, timezone: string = 'UTC'): Date {
  const interval = cronParser.parseExpression(cron, {
    currentDate: new Date(),
    tz: timezone,
  });
  return interval.next().toDate();
}

/**
 * Get multiple upcoming run times.
 */
export function getUpcomingRuns(cron: string, count: number = 5, timezone: string = 'UTC'): Date[] {
  const interval = cronParser.parseExpression(cron, {
    currentDate: new Date(),
    tz: timezone,
  });
  
  const runs: Date[] = [];
  for (let i = 0; i < count; i++) {
    runs.push(interval.next().toDate());
  }
  return runs;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class SchedulesService {
  /**
   * List schedules for a project.
   */
  async list(userId: string, projectId: string, isActive?: boolean): Promise<ScheduleResult[]> {
    await this.checkProjectAccess(userId, projectId);

    const where: any = { projectId };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    return schedules.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      suiteId: s.suiteId,
      name: s.name,
      cron: s.cron,
      timezone: s.timezone,
      config: s.config as ScheduleConfig,
      isActive: s.isActive,
      lastRunAt: s.lastRunAt,
      nextRunAt: s.nextRunAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      suite: s.suite,
    }));
  }

  /**
   * Create a new schedule.
   */
  async create(userId: string, input: CreateScheduleInput): Promise<ScheduleResult> {
    await this.checkProjectAccess(userId, input.projectId);

    // Validate cron expression
    if (!validateCronExpression(input.cron)) {
      throw BadRequestError('Invalid cron expression');
    }

    // Validate suite exists if provided
    if (input.suiteId) {
      const suite = await prisma.testSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
      });
      if (!suite) {
        throw BadRequestError('Suite not found');
      }
    }

    const timezone = input.timezone || 'UTC';
    const nextRunAt = getNextRun(input.cron, timezone);

    const schedule = await prisma.schedule.create({
      data: {
        projectId: input.projectId,
        suiteId: input.suiteId,
        name: input.name,
        cron: input.cron,
        timezone,
        config: (input.config || {}) as Prisma.InputJsonValue,
        isActive: true,
        nextRunAt,
      },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    logger.info(`Schedule created: ${schedule.id}`);

    return {
      id: schedule.id,
      projectId: schedule.projectId,
      suiteId: schedule.suiteId,
      name: schedule.name,
      cron: schedule.cron,
      timezone: schedule.timezone,
      config: schedule.config as ScheduleConfig,
      isActive: schedule.isActive,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: schedule.nextRunAt,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      suite: schedule.suite,
    };
  }

  /**
   * Get schedule by ID.
   */
  async getById(userId: string, scheduleId: string): Promise<ScheduleResult> {
    const schedule = await this.getScheduleWithAccess(userId, scheduleId);

    return {
      id: schedule.id,
      projectId: schedule.projectId,
      suiteId: schedule.suiteId,
      name: schedule.name,
      cron: schedule.cron,
      timezone: schedule.timezone,
      config: schedule.config as ScheduleConfig,
      isActive: schedule.isActive,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: schedule.nextRunAt,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      suite: (schedule as any).suite,
    };
  }

  /**
   * Update a schedule.
   */
  async update(userId: string, scheduleId: string, input: UpdateScheduleInput): Promise<ScheduleResult> {
    const schedule = await this.getScheduleWithAccess(userId, scheduleId);

    // Validate cron if updating
    if (input.cron && !validateCronExpression(input.cron)) {
      throw BadRequestError('Invalid cron expression');
    }

    // Calculate next run if cron or timezone changed
    let nextRunAt = schedule.nextRunAt;
    if (input.cron || input.timezone) {
      const cron = input.cron || schedule.cron;
      const timezone = input.timezone || schedule.timezone;
      nextRunAt = getNextRun(cron, timezone);
    }

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        name: input.name,
        cron: input.cron,
        timezone: input.timezone,
        config: input.config as Prisma.InputJsonValue | undefined,
        isActive: input.isActive,
        nextRunAt,
      },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    logger.info(`Schedule updated: ${schedule.id}`);

    return {
      id: updated.id,
      projectId: updated.projectId,
      suiteId: updated.suiteId,
      name: updated.name,
      cron: updated.cron,
      timezone: updated.timezone,
      config: updated.config as ScheduleConfig,
      isActive: updated.isActive,
      lastRunAt: updated.lastRunAt,
      nextRunAt: updated.nextRunAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      suite: updated.suite,
    };
  }

  /**
   * Delete a schedule.
   */
  async delete(userId: string, scheduleId: string): Promise<void> {
    const schedule = await this.getScheduleWithAccess(userId, scheduleId);

    await prisma.schedule.delete({
      where: { id: schedule.id },
    });

    logger.info(`Schedule deleted: ${schedule.id}`);
  }

  /**
   * Trigger a schedule run immediately.
   */
  async run(userId: string, scheduleId: string): Promise<{ executionId: string }> {
    const schedule = await this.getScheduleWithAccess(userId, scheduleId);

    // Create execution
    const execution = await prisma.execution.create({
      data: {
        projectId: schedule.projectId,
        suiteId: schedule.suiteId,
        status: 'PENDING',
        triggeredBy: 'SCHEDULE',
        triggerRef: schedule.id,
        metadata: {
          scheduleName: schedule.name,
          config: schedule.config,
          manualTrigger: true,
        },
      },
    });

    // Update last run
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: getNextRun(schedule.cron, schedule.timezone),
      },
    });

    logger.info(`Schedule triggered manually: ${schedule.id}`);

    return { executionId: execution.id };
  }

  /**
   * Toggle schedule active state.
   */
  async toggle(userId: string, scheduleId: string): Promise<ScheduleResult> {
    const schedule = await this.getScheduleWithAccess(userId, scheduleId);

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        isActive: !schedule.isActive,
        ...(schedule.isActive === false && {
          nextRunAt: getNextRun(schedule.cron, schedule.timezone),
        }),
      },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    logger.info(`Schedule ${updated.isActive ? 'activated' : 'deactivated'}: ${schedule.id}`);

    return {
      id: updated.id,
      projectId: updated.projectId,
      suiteId: updated.suiteId,
      name: updated.name,
      cron: updated.cron,
      timezone: updated.timezone,
      config: updated.config as ScheduleConfig,
      isActive: updated.isActive,
      lastRunAt: updated.lastRunAt,
      nextRunAt: updated.nextRunAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      suite: updated.suite,
    };
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

  private async getScheduleWithAccess(userId: string, scheduleId: string) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId } } } },
          },
        },
        suite: { select: { id: true, name: true } },
      },
    });

    if (!schedule) {
      throw NotFoundError('Schedule');
    }

    if (schedule.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    return schedule;
  }
}

export const schedulesService = new SchedulesService();
export default schedulesService;
