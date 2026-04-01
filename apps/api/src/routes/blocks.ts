// VisionTest AI - Task Block Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createBlockSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.string().min(1).max(50),
  config: z.record(z.unknown()).optional(),
  isTemplate: z.boolean().optional(),
});

const updateBlockSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.string().min(1).max(50).optional(),
  config: z.record(z.unknown()).optional(),
  isTemplate: z.boolean().optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: {
        include: {
          users: { where: { userId } },
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

  return { project, role: project.org.users[0].role };
}

async function checkBlockAccess(userId: string, blockId: string) {
  const block = await prisma.taskBlock.findUnique({
    where: { id: blockId },
    include: {
      project: {
        include: {
          org: {
            include: {
              users: { where: { userId } },
            },
          },
        },
      },
    },
  });

  if (!block) {
    throw NotFoundError('Task block');
  }

  if (block.project.org.users.length === 0) {
    throw ForbiddenError('No access to this task block');
  }

  return { block, role: block.project.org.users[0].role };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /blocks
 * List task blocks for a project (includes templates)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, type, isTemplate } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    await checkProjectAccess(req.user!.id, projectId as string);

    const where: any = { projectId: projectId as string };

    if (type) {
      where.type = type as string;
    }

    if (isTemplate !== undefined) {
      where.isTemplate = isTemplate === 'true';
    }

    const blocks = await prisma.taskBlock.findMany({
      where,
      include: {
        _count: { select: { workflowSteps: true } },
      },
      orderBy: [
        { isTemplate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: blocks.map((b) => ({
        ...b,
        usageCount: b._count.workflowSteps,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /blocks
 * Create a new task block
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createBlockSchema.parse(req.body);

    await checkProjectAccess(req.user!.id, input.projectId);

    const block = await prisma.taskBlock.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        type: input.type,
        config: (input.config || {}) as Prisma.InputJsonValue,
        isTemplate: input.isTemplate ?? false,
      },
    });

    logger.info(`Task block created: ${block.id} for project ${input.projectId}`);

    res.status(201).json({
      success: true,
      data: block,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /blocks/:id
 * Update task block
 */
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { block } = await checkBlockAccess(req.user!.id, req.params.id);

    const updates = updateBlockSchema.parse(req.body);

    const updated = await prisma.taskBlock.update({
      where: { id: block.id },
      data: {
        name: updates.name,
        description: updates.description,
        type: updates.type,
        config: updates.config ? (updates.config as Prisma.InputJsonValue) : undefined,
        isTemplate: updates.isTemplate,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /blocks/:id
 * Delete task block
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { block, role } = await checkBlockAccess(req.user!.id, req.params.id);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required');
    }

    // Check if block is used in any workflow steps
    const usageCount = await prisma.workflowStep.count({
      where: { blockId: block.id },
    });

    if (usageCount > 0) {
      throw BadRequestError(
        `Cannot delete block: it is used in ${usageCount} workflow step(s). Remove it from workflows first.`
      );
    }

    await prisma.taskBlock.delete({
      where: { id: block.id },
    });

    logger.info(`Task block deleted: ${block.id}`);

    res.json({
      success: true,
      data: { message: 'Task block deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
