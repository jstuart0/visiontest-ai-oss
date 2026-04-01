// VisionTest.ai - Fix Runner Routes
// Manages fix execution runners (managed, self-hosted, local)

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationUser.findMany({
    where: { userId },
    select: { orgId: true },
  });
  return memberships.map((m) => m.orgId);
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const registerRunnerSchema = z.object({
  projectId: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  type: z.enum(['MANAGED', 'SELF_HOSTED', 'LOCAL']).optional(),
  version: z.string().optional(),
  protocolVersion: z.string().optional(),
  capabilities: z.object({
    languages: z.array(z.string()).optional(),
    toolchains: z.array(z.string()).optional(),
    browsers: z.array(z.string()).optional(),
    networkAccess: z.boolean().optional(),
    maxWorkspaceSize: z.number().optional(),
    maxRuntimeBudget: z.number().optional(),
  }).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /fix-runners
 * List fix runners
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const orgIds = await getUserOrgIds(req.user!.id);

    const where: any = {};
    if (projectId) {
      where.projectId = projectId as string;
    } else {
      where.OR = [
        { projectId: null },
        { project: { orgId: { in: orgIds } } },
      ];
    }

    const runners = await prisma.fixRunner.findMany({
      where,
      orderBy: [{ status: 'asc' }, { lastHeartbeatAt: 'desc' }],
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: runners });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fix-runners/register
 * Register a new fix runner
 */
router.post('/register', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerRunnerSchema.parse(req.body);

    const runner = await prisma.fixRunner.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        type: input.type || 'SELF_HOSTED',
        version: input.version,
        protocolVersion: input.protocolVersion,
        capabilities: input.capabilities || {},
        status: 'STARTING',
        registeredAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });

    logger.info(`Fix runner registered: ${runner.id} (${input.name})`);
    res.status(201).json({ success: true, data: runner });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /fix-runners/:id
 * Get runner detail
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runner = await prisma.fixRunner.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
    if (!runner) throw NotFoundError('Fix runner');

    res.json({ success: true, data: runner });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fix-runners/:id/heartbeat
 * Runner heartbeat to report status
 */
router.post('/:id/heartbeat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, capabilities } = z.object({
      status: z.enum(['READY', 'BUSY', 'DEGRADED', 'DRAINING']).optional(),
      capabilities: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const runner = await prisma.fixRunner.findUnique({ where: { id: req.params.id } });
    if (!runner) throw NotFoundError('Fix runner');

    const data: any = { lastHeartbeatAt: new Date() };
    if (status) data.status = status;
    if (capabilities) data.capabilities = capabilities;

    const updated = await prisma.fixRunner.update({
      where: { id: runner.id },
      data,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fix-runners/:id/drain
 * Put runner in draining mode
 */
router.post('/:id/drain', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runner = await prisma.fixRunner.findUnique({ where: { id: req.params.id } });
    if (!runner) throw NotFoundError('Fix runner');

    const updated = await prisma.fixRunner.update({
      where: { id: runner.id },
      data: { status: 'DRAINING' },
    });

    logger.info(`Fix runner draining: ${runner.id}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /fix-runners/:id
 * Deregister a fix runner
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runner = await prisma.fixRunner.findUnique({ where: { id: req.params.id } });
    if (!runner) throw NotFoundError('Fix runner');

    await prisma.fixRunner.delete({ where: { id: runner.id } });

    logger.info(`Fix runner deregistered: ${runner.id}`);
    res.json({ success: true, data: { message: 'Runner deregistered' } });
  } catch (error) {
    next(error);
  }
});

export default router;
