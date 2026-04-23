// VisionTest.ai — Template Routes (Phase 1b)
//
// Exposes the built-in story templates the /tests/new editor shows as
// one-click scaffolds. Deliberately unauthenticated at the list level so
// the anonymous-sandbox flow in Phase 4 can offer starters without a
// logged-in user.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { listTemplates, incrementUsage } from '../services/templates.service';

const router = Router();

/**
 * GET /templates
 *
 * Returns every template — built-in + community. No auth required so the
 * anonymous-sandbox home page can render starter chips before the
 * visitor signs up.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await listTemplates();
    res.json({ success: true, data: { templates } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /templates/:slug/pick
 *
 * Bump usage count when the user picks a template. Authenticated because
 * we only want real users (not crawlers) influencing the ranking.
 */
const pickSchema = z.object({ projectId: z.string().cuid().optional() });

router.post(
  '/:slug/pick',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      pickSchema.parse(req.body);
      await incrementUsage(req.params.slug);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
