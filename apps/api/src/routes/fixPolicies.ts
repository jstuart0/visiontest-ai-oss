// VisionTest AI - Fix Policy Routes
// Manages policy constraints for automated fixing

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

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

const createPolicySchema = z.object({
  projectId: z.string().cuid(),
  repoConnectionId: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  mode: z.enum(['MANUAL', 'GUIDED', 'SEMI_AUTO', 'FULLY_AUTO']).optional(),
  maxFilesChanged: z.number().int().min(1).max(50).optional(),
  maxLinesChanged: z.number().int().min(1).max(5000).optional(),
  allowedPaths: z.array(z.string()).optional(),
  blockedPaths: z.array(z.string()).optional(),
  allowDependencyChanges: z.boolean().optional(),
  allowLockfileChanges: z.boolean().optional(),
  allowMigrationChanges: z.boolean().optional(),
  requireHumanApproval: z.boolean().optional(),
  branchPrefix: z.string().optional(),
  prTemplate: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updatePolicySchema = createPolicySchema.partial().omit({ projectId: true }).extend({
  isActive: z.boolean().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /fix-policies
 * List fix policies for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId is required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const policies = await prisma.fixPolicy.findMany({
      where: { projectId: projectId as string },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: {
        repoConnection: { select: { id: true, repoUrl: true, provider: true } },
      },
    });

    res.json({ success: true, data: policies });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fix-policies
 * Create a fix policy
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPolicySchema.parse(req.body);
    await verifyProjectAccess(input.projectId, req.user!.id);

    // If this is set as default, unset other defaults
    if (input.isDefault) {
      await prisma.fixPolicy.updateMany({
        where: { projectId: input.projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.fixPolicy.create({
      data: {
        projectId: input.projectId,
        repoConnectionId: input.repoConnectionId,
        name: input.name,
        mode: input.mode || 'GUIDED',
        maxFilesChanged: input.maxFilesChanged || 5,
        maxLinesChanged: input.maxLinesChanged || 200,
        allowedPaths: input.allowedPaths || [],
        blockedPaths: input.blockedPaths || [],
        allowDependencyChanges: input.allowDependencyChanges ?? false,
        allowLockfileChanges: input.allowLockfileChanges ?? false,
        allowMigrationChanges: input.allowMigrationChanges ?? false,
        requireHumanApproval: input.requireHumanApproval ?? true,
        branchPrefix: input.branchPrefix || 'visiontest/fix',
        prTemplate: input.prTemplate,
        isDefault: input.isDefault ?? false,
      },
    });

    logger.info(`Fix policy created: ${policy.id}`);
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /fix-policies/:id
 * Update a fix policy
 */
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updatePolicySchema.parse(req.body);
    const policy = await prisma.fixPolicy.findUnique({ where: { id: req.params.id } });
    if (!policy) throw NotFoundError('Fix policy');
    await verifyProjectAccess(policy.projectId, req.user!.id);

    if (input.isDefault) {
      await prisma.fixPolicy.updateMany({
        where: { projectId: policy.projectId, isDefault: true, id: { not: policy.id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.fixPolicy.update({
      where: { id: policy.id },
      data: input,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /fix-policies/:id
 * Delete a fix policy
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await prisma.fixPolicy.findUnique({ where: { id: req.params.id } });
    if (!policy) throw NotFoundError('Fix policy');
    await verifyProjectAccess(policy.projectId, req.user!.id);

    await prisma.fixPolicy.delete({ where: { id: policy.id } });
    logger.info(`Fix policy deleted: ${policy.id}`);
    res.json({ success: true, data: { message: 'Fix policy deleted' } });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// VERIFICATION PROFILES
// =============================================================================

const createProfileSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  preset: z.enum(['fast', 'balanced', 'strict', 'custom']).optional(),
  commands: z.array(z.object({
    name: z.string(),
    command: z.string(),
    timeout: z.number().optional(),
    required: z.boolean().optional(),
  })),
  targetingStrategy: z.string().optional(),
  maxRuntimeSeconds: z.number().int().min(30).max(3600).optional(),
  failurePolicy: z.string().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /fix-policies/verification-profiles
 * List verification profiles for a project
 */
router.get('/verification-profiles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId is required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const profiles = await prisma.verificationProfile.findMany({
      where: { projectId: projectId as string },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: profiles });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fix-policies/verification-profiles
 * Create a verification profile
 */
router.post('/verification-profiles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createProfileSchema.parse(req.body);
    await verifyProjectAccess(input.projectId, req.user!.id);

    if (input.isDefault) {
      await prisma.verificationProfile.updateMany({
        where: { projectId: input.projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.verificationProfile.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        preset: input.preset || 'balanced',
        commands: input.commands,
        targetingStrategy: input.targetingStrategy || 'affected',
        maxRuntimeSeconds: input.maxRuntimeSeconds || 300,
        failurePolicy: input.failurePolicy || 'fail_closed',
        isDefault: input.isDefault ?? false,
      },
    });

    logger.info(`Verification profile created: ${profile.id}`);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /fix-policies/verification-profiles/:id
 * Delete a verification profile
 */
router.delete('/verification-profiles/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.verificationProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) throw NotFoundError('Verification profile');
    await verifyProjectAccess(profile.projectId, req.user!.id);

    await prisma.verificationProfile.delete({ where: { id: profile.id } });
    logger.info(`Verification profile deleted: ${profile.id}`);
    res.json({ success: true, data: { message: 'Verification profile deleted' } });
  } catch (error) {
    next(error);
  }
});

export default router;
