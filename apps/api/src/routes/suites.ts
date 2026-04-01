// VisionTest.ai - Test Suite Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { queueExecution } from '../lib/queue';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createSuiteSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  order: z.number().optional(),
});

const updateSuiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  order: z.number().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /suites
 * List suites for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    // Check access
    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: {
        org: {
          include: { users: { where: { userId: req.user!.id } } },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const suites = await prisma.testSuite.findMany({
      where: { projectId: projectId as string },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { tests: true, executions: true },
        },
      },
    });

    res.json({
      success: true,
      data: suites.map((s) => ({
        ...s,
        testCount: s._count.tests,
        executionCount: s._count.executions,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /suites
 * Create a new suite
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSuiteSchema.parse(req.body);

    // Check access
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: {
          include: { users: { where: { userId: req.user!.id } } },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Get next order if not provided
    let order = input.order;
    if (order === undefined) {
      const maxOrder = await prisma.testSuite.aggregate({
        where: { projectId: input.projectId },
        _max: { order: true },
      });
      order = (maxOrder._max.order || 0) + 1;
    }

    const suite = await prisma.testSuite.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        tags: input.tags || [],
        config: (input.config || {}) as Prisma.InputJsonValue,
        order,
      },
    });

    logger.info(`Suite created: ${suite.id}`);

    res.status(201).json({
      success: true,
      data: suite,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /suites/reorder
 * Reorder suites
 */
router.patch('/reorder', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, suiteIds } = z.object({
      projectId: z.string().cuid(),
      suiteIds: z.array(z.string().cuid()),
    }).parse(req.body);

    // Check access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: {
          include: { users: { where: { userId: req.user!.id } } },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Update orders
    await Promise.all(
      suiteIds.map((id, index) =>
        prisma.testSuite.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    res.json({
      success: true,
      data: { message: 'Suites reordered' },
    });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /suites/:suiteId
 * Get suite details
 */
router.get('/:suiteId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.testSuite.findUnique({
      where: { id: req.params.suiteId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        tests: {
          select: {
            id: true,
            name: true,
            status: true,
            tags: true,
          },
        },
        _count: {
          select: { tests: true, executions: true },
        },
      },
    });

    if (!suite) {
      throw NotFoundError('Suite');
    }

    if (suite.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: {
        ...suite,
        testCount: suite._count.tests,
        executionCount: suite._count.executions,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /suites/:suiteId
 * Update a suite
 */
router.patch('/:suiteId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.testSuite.findUnique({
      where: { id: req.params.suiteId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
      },
    });

    if (!suite) {
      throw NotFoundError('Suite');
    }

    if (suite.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const updates = updateSuiteSchema.parse(req.body);

    const updated = await prisma.testSuite.update({
      where: { id: suite.id },
      data: {
        name: updates.name,
        description: updates.description,
        tags: updates.tags,
        config: updates.config as Prisma.InputJsonValue | undefined,
        order: updates.order,
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
 * DELETE /suites/:suiteId
 * Delete a suite
 */
router.delete('/:suiteId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.testSuite.findUnique({
      where: { id: req.params.suiteId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
      },
    });

    if (!suite) {
      throw NotFoundError('Suite');
    }

    if (suite.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Remove tests from suite (don't delete them)
    await prisma.test.updateMany({
      where: { suiteId: suite.id },
      data: { suiteId: null },
    });

    await prisma.testSuite.delete({
      where: { id: suite.id },
    });

    logger.info(`Suite deleted: ${suite.id}`);

    res.json({
      success: true,
      data: { message: 'Suite deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /suites/:suiteId/run
 * Execute all tests in a suite
 */
router.post('/:suiteId/run', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.testSuite.findUnique({
      where: { id: req.params.suiteId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        tests: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    });

    if (!suite) {
      throw NotFoundError('Suite');
    }

    if (suite.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    if (suite.tests.length === 0) {
      throw BadRequestError('Suite has no active tests');
    }

    // Create execution
    const execution = await prisma.execution.create({
      data: {
        projectId: suite.projectId,
        suiteId: suite.id,
        status: 'PENDING',
        triggeredBy: 'MANUAL',
        metadata: {
          browser: req.body.browser || 'chromium',
          testCount: suite.tests.length,
        },
      },
    });

    // Queue job for worker
    await queueExecution({
      executionId: execution.id,
      projectId: suite.projectId,
      suiteId: suite.id,
      config: {
        browser: req.body.browser || 'chromium',
        viewport: req.body.viewport,
      },
    });
    logger.info(`Suite execution created and queued: ${execution.id} for suite ${suite.id}`);

    res.status(201).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /suites/:suiteId/tests
 * Add tests to a suite
 */
router.post('/:suiteId/tests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testIds } = z.object({
      testIds: z.array(z.string().cuid()),
    }).parse(req.body);

    const suite = await prisma.testSuite.findUnique({
      where: { id: req.params.suiteId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
      },
    });

    if (!suite) {
      throw NotFoundError('Suite');
    }

    if (suite.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Update tests
    const result = await prisma.test.updateMany({
      where: {
        id: { in: testIds },
        projectId: suite.projectId,
      },
      data: { suiteId: suite.id },
    });

    res.json({
      success: true,
      data: { updated: result.count },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /suites/:suiteId/tests/:testId
 * Remove a test from a suite
 */
router.delete('/:suiteId/tests/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.testSuite.findUnique({
      where: { id: req.params.suiteId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
      },
    });

    if (!suite) {
      throw NotFoundError('Suite');
    }

    if (suite.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    await prisma.test.update({
      where: { id: req.params.testId },
      data: { suiteId: null },
    });

    res.json({
      success: true,
      data: { message: 'Test removed from suite' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
