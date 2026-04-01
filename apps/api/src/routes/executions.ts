// VisionTest AI - Execution Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, ExecutionStatus, TriggerType, Prisma, Platform } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { io } from '../index';
import { queueExecution, cancelExecution } from '../lib/queue';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { runComparisonsForExecution } from '../services/visualDiff.service';

const router = Router();

// MinIO Configuration
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const SCREENSHOT_BUCKET = process.env.SCREENSHOT_BUCKET || 'visiontest-screenshots';

const minioClient = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createExecutionSchema = z.object({
  projectId: z.string().cuid(),
  testId: z.string().cuid().optional(),
  suiteId: z.string().cuid().optional(),
  testIds: z.array(z.string().cuid()).optional(),
  platform: z.enum(['WEB', 'IOS', 'ANDROID', 'MOBILE_WEB']).optional(),
  deviceProfileId: z.string().cuid().optional(),
  appVersion: z.string().max(100).optional(),
  config: z.object({
    browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    headless: z.boolean().optional(),
    viewport: z.object({ width: z.number(), height: z.number() }).optional(),
    baseUrl: z.string().url().optional(),
    retries: z.number().optional(),
    timeout: z.number().optional(),
    parallel: z.number().optional(),
    mobileWebDevice: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateExecutionSchema = z.object({
  status: z.enum(['PENDING', 'QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'SKIPPED']).optional(),
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  duration: z.number().optional(),
});

const vrtReportSchema = z.object({
  projectId: z.string().cuid(),
  testName: z.string().optional(),
  suiteName: z.string().optional(),
  baselineName: z.string().optional(), // explicit baseline name (overrides suiteName/testName)
  branch: z.string().optional(),
  platform: z.enum(['WEB', 'IOS', 'ANDROID', 'MOBILE_WEB']).optional(),
  isBaseline: z.boolean().optional().default(false),
  screenshots: z.array(z.object({
    name: z.string(),
    image: z.string(), // base64 encoded image
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    deviceType: z.string().optional(),
    deviceName: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /executions
 * List executions for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, testId, suiteId, status, triggeredBy, platform, page = '1', limit = '20' } = req.query;

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

    const where: any = { projectId: projectId as string };
    if (testId) where.testId = testId as string;
    if (suiteId) where.suiteId = suiteId as string;
    if (status) where.status = status as string;
    if (triggeredBy) where.triggeredBy = triggeredBy as string;
    if (platform) where.platform = platform as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          test: { select: { id: true, name: true, platform: true } },
          suite: { select: { id: true, name: true } },
          deviceProfile: { select: { id: true, name: true, platform: true } },
          _count: { select: { screenshots: true, comparisons: true } },
        },
      }),
      prisma.execution.count({ where }),
    ]);

    res.json({
      success: true,
      data: executions.map((e) => ({
        ...e,
        screenshotCount: e._count.screenshots,
        comparisonCount: e._count.comparisons,
      })),
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

/**
 * POST /executions
 * Create a new execution
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createExecutionSchema.parse(req.body);

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

    // Validate test/suite exists
    if (input.testId) {
      const test = await prisma.test.findFirst({
        where: { id: input.testId, projectId: input.projectId },
      });
      if (!test) throw BadRequestError('Test not found');
      if (test.status === 'QUARANTINED') {
        throw BadRequestError('Cannot run quarantined test');
      }
    }

    if (input.suiteId) {
      const suite = await prisma.testSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
      });
      if (!suite) throw BadRequestError('Suite not found');
    }

    const execution = await prisma.execution.create({
      data: {
        projectId: input.projectId,
        testId: input.testId,
        suiteId: input.suiteId,
        status: 'PENDING',
        triggeredBy: 'API',
        platform: (input.platform || 'WEB') as any,
        deviceProfileId: input.deviceProfileId,
        appVersion: input.appVersion,
        metadata: {
          ...input.metadata,
          config: input.config,
          testIds: input.testIds,
        },
      },
    });

    // Emit WebSocket event
    io.to(`project:${input.projectId}`).emit('execution:created', {
      executionId: execution.id,
    });

    // Queue job for worker
    await queueExecution({
      executionId: execution.id,
      projectId: input.projectId,
      testId: input.testId,
      suiteId: input.suiteId,
      config: input.config,
      platform: input.platform,
      deviceProfileId: input.deviceProfileId,
    });
    logger.info(`Execution created and queued: ${execution.id}`);

    res.status(201).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    next(error);
  }
});


/**
 * POST /executions/report
 * Ingest a VRT report batch with screenshots
 */
router.post('/report', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = vrtReportSchema.parse(req.body);

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: {
          include: { users: { where: { userId: req.user!.id } } },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access to this project');
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        projectId: input.projectId,
        status: 'RUNNING',
        triggeredBy: 'API',
        platform: input.platform || 'WEB',
        metadata: {
          ...input.metadata,
          testName: input.testName,
          suiteName: input.suiteName,
          baselineName: input.baselineName,
          branch: input.branch,
          isBaseline: input.isBaseline,
          screenshotCount: input.screenshots.length,
        },
      },
    });

    const uploadedScreenshots: any[] = [];
    let hasFailures = false;

    // Process each screenshot
    for (let i = 0; i < input.screenshots.length; i++) {
      const screenshot = input.screenshots[i];
      
      try {
        // Decode base64 image
        const base64Data = screenshot.image.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Determine file extension from image data
        const fileExtension = screenshot.image.includes('data:image/png') ? 'png' : 'jpg';
        const uniqueFilename = `${randomUUID()}.${fileExtension}`;
        const objectPath = `${execution.id}/${uniqueFilename}`;

        // Upload to MinIO
        await minioClient.putObject(
          SCREENSHOT_BUCKET,
          objectPath,
          imageBuffer,
          imageBuffer.length,
          {
            'Content-Type': `image/${fileExtension}`,
            'Cache-Control': 'public, max-age=31536000',
          }
        );

        // Create screenshot record
        const screenshotRecord = await prisma.screenshot.create({
          data: {
            executionId: execution.id,
            stepNumber: i + 1,
            name: screenshot.name,
            url: objectPath,
            width: screenshot.viewport?.width || 1280,
            height: screenshot.viewport?.height || 720,
            deviceType: screenshot.deviceType,
            platform: input.platform || 'WEB',
            deviceName: screenshot.deviceName,
            metadata: {
              theme: screenshot.theme,
              ...screenshot.metadata,
            },
          },
        });

        uploadedScreenshots.push(screenshotRecord);
      } catch (error) {
        logger.error(`Failed to process screenshot ${screenshot.name}:`, error);
        hasFailures = true;
      }
    }

    // Update execution status based on results
    const finalStatus = hasFailures ? 'FAILED' : 'PASSED';
    
    const updatedExecution = await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        result: {
          screenshots: uploadedScreenshots.length,
          failures: hasFailures,
        },
      },
      include: {
        screenshots: true,
      },
    });

    // If this is a baseline run, create/update baseline
    if (input.isBaseline && uploadedScreenshots.length > 0) {
      const baselineName = input.baselineName || input.suiteName || input.testName || 'VRT Baseline';
      const branch = input.branch || 'main';
      
      const baselineScreenshots = uploadedScreenshots.map((s: any) => ({
        name: s.name,
        url: `/api/v1/screenshots/${execution.id}/${s.url.split('/').pop()}`,
        width: s.width,
        height: s.height,
        deviceType: s.deviceType || 'desktop',
      }));

      // Check if baseline already exists
      const existingBaseline = await prisma.baseline.findFirst({
        where: {
          projectId: input.projectId,
          name: baselineName,
          branch: branch,
        },
      });

      if (existingBaseline) {
        // Update existing baseline
        await prisma.baseline.update({
          where: { id: existingBaseline.id },
          data: {
            screenshots: JSON.stringify(baselineScreenshots),
            metadata: {
              lastUpdatedBy: req.user!.id,
              executionId: execution.id,
              updatedAt: new Date().toISOString(),
              ...input.metadata,
            },
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new baseline
        await prisma.baseline.create({
          data: {
            projectId: input.projectId,
            name: baselineName,
            branch: branch,
            screenshots: JSON.stringify(baselineScreenshots),
            metadata: {
              createdBy: req.user!.id,
              executionId: execution.id,
              createdAt: new Date().toISOString(),
              ...input.metadata,
            },
          },
        });
      }
    }

    // Auto-run comparisons if this is NOT a baseline run
    let comparisonSummary: Awaited<ReturnType<typeof runComparisonsForExecution>> = null;
    if (!input.isBaseline && uploadedScreenshots.length > 0) {
      try {
        const explicitName = input.baselineName || input.suiteName || undefined;
        comparisonSummary = await runComparisonsForExecution(execution.id, explicitName);
        if (comparisonSummary) {
          logger.info(
            `Auto-comparison for ${execution.id}: ${comparisonSummary.matched} matched, ` +
            `${comparisonSummary.diffDetected} diffs, ${comparisonSummary.newScreenshots} new`
          );
        }
      } catch (error) {
        logger.error(`Auto-comparison failed for execution ${execution.id}:`, error);
      }
    }

    // Emit WebSocket events
    io.to(`project:${input.projectId}`).emit('execution:created', {
      executionId: execution.id,
    });
    io.to(`execution:${execution.id}`).emit('execution:completed', {
      executionId: execution.id,
      status: finalStatus,
    });

    const baselineNameUsed = input.baselineName || input.suiteName || input.testName || 'VRT Baseline';
    logger.info(`VRT report processed: ${execution.id} with ${uploadedScreenshots.length} screenshots`);

    res.status(201).json({
      success: true,
      data: {
        execution: updatedExecution,
        screenshots: uploadedScreenshots,
        baseline: input.isBaseline ? `${baselineNameUsed} (${input.branch || 'main'})` : null,
        comparisons: comparisonSummary,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /executions/:executionId
 * Get execution details
 */
router.get('/:executionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        test: { select: { id: true, name: true, steps: true, platform: true } },
        suite: { select: { id: true, name: true } },
        deviceProfile: {
          select: { id: true, name: true, platform: true, width: true, height: true, scaleFactor: true },
        },
        screenshots: {
          orderBy: { stepNumber: 'asc' },
        },
        videos: {
          orderBy: { createdAt: 'asc' },
        },
        comparisons: {
          include: {
            baseline: { select: { id: true, name: true } },
          },
        },
        checkpoints: {
          orderBy: { stepNumber: 'asc' },
          select: { id: true, stepNumber: true, screenshotUrl: true, createdAt: true },
        },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: execution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /executions/:executionId
 * Update execution (used by worker)
 */
router.patch('/:executionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
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

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const updates = updateExecutionSchema.parse(req.body);

    const updated = await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: updates.status as ExecutionStatus,
        result: updates.result as Prisma.InputJsonValue | undefined,
        errorMessage: updates.errorMessage,
        duration: updates.duration,
        ...(updates.status === 'RUNNING' && !execution.startedAt && { startedAt: new Date() }),
        ...(['PASSED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(updates.status || '') && {
          completedAt: new Date(),
        }),
      },
    });

    // Emit WebSocket event
    io.to(`execution:${execution.id}`).emit('execution:updated', {
      executionId: execution.id,
      status: updated.status,
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
 * GET /executions/:executionId/logs
 * Get execution logs
 */
router.get('/:executionId/logs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
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

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Get result which contains step logs
    const result = execution.result as any;

    res.json({
      success: true,
      data: {
        steps: result?.steps || [],
        healingLog: execution.healingLog || [],
        errorMessage: execution.errorMessage,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /executions/:executionId/artifacts
 * Get execution artifacts
 */
router.get('/:executionId/artifacts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        screenshots: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: {
        screenshots: execution.screenshots,
        artifacts: execution.artifacts,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /executions/:executionId/stop
 * Stop a running execution
 */
router.post('/:executionId/stop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
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

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    if (!['PENDING', 'QUEUED', 'RUNNING'].includes(execution.status)) {
      throw BadRequestError('Execution is not running');
    }

    const updated = await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    // Emit WebSocket event
    io.to(`execution:${execution.id}`).emit('execution:cancelled', {
      executionId: execution.id,
    });

    // Signal worker to stop via job cancellation
    await cancelExecution(execution.id);
    logger.info(`Execution stopped: ${execution.id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /executions/:executionId/rerun
 * Re-run an execution
 */
router.post('/:executionId/rerun', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
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

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Create new execution with same config
    const newExecution = await prisma.execution.create({
      data: {
        projectId: execution.projectId,
        testId: execution.testId,
        suiteId: execution.suiteId,
        status: 'PENDING',
        triggeredBy: 'MANUAL',
        triggerRef: `rerun:${execution.id}`,
        metadata: execution.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    // Queue job for worker
    await queueExecution({
      executionId: newExecution.id,
      projectId: execution.projectId,
      testId: execution.testId || undefined,
      suiteId: execution.suiteId || undefined,
      config: (execution.metadata as Record<string, unknown>)?.config as Record<string, unknown>,
    });
    logger.info(`Execution rerun queued: ${execution.id} -> ${newExecution.id}`);

    res.status(201).json({
      success: true,
      data: newExecution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /executions/:executionId/checkpoints
 * Get execution checkpoints for replay
 */
router.get('/:executionId/checkpoints', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        checkpoints: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: execution.checkpoints,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /executions/:executionId/replay
 * Replay from a checkpoint
 */
router.post('/:executionId/replay', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stepNumber, checkpointId } = z.object({
      stepNumber: z.number().optional(),
      checkpointId: z.string().cuid().optional(),
    }).parse(req.body);

    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        checkpoints: true,
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Find checkpoint
    let checkpoint;
    if (checkpointId) {
      checkpoint = execution.checkpoints.find((c) => c.id === checkpointId);
    } else if (stepNumber !== undefined) {
      checkpoint = execution.checkpoints.find((c) => c.stepNumber === stepNumber);
    }

    if (!checkpoint) {
      throw BadRequestError('Checkpoint not found');
    }

    // Check if checkpoint is not expired
    if (new Date(checkpoint.expiresAt) < new Date()) {
      throw BadRequestError('Checkpoint has expired');
    }

    // Create new execution for replay
    const replayExecution = await prisma.execution.create({
      data: {
        projectId: execution.projectId,
        testId: execution.testId,
        status: 'PENDING',
        triggeredBy: 'MANUAL',
        triggerRef: `replay:${execution.id}:${checkpoint.stepNumber}`,
        metadata: {
          replayFrom: {
            executionId: execution.id,
            checkpointId: checkpoint.id,
            stepNumber: checkpoint.stepNumber,
          },
        },
      },
    });

    // Queue job for worker with checkpoint data
    await queueExecution({
      executionId: replayExecution.id,
      projectId: execution.projectId,
      testId: execution.testId || undefined,
      checkpointId: checkpoint.id,
    });
    logger.info(`Replay execution queued: ${replayExecution.id} from step ${checkpoint.stepNumber}`);

    res.status(201).json({
      success: true,
      data: {
        execution: replayExecution,
        checkpoint,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /executions/:executionId/compare
 * Manually trigger visual comparisons for an execution against baselines
 */
router.post('/:executionId/compare', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { baselineName } = z.object({
      baselineName: z.string().optional(),
    }).parse(req.body || {});

    const execution = await prisma.execution.findUnique({
      where: { id: req.params.executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        _count: { select: { comparisons: true } },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Delete existing comparisons if re-running
    if (execution._count.comparisons > 0) {
      await prisma.comparison.deleteMany({
        where: { executionId: execution.id },
      });
      logger.info(`Deleted ${execution._count.comparisons} existing comparisons for re-comparison`);
    }

    const summary = await runComparisonsForExecution(execution.id, baselineName);

    if (!summary) {
      throw BadRequestError('No matching baseline found or no screenshots in execution');
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});


export default router;
