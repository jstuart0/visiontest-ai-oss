// VisionTest AI - Test Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, TestStatus, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { queueExecution } from '../lib/queue';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const testStepSchema = z.object({
  type: z.enum([
    // Web steps
    'navigate', 'click', 'type', 'clear', 'select', 'hover', 'scroll', 'waitFor', 'assert', 'screenshot', 'ai', 'loop', 'condition',
    // Mobile-specific steps
    'tap', 'swipe', 'pinch', 'longPress', 'doubleTap', 'shake', 'rotate',
    'launchApp', 'deepLink', 'notification', 'backButton', 'homeButton',
    'typeText', 'hideKeyboard',
  ]),
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  assertion: z.string().optional(),
  timeout: z.number().optional(),
  options: z.record(z.unknown()).optional(),
  // Mobile-specific fields
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  endCoordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  duration: z.number().optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  bundleId: z.string().optional(),
  deepLink: z.string().optional(),
});

const createTestSchema = z.object({
  projectId: z.string().cuid(),
  suiteId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  steps: z.array(testStepSchema),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  coveredFiles: z.array(z.string()).optional(),
  platform: z.enum(['WEB', 'IOS', 'ANDROID', 'MOBILE_WEB']).optional(),
  deviceProfileId: z.string().cuid().optional(),
});

const updateTestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  suiteId: z.string().cuid().optional().nullable(),
  steps: z.array(testStepSchema).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'ARCHIVED']).optional(),
  coveredFiles: z.array(z.string()).optional(),
  platform: z.enum(['WEB', 'IOS', 'ANDROID', 'MOBILE_WEB']).optional(),
  deviceProfileId: z.string().cuid().optional().nullable(),
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
 * GET /tests
 * List tests for a project
 */
