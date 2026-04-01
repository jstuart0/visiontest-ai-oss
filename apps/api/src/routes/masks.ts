// VisionTest AI - Ignore Masks Routes
// P0 Feature: Reduce false positives by masking dynamic content

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, MaskType } from '@visiontest/database';
import { authenticate, requireProjectAccess } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const rectangleSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
});

const createMaskSchema = z.object({
  projectId: z.string().cuid(),
  testId: z.string().cuid().optional(),
  baselineId: z.string().cuid().optional(),
  type: z.enum(['RECTANGLE', 'SELECTOR', 'XPATH', 'REGEX', 'AI_DETECTED']),
  value: z.union([z.string(), rectangleSchema]),
  reason: z.string().max(500).optional(),
  isGlobal: z.boolean().optional(),
});

const updateMaskSchema = z.object({
  type: z.enum(['RECTANGLE', 'SELECTOR', 'XPATH', 'REGEX', 'AI_DETECTED']).optional(),
  value: z.union([z.string(), rectangleSchema]).optional(),
  reason: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const aiDetectSchema = z.object({
  projectId: z.string().cuid(),
  screenshotUrl: z.string().url(),
  testId: z.string().cuid().optional(),
});

const applyMasksSchema = z.object({
  comparisonId: z.string().cuid(),
  maskIds: z.array(z.string().cuid()),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkMaskAccess(userId: string, maskId: string) {
  const mask = await prisma.ignoreMask.findUnique({
    where: { id: maskId },
    include: {
      project: {
        include: {
          org: {
            include: {
              users: {
                where: { userId },
              },
            },
          },
        },
      },
    },
  });

  if (!mask) {
    throw NotFoundError('Mask');
  }

  if (mask.project && mask.project.org.users.length === 0) {
    throw ForbiddenError('No access to this mask');
  }

  return mask;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /masks
 * List masks for a project/test/baseline
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, testId, baselineId, includeGlobal } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    // Build query
    const where: any = {
      isActive: true,
      OR: [
        { projectId: projectId as string },
      ],
    };

    if (testId) {
      where.OR.push({ testId: testId as string });
    }

    if (baselineId) {
      where.OR.push({ baselineId: baselineId as string });
    }

    if (includeGlobal === 'true') {
      where.OR.push({ isGlobal: true });
    }

    const masks = await prisma.ignoreMask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        test: {
          select: { id: true, name: true },
        },
        baseline: {
          select: { id: true, name: true },
        },
      },
    });

    // Parse rectangle values
    const parsedMasks = masks.map((mask) => ({
      ...mask,
      value: mask.type === 'RECTANGLE' ? JSON.parse(mask.value) : mask.value,
    }));

    res.json({
      success: true,
      data: parsedMasks,
      meta: {
        total: parsedMasks.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /masks
 * Create a new ignore mask
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createMaskSchema.parse(req.body);

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: {
          include: {
            users: {
              where: { userId: req.user!.id },
            },
          },
        },
      },
    });

    if (!project) {
      throw NotFoundError('Project');
    }

    if (project.org.users.length === 0) {
      throw ForbiddenError('No access to this project');
    }

    // Serialize value if rectangle
    const value = typeof input.value === 'object' 
      ? JSON.stringify(input.value) 
      : input.value;

    const mask = await prisma.ignoreMask.create({
      data: {
        projectId: input.projectId,
        testId: input.testId,
        baselineId: input.baselineId,
        type: input.type as MaskType,
        value,
        reason: input.reason,
        isGlobal: input.isGlobal || false,
        createdBy: req.user!.id,
      },
    });

    logger.info(`Mask created: ${mask.id} for project ${input.projectId}`);

    res.status(201).json({
      success: true,
      data: {
        ...mask,
        value: mask.type === 'RECTANGLE' ? JSON.parse(mask.value) : mask.value,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /masks/:maskId
 * Get mask details
 */
router.get('/:maskId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mask = await checkMaskAccess(req.user!.id, req.params.maskId);

    res.json({
      success: true,
      data: {
        ...mask,
        value: mask.type === 'RECTANGLE' ? JSON.parse(mask.value) : mask.value,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /masks/:maskId
 * Update a mask
 */
router.patch('/:maskId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mask = await checkMaskAccess(req.user!.id, req.params.maskId);
    const updates = updateMaskSchema.parse(req.body);

    // Serialize value if rectangle
    const value = updates.value 
      ? (typeof updates.value === 'object' ? JSON.stringify(updates.value) : updates.value)
      : undefined;

    const updated = await prisma.ignoreMask.update({
      where: { id: mask.id },
      data: {
        ...updates,
        value,
      },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        value: updated.type === 'RECTANGLE' ? JSON.parse(updated.value) : updated.value,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /masks/:maskId
 * Delete a mask
 */
router.delete('/:maskId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mask = await checkMaskAccess(req.user!.id, req.params.maskId);

    await prisma.ignoreMask.delete({
      where: { id: mask.id },
    });

    logger.info(`Mask deleted: ${mask.id}`);

    res.json({
      success: true,
      data: { message: 'Mask deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /masks/ai-detect
 * AI auto-detect dynamic regions in a screenshot
 */
router.post('/ai-detect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, screenshotUrl, testId } = aiDetectSchema.parse(req.body);

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: {
          include: {
            users: {
              where: { userId: req.user!.id },
            },
          },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access to this project');
    }

    // Import the masks service for AI detection
    const { masksService } = await import('../services/masks.service');
    const result = await masksService.aiDetect(req.user!.id, projectId, screenshotUrl, testId);

    logger.info(`AI detected ${result.suggestions.length} dynamic regions for project ${projectId}`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /masks/apply
 * Apply masks to a comparison and re-calculate diff
 */
router.post('/apply', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comparisonId, maskIds } = applyMasksSchema.parse(req.body);

    // Get comparison
    const comparison = await prisma.comparison.findUnique({
      where: { id: comparisonId },
      include: {
        execution: {
          include: {
            project: {
              include: {
                org: {
                  include: {
                    users: {
                      where: { userId: req.user!.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!comparison) {
      throw NotFoundError('Comparison');
    }

    if (comparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access to this comparison');
    }

    // Get masks
    const masks = await prisma.ignoreMask.findMany({
      where: { id: { in: maskIds } },
    });

    if (masks.length !== maskIds.length) {
      throw BadRequestError('Some masks not found');
    }

    // Update the comparison record with masks
    const updated = await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        masksApplied: masks.length,
        status: 'PENDING', // Reset to pending for re-processing
        metadata: {
          ...(comparison.metadata as any || {}),
          appliedMaskIds: maskIds,
          reprocessedAt: new Date().toISOString(),
          maskDetails: masks.map(m => ({
            id: m.id,
            type: m.type,
            value: m.value,
          })),
        },
      },
    });

    // Queue re-comparison job with masks
    const { queueRecomparison } = await import('../lib/queue');
    await queueRecomparison({
      comparisonId,
      executionId: comparison.executionId,
      baselineId: comparison.baselineId,
      screenshotId: comparison.screenshotId || undefined,
      maskIds,
    });

    logger.info(`Applied ${masks.length} masks to comparison ${comparisonId}, queued for re-processing`);

    res.json({
      success: true,
      data: {
        comparison: updated,
        masksApplied: masks.length,
        message: 'Masks applied. Re-processing comparison...',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /masks/bulk
 * Create multiple masks at once
 */
router.post('/bulk', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, masks } = z.object({
      projectId: z.string().cuid(),
      masks: z.array(z.object({
        type: z.enum(['RECTANGLE', 'SELECTOR', 'XPATH', 'REGEX', 'AI_DETECTED']),
        value: z.union([z.string(), rectangleSchema]),
        reason: z.string().max(500).optional(),
        testId: z.string().cuid().optional(),
        baselineId: z.string().cuid().optional(),
      })),
    }).parse(req.body);

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: {
          include: {
            users: {
              where: { userId: req.user!.id },
            },
          },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access to this project');
    }

    // Create all masks
    const created = await prisma.ignoreMask.createMany({
      data: masks.map((m) => ({
        projectId,
        testId: m.testId,
        baselineId: m.baselineId,
        type: m.type as MaskType,
        value: typeof m.value === 'object' ? JSON.stringify(m.value) : m.value,
        reason: m.reason,
        createdBy: req.user!.id,
      })),
    });

    logger.info(`Created ${created.count} masks in bulk for project ${projectId}`);

    res.status(201).json({
      success: true,
      data: {
        count: created.count,
        message: `Created ${created.count} masks`,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
