// VisionTest AI - AI Visual Diff Routes
// AI diff config, manual analysis trigger, feedback, accuracy stats

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { safeFetch } from '../utils/urlValidator';

const router = Router();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const aiDiffQueue = new Queue('test-execution', { connection: redisConnection });

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { users: { where: { userId } } } } },
  });
  if (!project || project.org.users.length === 0) throw ForbiddenError('No access');
  return project;
}

// =============================================================================
// AI DIFF CONFIG
// =============================================================================

/**
 * GET /ai-diff/config?projectId=
 */
router.get('/config', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    let config = await prisma.aiDiffConfig.findUnique({ where: { projectId: projectId as string } });
    if (!config) {
      // Return defaults
      config = {
        id: '',
        projectId: projectId as string,
        enabled: false,
        ssimThreshold: 0.97,
        lpipsThreshold: 0.05,
        dinoThreshold: 0.94,
        maxStage: 3,
        autoApproveNoise: false,
        autoApproveMinor: false,
        escalateBreaking: true,
        aiProviderId: null,
        vlmPromptOverride: null,
        vlmCallsPerExecution: 50,
        vlmMonthlyBudget: null,
        sidecarUrl: 'http://visiontest-embeddings:8100',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

/**
 * PUT /ai-diff/config
 */
router.put('/config', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      projectId: z.string().cuid(),
      enabled: z.boolean().optional(),
      ssimThreshold: z.number().min(0.5).max(1.0).optional(),
      lpipsThreshold: z.number().min(0).max(0.5).optional(),
      dinoThreshold: z.number().min(0.5).max(1.0).optional(),
      maxStage: z.number().int().min(0).max(3).optional(),
      autoApproveNoise: z.boolean().optional(),
      autoApproveMinor: z.boolean().optional(),
      escalateBreaking: z.boolean().optional(),
      aiProviderId: z.string().cuid().optional().nullable(),
      vlmPromptOverride: z.string().optional().nullable(),
      vlmCallsPerExecution: z.number().int().min(1).max(1000).optional(),
      vlmMonthlyBudget: z.number().int().min(0).optional().nullable(),
      sidecarUrl: z.string().optional(),
    }).parse(req.body);

    await verifyProjectAccess(input.projectId, req.user!.id);

    const config = await prisma.aiDiffConfig.upsert({
      where: { projectId: input.projectId },
      create: input,
      update: input,
    });

    logger.info(`AI diff config updated for project ${input.projectId}`);
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

/**
 * POST /ai-diff/analyze
 * Trigger manual analysis on a comparison
 */
router.post('/analyze', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, comparisonId } = z.object({
      projectId: z.string().cuid(),
      comparisonId: z.string().cuid(),
    }).parse(req.body);

    await verifyProjectAccess(projectId, req.user!.id);

    const comparison = await prisma.comparison.findUnique({ where: { id: comparisonId } });
    if (!comparison) throw NotFoundError('Comparison');

    // Queue for AI analysis
    await aiDiffQueue.add('ai-diff-analysis', {
      comparisonId,
      projectId,
      manual: true,
    });

    res.json({ success: true, data: { message: 'AI analysis queued', comparisonId } });
  } catch (error) { next(error); }
});

/**
 * POST /ai-diff/test-sidecar
 */