const listQuerySchema = z.object({
  projectId: z.string(),
  status: z.enum(['ACTIVE', 'DISABLED', 'ARCHIVED']).optional(),
  platform: z.enum(['WEB', 'MOBILE_WEB', 'IOS', 'ANDROID']).optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
}).passthrough(); // Allow additional query params we don't validate

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const { projectId, status, platform, page: qPage, limit: qLimit } = query;
    const { suiteId, tags, search } = req.query;
    const page = qPage ? String(qPage) : '1';
    const limit = qLimit ? String(qLimit) : '50';

    await checkProjectAccess(req.user!.id, projectId);

    // Build query
    const where: any = {
      projectId,
    };

    if (suiteId) {
      where.suiteId = suiteId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (platform) {
      where.platform = platform as string;
    }

    if (tags) {
      const tagList = (tags as string).split(',');
      where.tags = { hasSome: tagList };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [tests, total] = await Promise.all([
      prisma.test.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { updatedAt: 'desc' },
        include: {
          suite: {
            select: { id: true, name: true },
          },
          deviceProfile: {
            select: { id: true, name: true, platform: true, width: true, height: true },
          },
          flakyData: {
            select: { flakinessScore: true, status: true },
          },
          executions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, createdAt: true, duration: true },
          },
          _count: {
            select: { executions: true },
          },
        },
      }),
      prisma.test.count({ where }),
    ]);

    res.json({
      success: true,
      data: tests.map((t) => {
        const lastExecution = t.executions[0];
        return {
          ...t,
          executions: undefined, // Don't expose full array
          executionCount: t._count.executions,
          lastRun: lastExecution?.createdAt || null,
          lastStatus: lastExecution?.status || null,
          lastDuration: lastExecution?.duration || null,
          platform: t.platform,
          deviceProfile: t.deviceProfile,
        };
      }),
      meta: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        hasMore: skip + tests.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /tests
 * Create a new test
 */
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTestSchema.parse(req.body);

    await checkProjectAccess(req.user!.id, input.projectId);

    // Verify suite exists if provided
    if (input.suiteId) {
      const suite = await prisma.testSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
      });
      if (!suite) {
        throw BadRequestError('Suite not found in this project');
      }
    }

    const test = await prisma.test.create({
      data: {
        projectId: input.projectId,
        suiteId: input.suiteId,
        name: input.name,
        description: input.description,
        steps: JSON.stringify(input.steps),
        tags: input.tags || [],
        config: (input.config || {}) as Prisma.InputJsonValue,
        coveredFiles: input.coveredFiles || [],
        status: TestStatus.ACTIVE,
        platform: (input.platform || 'WEB') as any,
        deviceProfileId: input.deviceProfileId,
      },
      include: {
        suite: {
          select: { id: true, name: true },
        },
        deviceProfile: {
          select: { id: true, name: true, platform: true },
        },
      },
    });

    logger.info(`Test created: ${test.id} in project ${input.projectId}`);

    res.status(201).json({
      success: true,
      data: {
        ...test,
        steps: JSON.parse(test.steps as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tests/:testId
 * Get test details
 */
router.get('/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        suite: {
          select: { id: true, name: true },
        },
        flakyData: true,
        ignoreMasks: true,
        project: {
          include: {
            org: {
              include: {
                users: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    // Get recent executions
    const recentExecutions = await prisma.execution.findMany({
      where: { testId: test.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        duration: true,
        createdAt: true,
      },
    });

    const lastExecution = recentExecutions[0] || null;

    res.json({
      success: true,
      data: {
        ...test,
        steps: JSON.parse(test.steps as string),
        recentExecutions,
        lastRun: lastExecution?.createdAt || null,
        lastStatus: lastExecution?.status || null,
        lastDuration: lastExecution?.duration || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /tests/:testId
 * Update a test
 */
router.patch('/:testId', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    const updates = updateTestSchema.parse(req.body);

    // Verify suite exists if changing
    if (updates.suiteId) {
      const suite = await prisma.testSuite.findFirst({
        where: { id: updates.suiteId, projectId: test.projectId },
      });
      if (!suite) {
        throw BadRequestError('Suite not found in this project');
      }
    }

    const updated = await prisma.test.update({
      where: { id: test.id },
      data: {
        name: updates.name,
        description: updates.description,
        suiteId: updates.suiteId,
        tags: updates.tags,
        config: updates.config as Prisma.InputJsonValue | undefined,
        coveredFiles: updates.coveredFiles,
        steps: updates.steps ? JSON.stringify(updates.steps) : undefined,
        status: updates.status as TestStatus,
        platform: updates.platform as any,
        deviceProfileId: updates.deviceProfileId,
      },
      include: {
        suite: {
          select: { id: true, name: true },
        },
        deviceProfile: {
          select: { id: true, name: true, platform: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        steps: JSON.parse(updated.steps as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /tests/:testId
 * Delete a test
 */
router.delete('/:testId', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    await prisma.test.delete({
      where: { id: test.id },
    });

    logger.info(`Test deleted: ${test.id}`);

    res.json({
      success: true,
      data: { message: 'Test deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /tests/:testId/run
 * Execute a test
 */
router.post('/:testId/run', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
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
          browser: req.body.browser || 'chromium',
          viewport: req.body.viewport,
        },
      },
    });

    // Queue job for worker
    await queueExecution({
      executionId: execution.id,
      projectId: test.projectId,
      testId: test.id,
      config: {
        browser: req.body.browser || 'chromium',
        viewport: req.body.viewport,
      },
    });
    logger.info(`Execution created and queued: ${execution.id} for test ${test.id}`);

    res.status(201).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /tests/:testId/duplicate
 * Duplicate a test
 */
router.post('/:testId/duplicate', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    const { name } = req.body;

    const duplicate = await prisma.test.create({
      data: {
        projectId: test.projectId,
        suiteId: test.suiteId,
        name: name || `${test.name} (copy)`,
        description: test.description,
        steps: test.steps as Prisma.InputJsonValue,
        tags: test.tags,
        config: test.config as Prisma.InputJsonValue,
        coveredFiles: test.coveredFiles,
        status: TestStatus.ACTIVE,
      },
    });

    logger.info(`Test duplicated: ${test.id} -> ${duplicate.id}`);

    res.status(201).json({
      success: true,
      data: {
        ...duplicate,
        steps: JSON.parse(duplicate.steps as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tests/:testId/history
 * Get test execution history
 */
router.get('/:testId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const test = await prisma.test.findUnique({
      where: { id: req.params.testId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where: { testId: test.id },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          triggeredBy: true,
          duration: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.execution.count({ where: { testId: test.id } }),
    ]);

    res.json({
      success: true,
      data: executions,
      meta: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        hasMore: skip + executions.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// SCRIPT PARSING
// =============================================================================

import { parseTestScript, detectFormat, ScriptFormat } from '../services/testParser.service';
import { ApiAiService } from '../services/apiAiService';

const parseScriptSchema = z.object({
  script: z.string().min(1).max(50000),
  format: z.enum(['natural', 'yaml', 'json']).optional(),
  projectId: z.string().optional(),
});

/**
 * POST /tests/parse
 * Parse a test script (natural language, YAML, or JSON) into steps.
 * If projectId is provided and an AI provider is configured, unrecognized
 * natural language sentences are sent to the LLM for interpretation.
 */
router.post('/parse', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseScriptSchema.parse(req.body);
    const format = body.format || detectFormat(body.script);

    // Set up AI fallback if a project has an AI provider configured
    let aiFallback: ((sentence: string) => Promise<import('../services/tests.service').TestStep | null>) | undefined;
    if (body.projectId) {
      const aiService = new ApiAiService();
      await aiService.loadConfig(body.projectId);
      if (aiService.isAvailable()) {
        aiFallback = aiService.parseStep.bind(aiService);
      }
    }

    const result = await parseTestScript(body.script, format as ScriptFormat, aiFallback);

    res.json({
      success: true,
      data: {
        steps: result.steps,
        format,
        warnings: result.warnings,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
