// VisionTest.ai - Workflow Routes

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

const createWorkflowSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

const addStepSchema = z.object({
  blockId: z.string().cuid().optional(),
  order: z.number().int().min(0),
  config: z.record(z.unknown()).optional(),
});

const updateStepSchema = z.object({
  blockId: z.string().cuid().optional().nullable(),
  order: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).optional(),
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

async function checkWorkflowAccess(userId: string, workflowId: string) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
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

  if (!workflow) {
    throw NotFoundError('Workflow');
  }

  if (workflow.project.org.users.length === 0) {
    throw ForbiddenError('No access to this workflow');
  }

  return { workflow, role: workflow.project.org.users[0].role };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /workflows
 * List workflows for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    await checkProjectAccess(req.user!.id, projectId as string);

    const workflows = await prisma.workflow.findMany({
      where: { projectId: projectId as string },
      include: {
        _count: { select: { steps: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: workflows.map((w) => ({
        ...w,
        stepCount: w._count.steps,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workflows
 * Create a new workflow
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWorkflowSchema.parse(req.body);

    await checkProjectAccess(req.user!.id, input.projectId);

    const workflow = await prisma.workflow.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
      },
    });

    logger.info(`Workflow created: ${workflow.id} for project ${input.projectId}`);

    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /workflows/:id
 * Get workflow with steps
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = await checkWorkflowAccess(req.user!.id, req.params.id);

    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: {
        steps: {
          include: {
            block: { select: { id: true, name: true, type: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json({
      success: true,
      data: fullWorkflow,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /workflows/:id
 * Update workflow
 */
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = await checkWorkflowAccess(req.user!.id, req.params.id);

    const updates = updateWorkflowSchema.parse(req.body);

    const updated = await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        name: updates.name,
        description: updates.description,
        isActive: updates.isActive,
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
 * DELETE /workflows/:id
 * Delete workflow
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow, role } = await checkWorkflowAccess(req.user!.id, req.params.id);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required');
    }

    await prisma.workflow.delete({
      where: { id: workflow.id },
    });

    logger.info(`Workflow deleted: ${workflow.id}`);

    res.json({
      success: true,
      data: { message: 'Workflow deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workflows/:id/steps
 * Add step to workflow
 */
router.post('/:id/steps', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = await checkWorkflowAccess(req.user!.id, req.params.id);

    const input = addStepSchema.parse(req.body);

    // Validate blockId if provided
    if (input.blockId) {
      const block = await prisma.taskBlock.findFirst({
        where: { id: input.blockId, projectId: workflow.projectId },
      });
      if (!block) {
        throw BadRequestError('Task block not found in this project');
      }
    }

    // Check for order conflict
    const existingStep = await prisma.workflowStep.findUnique({
      where: {
        workflowId_order: { workflowId: workflow.id, order: input.order },
      },
    });

    if (existingStep) {
      // Shift existing steps up
      await prisma.workflowStep.updateMany({
        where: {
          workflowId: workflow.id,
          order: { gte: input.order },
        },
        data: {
          order: { increment: 1 },
        },
      });
    }

    const step = await prisma.workflowStep.create({
      data: {
        workflowId: workflow.id,
        blockId: input.blockId,
        order: input.order,
        config: (input.config || {}) as Prisma.InputJsonValue,
      },
      include: {
        block: { select: { id: true, name: true, type: true } },
      },
    });

    logger.info(`Step added to workflow ${workflow.id}: order ${input.order}`);

    res.status(201).json({
      success: true,
      data: step,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /workflows/:id/steps/:stepId
 * Update workflow step
 */
router.put('/:id/steps/:stepId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = await checkWorkflowAccess(req.user!.id, req.params.id);

    const step = await prisma.workflowStep.findFirst({
      where: { id: req.params.stepId, workflowId: workflow.id },
    });

    if (!step) {
      throw NotFoundError('Workflow step');
    }

    const updates = updateStepSchema.parse(req.body);

    // Validate blockId if provided
    if (updates.blockId) {
      const block = await prisma.taskBlock.findFirst({
        where: { id: updates.blockId, projectId: workflow.projectId },
      });
      if (!block) {
        throw BadRequestError('Task block not found in this project');
      }
    }

    const updated = await prisma.workflowStep.update({
      where: { id: step.id },
      data: {
        blockId: updates.blockId !== undefined ? updates.blockId : undefined,
        order: updates.order,
        config: updates.config ? (updates.config as Prisma.InputJsonValue) : undefined,
      },
      include: {
        block: { select: { id: true, name: true, type: true } },
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
 * DELETE /workflows/:id/steps/:stepId
 * Delete workflow step
 */
router.delete('/:id/steps/:stepId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = await checkWorkflowAccess(req.user!.id, req.params.id);

    const step = await prisma.workflowStep.findFirst({
      where: { id: req.params.stepId, workflowId: workflow.id },
    });

    if (!step) {
      throw NotFoundError('Workflow step');
    }

    await prisma.workflowStep.delete({
      where: { id: step.id },
    });

    // Re-order remaining steps
    const remainingSteps = await prisma.workflowStep.findMany({
      where: { workflowId: workflow.id },
      orderBy: { order: 'asc' },
    });

    for (let i = 0; i < remainingSteps.length; i++) {
      if (remainingSteps[i].order !== i) {
        await prisma.workflowStep.update({
          where: { id: remainingSteps[i].id },
          data: { order: i },
        });
      }
    }

    logger.info(`Step ${req.params.stepId} deleted from workflow ${workflow.id}`);

    res.json({
      success: true,
      data: { message: 'Workflow step deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workflows/:id/run
 * Run a workflow -- creates an execution for each step's associated test
 */
router.post('/:id/run', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = await checkWorkflowAccess(req.user!.id, req.params.id);
    const project = workflow.project;

    // Get workflow with steps and their blocks
    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { block: true },
        },
      },
    });

    if (!fullWorkflow || fullWorkflow.steps.length === 0) {
      throw BadRequestError('Workflow has no steps to execute');
    }

    // Create a parent execution to track the workflow run
    const execution = await prisma.execution.create({
      data: {
        projectId: project.id,
        status: 'PENDING',
        triggeredBy: 'MANUAL',
        triggerRef: `workflow:${workflow.id}`,
        metadata: {
          workflowId: workflow.id,
          workflowName: workflow.name,
          stepCount: fullWorkflow.steps.length,
          blocks: fullWorkflow.steps.map((s) => ({
            order: s.order,
            blockId: s.blockId,
            blockName: s.block?.name,
            blockType: s.block?.type,
            config: s.config,
          })),
        },
      },
    });

    // Queue the execution
    const { queueExecution } = await import('../lib/queue');
    await queueExecution({
      executionId: execution.id,
      projectId: project.id,
      config: {
        workflowId: workflow.id,
        steps: fullWorkflow.steps.map((s) => ({
          blockId: s.blockId,
          config: s.config,
        })),
      },
    });

    logger.info(`Workflow ${workflow.id} (${workflow.name}) run started, execution ${execution.id}`);

    return res.status(201).json({
      success: true,
      data: {
        executionId: execution.id,
        workflowId: workflow.id,
        status: 'PENDING',
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
