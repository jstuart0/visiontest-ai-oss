// VisionTest.ai - Autonomous Bug Fixing Routes
// Manages bug candidates, fix sessions, investigation, and delivery

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// BullMQ queue for fix session processing
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const executionQueue = new Queue('test-execution', { connection: redisConnection });

// =============================================================================
// HELPERS
// =============================================================================

async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationUser.findMany({
    where: { userId },
    select: { orgId: true },
  });
  return memberships.map((m) => m.orgId);
}

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: { include: { users: { where: { userId } } } },
    },
  });
  if (!project || project.org.users.length === 0) {
    throw ForbiddenError('No access to this project');
  }
  return project;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createCandidateSchema = z.object({
  projectId: z.string().cuid(),
  testId: z.string().cuid().optional(),
  executionId: z.string().cuid().optional(),
  comparisonId: z.string().cuid().optional(),
  repoConnectionId: z.string().cuid().optional(),
  sourceType: z.enum(['execution', 'comparison', 'approval', 'manual']).optional(),
  title: z.string().min(1).max(500),
  plainLanguageSummary: z.string().optional(),
  failureType: z.enum(['VISUAL', 'RUNTIME', 'ASSERTION', 'PERFORMANCE', 'MOBILE', 'API', 'UNKNOWN']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  classification: z.enum(['PRODUCT_BUG', 'TEST_ISSUE', 'ENVIRONMENT_ISSUE', 'EXPECTED_CHANGE', 'UNCLASSIFIED']).optional(),
});

const updateCandidateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  plainLanguageSummary: z.string().optional(),
  failureType: z.enum(['VISUAL', 'RUNTIME', 'ASSERTION', 'PERFORMANCE', 'MOBILE', 'API', 'UNKNOWN']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['NEW', 'TRIAGING', 'INVESTIGATING', 'AWAITING_APPROVAL', 'APPLYING', 'VERIFYING', 'READY', 'MERGED', 'DISMISSED']).optional(),
  classification: z.enum(['PRODUCT_BUG', 'TEST_ISSUE', 'ENVIRONMENT_ISSUE', 'EXPECTED_CHANGE', 'UNCLASSIFIED']).optional(),
  assignedTo: z.string().optional().nullable(),
});

const createSessionSchema = z.object({
  bugCandidateId: z.string().cuid(),
  mode: z.enum(['INVESTIGATE_ONLY', 'SUGGEST_PATCH', 'APPLY_PATCH', 'OPEN_PR']).optional(),
  strategy: z.string().optional(),
});

const feedbackSchema = z.object({
  bugCandidateId: z.string().cuid(),
  fixSessionId: z.string().cuid().optional(),
  feedbackType: z.enum(['CORRECT_FIX', 'PARTIAL_FIX', 'WRONG_ROOT_CAUSE', 'TOO_RISKY', 'TOO_BROAD', 'SHOULD_BE_BASELINE_CHANGE', 'SHOULD_BE_TEST_ISSUE', 'OTHER']),
  comment: z.string().optional(),
});

const analyzeSchema = z.object({
  analysisType: z.enum(['FAILURE_SUMMARY', 'VISUAL_ANALYSIS', 'ROOT_CAUSE_HYPOTHESIS', 'SUGGESTED_ACTIONS', 'CODE_CONTEXT', 'PATCH_RATIONALE']).optional(),
});

// =============================================================================
// BUG CANDIDATE ROUTES
// =============================================================================

/**
 * GET /fixes/candidates
 * List bug candidates
 */
