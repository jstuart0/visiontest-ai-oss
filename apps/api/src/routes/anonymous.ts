// VisionTest.ai — Anonymous Sandbox Routes (Phase 4)
//
// POST /anon/session  — provision a new sandbox (unauth)
// GET  /anon/session  — resolve the current sandbox from cookie (unauth)
// POST /anon/upgrade  — sign up and atomically migrate the sandbox
// POST /anon/smoke-explore — kick off a Smoke Explore scan (unauth,
//   narrow 1-page/5-click/read-only — plan §10 decision #9)

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@visiontest/database';
import {
  anonymousSessionsEnabled,
  createAnonymousSession,
  touchAnonymousSession,
  upgradeAnonymousSession,
} from '../services/anonymousSession.service';
import { generateToken } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { queueScan } from '../lib/queue';
import { BadRequestError } from '../middleware/error';

const router = Router();
const ANON_COOKIE = 'vt_anon_session';

function disabledError(res: Response) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'ANONYMOUS_DISABLED',
      message:
        'Anonymous sessions are disabled on this deployment. Sign up to use VisionTest.',
    },
  });
}

// ------------------------------------------------------------------------
// POST /anon/session — issue a fresh sandbox
// ------------------------------------------------------------------------
router.post(
  '/session',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!anonymousSessionsEnabled()) {
        disabledError(res);
        return;
      }
      const session = await createAnonymousSession();
      res.cookie(ANON_COOKIE, session.anonSessionCookie, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: session.expiresAt,
      });
      res.status(201).json({
        success: true,
        data: {
          userId: session.userId,
          orgId: session.orgId,
          projectId: session.projectId,
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ------------------------------------------------------------------------
// GET /anon/session — resolve (and refresh) the current sandbox cookie
// ------------------------------------------------------------------------
router.get(
  '/session',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!anonymousSessionsEnabled()) {
        disabledError(res);
        return;
      }
      const cookie = req.cookies?.[ANON_COOKIE];
      if (!cookie) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No anonymous session' },
        });
        return;
      }
      const s = await touchAnonymousSession(cookie);
      if (!s) {
        res.clearCookie(ANON_COOKIE);
        res.status(404).json({
          success: false,
          error: { code: 'EXPIRED', message: 'Anonymous session expired' },
        });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: s.userId } });
      const accessToken = generateToken(s.userId, user!.email, 'access');
      res.json({
        success: true,
        data: {
          userId: s.userId,
          orgId: s.orgId,
          projectId: s.projectId,
          accessToken,
          expiresAt: s.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ------------------------------------------------------------------------
// POST /anon/upgrade — atomic sign-up migration
// ------------------------------------------------------------------------
const upgradeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200).optional(),
  orgName: z.string().max(200).optional(),
});

router.post(
  '/upgrade',
  mutationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!anonymousSessionsEnabled()) {
        disabledError(res);
        return;
      }
      const cookie = req.cookies?.[ANON_COOKIE];
      if (!cookie) {
        throw BadRequestError('No anonymous session cookie to upgrade');
      }
      const body = upgradeSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(body.password, 10);
      const { userId } = await upgradeAnonymousSession({
        anonSessionCookie: cookie,
        email: body.email,
        passwordHash,
        name: body.name,
        orgName: body.orgName,
      });
      res.clearCookie(ANON_COOKIE);
      const accessToken = generateToken(userId, body.email, 'access');
      const refreshToken = generateToken(userId, body.email, 'refresh');
      res.json({
        success: true,
        data: {
          userId,
          accessToken,
          refreshToken,
          message:
            'Your sandbox has been migrated. Same project, same tests, but now under your account.',
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ------------------------------------------------------------------------
// POST /anon/smoke-explore — Smoke Explore for anonymous visitors.
// Narrow by design: 1 page, 5 interactions, read-only forced.
// ------------------------------------------------------------------------
const smokeSchema = z.object({ startUrl: z.string().url() });

router.post(
  '/smoke-explore',
  mutationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!anonymousSessionsEnabled()) {
        disabledError(res);
        return;
      }
      const body = smokeSchema.parse(req.body);

      let anonCookie = req.cookies?.[ANON_COOKIE];
      let projectId: string;

      if (anonCookie) {
        const s = await touchAnonymousSession(anonCookie);
        if (!s) {
          // Expired — issue a fresh session
          const fresh = await createAnonymousSession();
          anonCookie = fresh.anonSessionCookie;
          projectId = fresh.projectId;
          res.cookie(ANON_COOKIE, anonCookie, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            expires: fresh.expiresAt,
          });
        } else {
          projectId = s.projectId;
        }
      } else {
        const fresh = await createAnonymousSession();
        anonCookie = fresh.anonSessionCookie;
        projectId = fresh.projectId;
        res.cookie(ANON_COOKIE, anonCookie, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          expires: fresh.expiresAt,
        });
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
        data: {
          executionId: execution.id,
          projectId,
          tier: 'smoke',
          message: 'Smoke Explore queued. Sign up to unlock full scan.',
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