router.post('/test-sidecar', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = z.object({ projectId: z.string().cuid() }).parse(req.body);
    await verifyProjectAccess(projectId, req.user!.id);

    const config = await prisma.aiDiffConfig.findUnique({ where: { projectId } });
    const sidecarUrl = config?.sidecarUrl || 'http://visiontest-embeddings:8100';

    try {
      const start = Date.now();
      let resp: globalThis.Response;
      try {
        resp = await safeFetch(`${sidecarUrl}/health`, { signal: AbortSignal.timeout(10000) });
      } catch (err: any) {
        if (err.message?.includes('blocked') || err.message?.includes('not allowed') || err.message?.includes('Cannot resolve')) {
          return res.status(400).json({ success: false, error: err.message });
        }
        throw err;
      }
      const latencyMs = Date.now() - start;
      if (resp.ok) {
        const data: any = await resp.json();
        return res.json({
          success: true,
          data: {
            connected: true,
            latencyMs,
            modelsLoaded: data.models_loaded,
            gpuAvailable: data.gpu_available,
            device: data.device,
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
 * GET /ai-diff/stats?projectId=
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const comparisons = await prisma.comparison.findMany({
      where: {
        execution: { projectId: projectId as string },
        createdAt: { gte: weekAgo },
        aiClassification: { not: null },
      },
      select: { aiClassification: true, aiStageReached: true },
    });

    const counts: Record<string, number> = { IDENTICAL: 0, NOISE: 0, MINOR: 0, SIGNIFICANT: 0, BREAKING: 0 };
    const stageCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (const c of comparisons) {
      if (c.aiClassification) counts[c.aiClassification] = (counts[c.aiClassification] || 0) + 1;
      if (c.aiStageReached !== null) stageCounts[c.aiStageReached] = (stageCounts[c.aiStageReached] || 0) + 1;
    }

    const total = comparisons.length;
    const noiseRate = total > 0 ? Math.round(((counts.IDENTICAL + counts.NOISE) / total) * 100) : 0;

    res.json({
      success: true,
      data: { total, counts, stageCounts, noiseRate, period: '7d' },
    });
  } catch (error) { next(error); }
});

// =============================================================================
// FEEDBACK
// =============================================================================

/**
 * POST /ai-diff/feedback
 */
router.post('/feedback', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      comparisonId: z.string().cuid(),
      userAction: z.enum(['APPROVED', 'REJECTED', 'RECLASSIFIED', 'ESCALATED']),
      userClassification: z.enum(['NOISE', 'MINOR', 'SIGNIFICANT', 'BREAKING']).optional(),
    }).parse(req.body);

    const comparison = await prisma.comparison.findUnique({
      where: { id: input.comparisonId },
      include: { execution: { select: { project: { select: { orgId: true } } } } },
    });
    if (!comparison) throw NotFoundError('Comparison');
    if (!comparison.aiClassification) throw BadRequestError('Comparison has no AI classification');

    const disagreement = isDisagreement(comparison.aiSuggestedAction, input.userAction);

    const feedback = await prisma.aiDiffFeedback.create({
      data: {
        comparisonId: input.comparisonId,
        aiClassification: comparison.aiClassification,
        aiConfidence: comparison.aiConfidence || 0,
        userAction: input.userAction,
        userClassification: input.userClassification || null,
        disagreement,
        orgId: comparison.execution.project.orgId,
      },
    });

    res.status(201).json({ success: true, data: feedback });
  } catch (error) { next(error); }
});

function isDisagreement(aiAction: string | null, userAction: string): boolean {
  if (!aiAction) return false;
  if (aiAction === 'AUTO_APPROVE' && (userAction === 'REJECTED' || userAction === 'ESCALATED')) return true;
  if (aiAction === 'ESCALATE' && userAction === 'APPROVED') return true;
  if (aiAction === 'REJECT' && userAction === 'APPROVED') return true;
  return false;
}

/**
 * GET /ai-diff/accuracy?orgId=
 */
router.get('/accuracy', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, days = '30' } = req.query;
    if (!orgId) throw BadRequestError('orgId required');

    // Verify the user is a member of the requested org
    const membership = await prisma.organizationUser.findUnique({
      where: { userId_orgId: { userId: req.user!.id, orgId: orgId as string } },
    });
    if (!membership) throw ForbiddenError('Not a member of this organization');

    const since = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);

    const feedback = await prisma.aiDiffFeedback.findMany({
      where: { orgId: orgId as string, createdAt: { gte: since } },
    });

    const total = feedback.length;
    const disagreements = feedback.filter(f => f.disagreement).length;
    const strongLabels = feedback.filter(f => f.userClassification !== null);
    const strongCorrect = strongLabels.filter(f => f.aiClassification === f.userClassification).length;
    const accuracy = strongLabels.length > 0 ? Math.round((strongCorrect / strongLabels.length) * 100) / 100 : null;

    res.json({
      success: true,
      data: {
        totalFeedback: total,
        disagreements,
        disagreementRate: total > 0 ? Math.round((disagreements / total) * 100) / 100 : 0,
        strongLabels: strongLabels.length,
        accuracy,
        period: `${days}d`,
      },
    });
  } catch (error) { next(error); }
});

export default router;