router.get('/candidates', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, status, classification, failureType, page = '1', limit = '20' } = req.query;
    const orgIds = await getUserOrgIds(req.user!.id);

    const where: any = {
      project: { orgId: { in: orgIds } },
    };
    if (projectId) where.projectId = projectId as string;
    if (status) where.status = status as string;
    if (classification) where.classification = classification as string;
    if (failureType) where.failureType = failureType as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [candidates, total] = await Promise.all([
      prisma.bugCandidate.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: {
          fixSessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, mode: true, confidenceScore: true },
          },
          _count: { select: { fixSessions: true, analyses: true } },
        },
      }),
      prisma.bugCandidate.count({ where }),
    ]);

    res.json({
      success: true,
      data: candidates,
      meta: { page: parseInt(page as string), limit: take, total, hasMore: skip + take < total },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fixes/candidates/:id
 * Get bug candidate detail
 */
router.get('/candidates/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgIds = await getUserOrgIds(req.user!.id);

    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, orgId: true } },
        repoConnection: { select: { id: true, provider: true, repoUrl: true } },
        fixSessions: {
          orderBy: { createdAt: 'desc' },
          include: {
            artifacts: { select: { id: true, type: true, name: true, createdAt: true } },
            verificationRuns: { select: { id: true, status: true, passedSteps: true, failedSteps: true, totalSteps: true } },
            _count: { select: { artifacts: true, verificationRuns: true } },
          },
        },
        analyses: { orderBy: { createdAt: 'desc' } },
        feedback: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!candidate) throw NotFoundError('Bug candidate');
    if (!orgIds.includes(candidate.project.orgId)) throw ForbiddenError('No access');

    res.json({ success: true, data: candidate });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/candidates
 * Create a bug candidate
 */
router.post('/candidates', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCandidateSchema.parse(req.body);
    await verifyProjectAccess(input.projectId, req.user!.id);

    const candidate = await prisma.bugCandidate.create({
      data: {
        projectId: input.projectId,
        testId: input.testId,
        executionId: input.executionId,
        comparisonId: input.comparisonId,
        repoConnectionId: input.repoConnectionId,
        sourceType: input.sourceType || 'manual',
        title: input.title,
        plainLanguageSummary: input.plainLanguageSummary,
        failureType: input.failureType || 'UNKNOWN',
        severity: input.severity || 'MEDIUM',
        classification: input.classification || 'UNCLASSIFIED',
        branch: input.branch,
        commitSha: input.commitSha,
        createdByMode: 'USER',
        createdByUserId: req.user!.id,
      },
    });

    logger.info(`Bug candidate created: ${candidate.id}`);
    res.status(201).json({ success: true, data: candidate });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /fixes/candidates/:id
 * Update a bug candidate
 */
router.patch('/candidates/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateCandidateSchema.parse(req.body);
    const existing = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    });
    if (!existing) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(existing.projectId, req.user!.id);

    const updated = await prisma.bugCandidate.update({
      where: { id: req.params.id },
      data: input,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/candidates/:id/investigate
 * Start investigation on a bug candidate
 */
router.post('/candidates/:id/investigate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true, status: true },
    });
    if (!candidate) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(candidate.projectId, req.user!.id);

    // Update candidate status
    await prisma.bugCandidate.update({
      where: { id: candidate.id },
      data: { status: 'INVESTIGATING' },
    });

    // Create a fix session in investigate-only mode
    const session = await prisma.fixSession.create({
      data: {
        bugCandidateId: candidate.id,
        mode: 'INVESTIGATE_ONLY',
        status: 'INVESTIGATING',
        startedAt: new Date(),
      },
    });

    // Create initial analysis
    const analysis = await prisma.investigationAnalysis.create({
      data: {
        bugCandidateId: candidate.id,
        fixSessionId: session.id,
        analysisType: 'FAILURE_SUMMARY',
        status: 'PENDING',
        createdBy: 'system',
      },
    });

    // Queue fix session for worker processing
    await executionQueue.add('fix-session', {
      fixSessionId: session.id,
      bugCandidateId: candidate.id,
    });

    logger.info(`Investigation started: candidate=${candidate.id} session=${session.id}`);
    res.status(201).json({ success: true, data: { session, analysis } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/candidates/:id/patch
 * Generate a patch for a bug candidate
 */
router.post('/candidates/:id/patch', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true },
    });
    if (!candidate) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(candidate.projectId, req.user!.id);

    const session = await prisma.fixSession.create({
      data: {
        bugCandidateId: candidate.id,
        mode: 'SUGGEST_PATCH',
        status: 'PENDING',
      },
    });

    await prisma.bugCandidate.update({
      where: { id: candidate.id },
      data: { status: 'INVESTIGATING' },
    });

    // Queue fix session for worker processing
    await executionQueue.add('fix-session', {
      fixSessionId: session.id,
      bugCandidateId: candidate.id,
    });

    logger.info(`Patch session created: ${session.id} for candidate ${candidate.id}`);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/candidates/:id/apply
 * Apply fix to a branch
 */
router.post('/candidates/:id/apply', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchName } = z.object({ branchName: z.string().optional() }).parse(req.body);

    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true },
    });
    if (!candidate) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(candidate.projectId, req.user!.id);

    const session = await prisma.fixSession.create({
      data: {
        bugCandidateId: candidate.id,
        mode: 'APPLY_PATCH',
        status: 'PENDING',
        branchName,
      },
    });

    await prisma.bugCandidate.update({
      where: { id: candidate.id },
      data: { status: 'APPLYING' },
    });

    await executionQueue.add('fix-session', {
      fixSessionId: session.id,
      bugCandidateId: candidate.id,
    });

    logger.info(`Apply session created: ${session.id}`);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/candidates/:id/pr
 * Open a PR for a bug candidate
 */
