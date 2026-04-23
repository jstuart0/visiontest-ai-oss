// VisionTest.ai — Exploratory Scan (Phase 2)
//
// Two endpoints:
//   - POST /tests/:id/scan     (authenticated, full multi-page scan)
//   - POST /scans/smoke        (anonymous-allowed, 1 page, 5 interactions)
//   - GET  /executions/:id/nodes (tree render)
//
// The anonymous vs. authenticated split is the plan §10 decision #9:
// smoke-explore only for anon; full scan gated on a real user account.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../middleware/error';
import { queueScan } from '../lib/queue';
import { logger } from '../utils/logger';

const router = Router();

const scanSchema = z.object({
  startUrl: z.string().url(),
  maxPages: z.number().int().min(1).max(200).optional(),
  maxClicksPerPage: z.number().int().min(1).max(100).optional(),
  loginSteps: z.array(z.any()).optional(),
  safety: z
    .object({
      mode: z.enum(['read-only', 'allow-destructive', 'sandbox']).optional(),
      destructivePhrases: z.array(z.string()).optional(),
      allowedSelectors: z.array(z.string()).optional(),
      blockedSelectors: z.array(z.string()).optional(),
      allowFormSubmit: z.boolean().optional(),
      stubNetworkWrites: z.boolean().optional(),
      resetHookUrl: z.string().url().nullable().optional(),
    })
    .optional(),
});

/**
 * POST /projects/:projectId/scan
 *
 * Full exploratory scan — multi-page, auth-aware, safety-mode configurable.
 * Authenticated only. Anonymous sessions get 403 ANONYMOUS_SCAN_DISALLOWED.
 */
router.post(
  '/projects/:projectId/scan',
  authenticate,
  mutationLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { org: { include: { users: { where: { userId: req.user!.id } } } } },
      });
      if (!project) throw NotFoundError('Project');
      if (project.org.users.length === 0) {
        throw ForbiddenError('No access to this project');
      }

      // Anonymous sessions are disallowed here — the dedicated
      // /scans/smoke endpoint is the only exploratory surface for them.
      if ((req.user as any)?.isAnonymous) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ANONYMOUS_SCAN_DISALLOWED',
            message:
              'Full scan requires a registered account. Use /scans/smoke for a one-page read-only probe, or sign up to unlock multi-page scanning.',
          },
        });
        return;
      }

      const body = scanSchema.parse(req.body);

      const execution = await prisma.execution.create({
        data: {
          projectId,
          triggeredBy: 'MANUAL',
          platform: 'WEB',
          status: 'QUEUED',
          mode: 'EXPLORE',
        },
      });

      await queueScan({
        executionId: execution.id,
        projectId,
        startUrl: body.startUrl,
        maxPages: body.maxPages,
        maxClicksPerPage: body.maxClicksPerPage,
        loginSteps: body.loginSteps,
        safety: body.safety,
      });

      res.status(202).json({
        success: true,
        data: { executionId: execution.id, status: 'QUEUED' },
      });
      return;
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /scans/smoke
 *
 * Anonymous-allowed "Smoke Explore" — 1 page, 5 clicks cap, read-only
 * safety forced, no loginSteps. Backed by a scratch project scoped to
 * the anonymous session. See plan §10 decision #9.
 */
const smokeSchema = z.object({
  projectId: z.string().cuid().optional(),
  startUrl: z.string().url(),
});

router.post(
  '/scans/smoke',
  authenticate, // accepts anonymous sessions (once Phase 4 lands); auth for now
  mutationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = smokeSchema.parse(req.body);
      let projectId = body.projectId;
      if (!projectId) {
        throw BadRequestError(
          'projectId is required until anonymous sandbox (Phase 4) ships',
        );
      }

      const execution = await prisma.execution.create({
        data: {
          projectId,
          triggeredBy: 'MANUAL',
          platform: 'WEB',
          status: 'QUEUED',
          mode: 'EXPLORE',
        },
      });

      await queueScan({
        executionId: execution.id,
        projectId,
        startUrl: body.startUrl,
        maxPages: 1,
        maxClicksPerPage: 5,
        safety: { mode: 'read-only' },
      });

      res.status(202).json({
        success: true,
        data: { executionId: execution.id, status: 'QUEUED', tier: 'smoke' },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /executions/:id/nodes
 *
 * Return the ExploreNode tree for a given execution. Rendered by the
 * scan result page as a collapsible tree with per-node screenshots.
 */
router.get(
  '/executions/:id/nodes',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: req.params.id },
        include: {
          project: {
            include: {
              org: { include: { users: { where: { userId: req.user!.id } } } },
            },
          },
        },
      });
      if (!execution) throw NotFoundError('Execution');
      if (execution.project.org.users.length === 0) {
        throw ForbiddenError('No access');
      }

      const nodes = await prisma.exploreNode.findMany({
        where: { executionId: execution.id },
        orderBy: [{ parentId: 'asc' }, { orderIndex: 'asc' }],
      });

      res.json({
        success: true,
        data: {
          executionId: execution.id,
          status: execution.status,
          mode: execution.mode,
          summary: execution.exploreSummary,
          nodes,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
