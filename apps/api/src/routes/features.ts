// VisionTest.ai — Features (Phase 1c)
//
// CRUD for the Feature grouping that shares setup + context across
// related scenarios. Implementation deliberately minimal — the web UI
// treats Features as a soft grouping, not a rigid workflow.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../middleware/error';

const router = Router();

async function checkProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { users: { where: { userId } } } } },
  });
  if (!project) throw NotFoundError('Project');
  if (project.org.users.length === 0) throw ForbiddenError('No access');
  return project;
}

const createSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sharedSetup: z.string().max(5000).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  sharedSetup: z.string().max(5000).nullable().optional(),
});

// GET /features?projectId=…
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = z.string().cuid().parse(req.query.projectId);
    await checkProjectAccess(req.user!.id, projectId);
    const features = await prisma.feature.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { tests: true } } },
    });
    res.json({ success: true, data: { features } });
  } catch (error) {
    next(error);
  }
});

// POST /features
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    await checkProjectAccess(req.user!.id, body.projectId);
    const feature = await prisma.feature.create({ data: body });
    res.status(201).json({ success: true, data: feature });
  } catch (error) {
    next(error);
  }
});

// GET /features/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feature = await prisma.feature.findUnique({
      where: { id: req.params.id },
      include: {
        tests: {
          select: { id: true, name: true, status: true, goal: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!feature) throw NotFoundError('Feature');
    await checkProjectAccess(req.user!.id, feature.projectId);
    res.json({ success: true, data: feature });
  } catch (error) {
    next(error);
  }
});

// PATCH /features/:id
router.patch('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feature = await prisma.feature.findUnique({ where: { id: req.params.id } });
    if (!feature) throw NotFoundError('Feature');
    await checkProjectAccess(req.user!.id, feature.projectId);
    const updates = updateSchema.parse(req.body);
    const updated = await prisma.feature.update({ where: { id: feature.id }, data: updates });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /features/:id — clears featureId on attached tests (SetNull)
router.delete('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feature = await prisma.feature.findUnique({ where: { id: req.params.id } });
    if (!feature) throw NotFoundError('Feature');
    await checkProjectAccess(req.user!.id, feature.projectId);
    await prisma.feature.delete({ where: { id: feature.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