router.post('/candidates/:id/pr', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true },
    });
    if (!candidate) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(candidate.projectId, req.user!.id);

    const session = await prisma.fixSession.create({
      data: {
        bugCandidateId: candidate.id,
        mode: 'OPEN_PR',
        status: 'PENDING',
      },
    });

    await prisma.bugCandidate.update({
      where: { id: candidate.id },
      data: { status: 'APPLYING' },
    });

    await executionQueue.add('fix-session', {
      fixSessionId: session.id,
      bugCandidateId: candidate.id,
    });

    logger.info(`PR session created: ${session.id}`);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/candidates/:id/analyze
 * Create a new analysis for a bug candidate
 */
router.post('/candidates/:id/analyze', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysisType } = analyzeSchema.parse(req.body);
    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true },
    });
    if (!candidate) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(candidate.projectId, req.user!.id);

    const analysis = await prisma.investigationAnalysis.create({
      data: {
        bugCandidateId: candidate.id,
        analysisType: analysisType || 'FAILURE_SUMMARY',
        status: 'PENDING',
        createdBy: 'user',
      },
    });

    res.status(201).json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fixes/candidates/:id/analyses
 * List analyses for a bug candidate
 */
router.get('/candidates/:id/analyses', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const candidate = await prisma.bugCandidate.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true },
    });
    if (!candidate) throw NotFoundError('Bug candidate');
    await verifyProjectAccess(candidate.projectId, req.user!.id);

    const analyses = await prisma.investigationAnalysis.findMany({
      where: { bugCandidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: analyses });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// FIX SESSION ROUTES
// =============================================================================

/**
 * GET /fixes/sessions/:id
 * Get fix session detail
 */
router.get('/sessions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      include: {
        bugCandidate: {
          select: { id: true, title: true, projectId: true, project: { select: { orgId: true } } },
        },
        artifacts: { orderBy: { createdAt: 'desc' } },
        verificationRuns: { orderBy: { createdAt: 'desc' } },
        analyses: { orderBy: { createdAt: 'desc' } },
        feedback: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) throw NotFoundError('Fix session');

    const orgIds = await getUserOrgIds(req.user!.id);
    if (!orgIds.includes(session.bugCandidate.project.orgId)) throw ForbiddenError('No access');

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fixes/sessions/:id/artifacts
 * Get artifacts for a fix session
 */
router.get('/sessions/:id/artifacts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    const artifacts = await prisma.fixArtifact.findMany({
      where: { fixSessionId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: artifacts });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fixes/sessions/:id/analyses
 * List analyses for a fix session
 */
router.get('/sessions/:id/analyses', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    const analyses = await prisma.investigationAnalysis.findMany({
      where: { fixSessionId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: analyses });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fixes/sessions/:id/events
 * Get event log for a fix session
 */
router.get('/sessions/:id/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { id: true, eventLog: true, bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    res.json({ success: true, data: session.eventLog || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/sessions/:id/verify
 * Trigger verification for a fix session
 */
router.post('/sessions/:id/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = z.object({ profileId: z.string().cuid().optional() }).parse(req.body);

    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { id: true, bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    const run = await prisma.verificationRun.create({
      data: {
        fixSessionId: session.id,
        profileId,
        status: 'PENDING',
      },
    });

    await prisma.fixSession.update({
      where: { id: session.id },
      data: { status: 'VERIFYING' },
    });

    logger.info(`Verification run created: ${run.id} for session ${session.id}`);
    res.status(201).json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/sessions/:id/dismiss
 * Dismiss a fix session
 */
router.post('/sessions/:id/dismiss', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { id: true, bugCandidateId: true, bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    await prisma.fixSession.update({
      where: { id: session.id },
      data: { status: 'CANCELLED', summary: reason || 'Dismissed by user' },
    });

    res.json({ success: true, data: { message: 'Session dismissed' } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fixes/sessions/:id/feedback
 * Add feedback to a fix session
 */
router.post('/sessions/:id/feedback', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { id: true, bugCandidateId: true, bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    const input = feedbackSchema.parse({
      ...req.body,
      bugCandidateId: session.bugCandidateId,
      fixSessionId: session.id,
    });

    const feedback = await prisma.fixFeedback.create({
      data: {
        bugCandidateId: input.bugCandidateId,
        fixSessionId: input.fixSessionId,
        feedbackType: input.feedbackType,
        comment: input.comment,
        createdByUserId: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fixes/sessions/:id/feedback
 * Get feedback for a fix session
 */
router.get('/sessions/:id/feedback', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.fixSession.findUnique({
      where: { id: req.params.id },
      select: { bugCandidate: { select: { projectId: true } } },
    });
    if (!session) throw NotFoundError('Fix session');
    await verifyProjectAccess(session.bugCandidate.projectId, req.user!.id);

    const feedback = await prisma.fixFeedback.findMany({
      where: { fixSessionId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// FIX STATS
// =============================================================================

/**
 * GET /fixes/stats
 * Get fix statistics for dashboard
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const orgIds = await getUserOrgIds(req.user!.id);

    const baseWhere: any = {
      project: { orgId: { in: orgIds } },
    };
    if (projectId) baseWhere.projectId = projectId as string;

    const [openCandidates, highConfidenceReady, recentFixes, dismissedCandidates, totalCompleted, totalSessions] = await Promise.all([
      prisma.bugCandidate.count({
        where: { ...baseWhere, status: { notIn: ['MERGED', 'DISMISSED'] } },
      }),
      prisma.bugCandidate.count({
        where: { ...baseWhere, status: 'READY', confidenceScore: { gte: 0.8 } },
      }),
      prisma.bugCandidate.count({
        where: {
          ...baseWhere,
          status: 'MERGED',
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.bugCandidate.count({
        where: { ...baseWhere, status: 'DISMISSED' },
      }),
      prisma.fixSession.count({
        where: {
          status: 'COMPLETED',
          bugCandidate: baseWhere,
        },
      }),
      prisma.fixSession.count({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          bugCandidate: baseWhere,
        },
      }),
    ]);

    const autoFixSuccessRate = totalSessions > 0 ? (totalCompleted / totalSessions) * 100 : 0;

    res.json({
      success: true,
      data: {
        openCandidates,
        highConfidenceReady,
        autoFixSuccessRate: Math.round(autoFixSuccessRate),
        meanTimeToVerifiedFix: null,
        recentFixes,
        dismissedCandidates,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
