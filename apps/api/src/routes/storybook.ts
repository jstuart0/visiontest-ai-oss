// VisionTest AI - Storybook Integration Routes
// Config, sync, stories discovery, test-connection

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, syncStorybook } from '@visiontest/database';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { safeFetch } from '../utils/urlValidator';

const router = Router();

// ---------------------------------------------------------------------------
// BullMQ queue for scheduling storybook-sync repeatable jobs
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const storybookQueue = new Queue('test-execution', { connection: redisConnection });

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { users: { where: { userId } } } } },
  });
  if (!project || project.org.users.length === 0) throw ForbiddenError('No access');
  return project;
}

// =============================================================================
// STORYBOOK CONFIG
// =============================================================================

/**
 * GET /storybook/config?projectId=
 */
router.get('/config', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    let config = await prisma.storybookConfig.findUnique({ where: { projectId: projectId as string } });
    if (!config) {
      config = {
        id: '',
        projectId: projectId as string,
        enabled: false,
        mode: 'cli',
        storybookUrl: null,
        minioStaticPath: null,
        syncMode: 'manual',
        pollIntervalMin: 60,
        viewports: [
          { name: 'Desktop', width: 1440, height: 900 },
          { name: 'Mobile', width: 375, height: 812 },
        ],
        includePatterns: [],
        excludePatterns: ['*--docs'],
        waitAfterLoadMs: 500,
        indexJsonVersion: null,
        lastSyncAt: null,
        lastSyncStoryCount: null,
        lastSyncError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

/**
 * PUT /storybook/config
 */
router.put('/config', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      projectId: z.string().cuid(),
      enabled: z.boolean().optional(),
      mode: z.enum(['cli', 'connected', 'hybrid']).optional(),
      storybookUrl: z.string().optional().nullable(),
      minioStaticPath: z.string().optional().nullable(),
      syncMode: z.enum(['manual', 'polling', 'webhook']).optional(),
      pollIntervalMin: z.number().int().min(5).optional(),
      viewports: z.array(z.object({
        name: z.string(),
        width: z.number().int().min(100),
        height: z.number().int().min(100),
      })).optional(),
      includePatterns: z.array(z.string()).optional(),
      excludePatterns: z.array(z.string()).optional(),
      waitAfterLoadMs: z.number().int().min(0).max(10000).optional(),
    }).parse(req.body);

    await verifyProjectAccess(input.projectId, req.user!.id);

    const config = await prisma.storybookConfig.upsert({
      where: { projectId: input.projectId },
      create: input as any,
      update: input as any,
    });

    // ---- Manage BullMQ repeatable scheduler ----
    await reconcilePollingScheduler(config.projectId, config);

    logger.info(`Storybook config updated for project ${input.projectId}`);
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

// =============================================================================
// SYNC
// =============================================================================

/**
 * POST /storybook/sync
 * Trigger story discovery and test creation/update
 */
router.post('/sync', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, storybookUrl } = z.object({
      projectId: z.string().cuid(),
      storybookUrl: z.string().optional(),
    }).parse(req.body);

    await verifyProjectAccess(projectId, req.user!.id);

    const config = await prisma.storybookConfig.findUnique({ where: { projectId } });
    const url = storybookUrl || config?.storybookUrl;

    if (!url) throw BadRequestError('No Storybook URL configured. Set a URL or use CLI mode.');

    try {
      const result = await syncStorybook(prisma, projectId, url, {
        includePatterns: config?.includePatterns || [],
        excludePatterns: config?.excludePatterns || ['*--docs'],
        waitAfterLoadMs: config?.waitAfterLoadMs ?? 500,
      }, safeFetch);

      logger.info(
        `Storybook sync: ${result.storiesDiscovered} stories, created=${result.testsCreated}, updated=${result.testsUpdated}, archived=${result.testsArchived}`,
      );

      res.json({
        success: true,
        data: {
          ...result,
          errors: [],
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      throw BadRequestError(errMsg);
    }
  } catch (error) { next(error); }
});

/**
 * GET /storybook/stories?projectId=
 * List discovered stories with sync status
 */
router.get('/stories', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const tests = await prisma.test.findMany({
      where: { projectId: projectId as string, source: 'storybook' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        storybookStoryId: true,
        storybookImport: true,
        storybookContentHash: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: tests, meta: { total: tests.length } });
  } catch (error) { next(error); }
});

/**
 * POST /storybook/test-connection
 */
router.post('/test-connection', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, storybookUrl } = z.object({
      projectId: z.string().cuid(),
      storybookUrl: z.string(),
    }).parse(req.body);

    await verifyProjectAccess(projectId, req.user!.id);

    try {
      const start = Date.now();
      const indexUrl = storybookUrl.replace(/\/$/, '') + '/index.json';
      let resp: globalThis.Response;
      try {
        resp = await safeFetch(indexUrl, { signal: AbortSignal.timeout(10000) });
      } catch (err: any) {
        if (err.message?.includes('blocked') || err.message?.includes('not allowed') || err.message?.includes('Cannot resolve')) {
          return res.status(400).json({ success: false, error: err.message });
        }
        throw err;
      }
      const latencyMs = Date.now() - start;

      if (resp.ok) {
        const data: any = await resp.json();
        const storyCount = data.v >= 4
          ? Object.values(data.entries || {}).filter((e: any) => e.type === 'story').length
          : Object.keys(data.stories || {}).length;

        return res.json({
          success: true,
          data: {
            connected: true,
            latencyMs,
            storyCount,
            indexVersion: data.v >= 4 ? 'v4' : 'v3',
          },
        });
      } else {
        return res.json({ success: true, data: { connected: false, error: `HTTP ${resp.status}` } });
      }
    } catch (e) {
      return res.json({ success: true, data: { connected: false, error: e instanceof Error ? e.message : 'Connection failed' } });
    }
  } catch (error) { return next(error); }
});

