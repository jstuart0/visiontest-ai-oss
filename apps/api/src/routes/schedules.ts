// VisionTest.ai - Schedule Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { queueExecution } from '../lib/queue';
import * as cronParser from 'cron-parser';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createScheduleSchema = z.object({
  projectId: z.string().cuid(),
  suiteId: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  cron: z.string().refine((val) => {
    try {
      cronParser.parseExpression(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid cron expression'),
  timezone: z.string().optional(),
  config: z.object({
    platforms: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional(),
    environments: z.array(z.string()).optional(),
    notifications: z.object({
      slack: z.string().optional(),
      email: z.array(z.string().email()).optional(),
    }).optional(),
    failureThreshold: z.number().optional(),
  }).optional(),
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getNextRun(cron: string, timezone: string = 'UTC'): Date {
  const interval = cronParser.parseExpression(cron, {
    currentDate: new Date(),
    tz: timezone,
  });
  return interval.next().toDate();
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /schedules
 * List schedules for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, isActive } = req.query;

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

    const where: any = { projectId: projectId as string };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /schedules
 * Create a new schedule
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createScheduleSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Validate suite if provided
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
        config: input.config || {},
        isActive: true,
        nextRunAt,
      },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    logger.info(`Schedule created: ${schedule.id}`);

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /schedules/:scheduleId
 * Get schedule details
 */
router.get('/:scheduleId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
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

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /schedules/:scheduleId
 * Update a schedule
 */
router.patch('/:scheduleId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
      },
    });

    if (!schedule) {
      throw NotFoundError('Schedule');
    }

    if (schedule.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const updates = updateScheduleSchema.parse(req.body);

    // Validate cron if updating
    if (updates.cron) {
      try {
        cronParser.parseExpression(updates.cron);
      } catch {
        throw BadRequestError('Invalid cron expression');
      }
    }

    // Calculate next run if cron or timezone changed
    let nextRunAt = schedule.nextRunAt;
    if (updates.cron || updates.timezone) {
      const cron = updates.cron || schedule.cron;
      const timezone = updates.timezone || schedule.timezone;
      nextRunAt = getNextRun(cron, timezone);
    }

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        name: updates.name,
        cron: updates.cron,
        timezone: updates.timezone,
        config: updates.config as Prisma.InputJsonValue | undefined,
        isActive: updates.isActive,
        nextRunAt,
      },
      include: {
        suite: { select: { id: true, name: true } },
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
 * DELETE /schedules/:scheduleId
 * Delete a schedule
 */
router.delete('/:scheduleId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
      },
    });

    if (!schedule) {
      throw NotFoundError('Schedule');
    }

    if (schedule.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    await prisma.schedule.delete({
      where: { id: schedule.id },
    });

    logger.info(`Schedule deleted: ${schedule.id}`);

    res.json({
      success: true,
      data: { message: 'Schedule deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /schedules/:scheduleId/run
 * Trigger a schedule run immediately
 */
router.post('/:scheduleId/run', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
      },
    });

    if (!schedule) {
      throw NotFoundError('Schedule');
    }

    if (schedule.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

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

    // Queue job for worker
    await queueExecution({
      executionId: execution.id,
      projectId: schedule.projectId,
      suiteId: schedule.suiteId || undefined,
      config: (schedule.config as any)?.platforms?.[0] 
        ? { browser: (schedule.config as any).platforms[0] }
        : undefined,
    });
    logger.info(`Schedule triggered manually and queued: ${schedule.id}`);

    res.status(201).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /schedules/:scheduleId/toggle
 * Toggle schedule active state
 */
router.post('/:scheduleId/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
      },
    });

    if (!schedule) {
      throw NotFoundError('Schedule');
    }

    if (schedule.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        isActive: !schedule.isActive,
        ...(schedule.isActive === false && {
          nextRunAt: getNextRun(schedule.cron, schedule.timezone),
        }),
      },
    });

    logger.info(`Schedule ${updated.isActive ? 'activated' : 'deactivated'}: ${schedule.id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
