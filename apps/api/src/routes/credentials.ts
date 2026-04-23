// VisionTest.ai — Credentials (Phase 1c)
//
// Strict org-scoped CRUD. The encrypted blob is NEVER returned in
// responses — UI only works with metadata (key, scope, env, version).

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { ForbiddenError, NotFoundError } from '../middleware/error';
import {
  createCredential,
  rotateCredential,
  deleteCredential,
  listCredentials,
} from '../services/credentials.service';

const router = Router();

async function checkOrgAccess(userId: string, orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { users: { where: { userId } } },
  });
  if (!org) throw NotFoundError('Organization');
  if (org.users.length === 0) throw ForbiddenError('No access');
}

const createSchema = z.object({
  orgId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i, 'key must be alphanumeric / dash / underscore'),
  environment: z.string().max(100).optional(),
  blob: z.record(z.string()),
  allowEnvironmentFallback: z.boolean().optional(),
});

const updateSchema = z.object({
  blob: z.record(z.string()).optional(),
  allowEnvironmentFallback: z.boolean().optional(),
});

// GET /credentials?orgId=…&projectId=…
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = z.string().cuid().parse(req.query.orgId);
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    await checkOrgAccess(req.user!.id, orgId);
    const creds = await listCredentials({ orgId, projectId });
    res.json({ success: true, data: { credentials: creds } });
  } catch (error) {
    next(error);
  }
});

// POST /credentials
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    await checkOrgAccess(req.user!.id, body.orgId);
    const cred = await createCredential(body);
    res.status(201).json({ success: true, data: cred });
  } catch (error) {
    next(error);
  }
});

// PATCH /credentials/:id — rotate or flip allowEnvironmentFallback
router.patch('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cred = await prisma.credential.findUnique({ where: { id: req.params.id } });
    if (!cred) throw NotFoundError('Credential');
    await checkOrgAccess(req.user!.id, cred.orgId);
    const updates = updateSchema.parse(req.body);
    const updated = await rotateCredential(cred.id, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /credentials/:id — blocked if any test references the key
router.delete('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cred = await prisma.credential.findUnique({ where: { id: req.params.id } });
    if (!cred) throw NotFoundError('Credential');
    await checkOrgAccess(req.user!.id, cred.orgId);
    await deleteCredential(cred.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