/**
 * DELETE /storybook/tests
 * Remove all storybook-generated tests
 */
router.delete('/tests', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const result = await prisma.test.deleteMany({
      where: { projectId: projectId as string, source: 'storybook' },
    });

    logger.info(`Deleted ${result.count} storybook tests for project ${projectId}`);
    res.json({ success: true, data: { deleted: result.count } });
  } catch (error) { next(error); }
});

// =============================================================================
// POLLING SCHEDULER HELPERS
// =============================================================================

/** Scheduler key prefix used for repeatable job identification */
const SCHEDULER_KEY_PREFIX = 'storybook-poll';

function schedulerKey(projectId: string): string {
  return `${SCHEDULER_KEY_PREFIX}:${projectId}`;
}

/**
 * Upsert or remove the BullMQ repeatable scheduler for a project based on its
 * current StorybookConfig values.
 */
async function reconcilePollingScheduler(
  projectId: string,
  config: { enabled: boolean; syncMode: string; pollIntervalMin: number | null },
): Promise<void> {
  const key = schedulerKey(projectId);

  if (config.enabled && config.syncMode === 'polling') {
    const intervalMs = (config.pollIntervalMin ?? 60) * 60 * 1000;

    // Remove existing scheduler first (idempotent)
    try {
      await storybookQueue.removeRepeatableByKey(key);
    } catch {
      // may not exist yet — that's fine
    }

    await storybookQueue.add(
      'storybook-sync',
      { projectId },
      {
        repeat: { every: intervalMs, key },
        jobId: key,
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );
    logger.info(`Storybook polling scheduler upserted for project ${projectId} (every ${config.pollIntervalMin ?? 60}min)`);
  } else {
    // Remove scheduler if it exists
    try {
      await storybookQueue.removeRepeatableByKey(key);
      logger.info(`Storybook polling scheduler removed for project ${projectId}`);
    } catch {
      // nothing to remove
    }
  }
}

/**
 * Reconcile all polling schedulers on API startup.
 * Ensures schedulers match current DB state (adds missing, removes orphans).
 */
export async function reconcileAllPollingSchedulers(): Promise<void> {
  logger.info('Reconciling storybook polling schedulers...');

  // 1. Load all configs that want polling
  const activeConfigs = await prisma.storybookConfig.findMany({
    where: { syncMode: 'polling', enabled: true },
    select: { projectId: true, pollIntervalMin: true, enabled: true, syncMode: true },
  });

  const activeProjectIds = new Set(activeConfigs.map((c) => c.projectId));

  // 2. Get existing repeatable jobs
  const repeatableJobs = await storybookQueue.getRepeatableJobs();
  const existingKeys = new Set<string>();

  for (const rj of repeatableJobs) {
    if (rj.key.startsWith(SCHEDULER_KEY_PREFIX + ':')) {
      existingKeys.add(rj.key);
      // Extract projectId from key
      const pid = rj.key.slice(SCHEDULER_KEY_PREFIX.length + 1);
      if (!activeProjectIds.has(pid)) {
        // Orphaned scheduler — remove it
        await storybookQueue.removeRepeatableByKey(rj.key);
        logger.info(`Removed orphaned storybook scheduler: ${rj.key}`);
      }
    }
  }

  // 3. Upsert schedulers for active configs
  for (const cfg of activeConfigs) {
    await reconcilePollingScheduler(cfg.projectId, cfg);
  }

  logger.info(`Storybook scheduler reconciliation complete: ${activeConfigs.length} active schedulers`);
}

export default router;
