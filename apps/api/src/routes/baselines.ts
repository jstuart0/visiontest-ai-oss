// VisionTest.ai - Baseline Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, BaselineType, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const screenshotSchema = z.object({
  name: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  deviceType: z.string().optional(),
});

const createBaselineSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  branch: z.string().optional(),
  type: z.enum(['PROJECT', 'BRANCH', 'ENVIRONMENT', 'DYNAMIC']).optional(),
  screenshots: z.array(screenshotSchema),
});

const updateBaselineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  screenshots: z.array(screenshotSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /baselines
 * List baselines for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, branch } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const where: any = { projectId: projectId as string };
    if (branch) where.branch = branch as string;

    const baselines = await prisma.baseline.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { comparisons: true, ignoreMasks: true } },
      },
    });

    res.json({
      success: true,
      data: baselines.map((b) => ({
        ...b,
        screenshots: JSON.parse(b.screenshots as string),
        comparisonCount: b._count.comparisons,
        maskCount: b._count.ignoreMasks,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /baselines
 * Create a new baseline
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createBaselineSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Check for existing baseline with same name/branch
    const existing = await prisma.baseline.findUnique({
      where: {
        projectId_name_branch: {
          projectId: input.projectId,
          name: input.name,
          branch: input.branch || 'main',
        },
      },
    });

    if (existing) {
      throw BadRequestError('Baseline with this name and branch already exists');
    }

    const baseline = await prisma.baseline.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        branch: input.branch || 'main',
        type: (input.type as BaselineType) || 'PROJECT',
        screenshots: JSON.stringify(input.screenshots),
      },
    });

    logger.info(`Baseline created: ${baseline.id}`);

    res.status(201).json({
      success: true,
      data: {
        ...baseline,
        screenshots: input.screenshots,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /baselines/branch/:branch
 * Get baseline for a branch (with inheritance)
 */
router.get('/branch/:branch', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, name } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const branch = req.params.branch;

    // First, check for branch-specific baseline
    let baseline = await prisma.baseline.findFirst({
      where: {
        projectId: projectId as string,
        branch,
        ...(name && { name: name as string }),
      },
    });

    // If not found, check branch inheritance
    if (!baseline) {
      const branchConfig = await prisma.branchBaseline.findUnique({
        where: {
          projectId_branch: {
            projectId: projectId as string,
            branch,
          },
        },
      });

      const parentBranch = branchConfig?.inheritsFrom || 'main';

      if (parentBranch !== branch) {
        baseline = await prisma.baseline.findFirst({
          where: {
            projectId: projectId as string,
            branch: parentBranch,
            ...(name && { name: name as string }),
          },
        });
      }
    }

    if (!baseline) {
      throw NotFoundError('Baseline');
    }

    res.json({
      success: true,
      data: {
        ...baseline,
        screenshots: JSON.parse(baseline.screenshots as string),
        inherited: baseline.branch !== branch,
        requestedBranch: branch,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /baselines/inheritance/:branch
 * Get inheritance chain for a branch
 */
router.get('/inheritance/:branch', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Build inheritance chain
    const chain: string[] = [req.params.branch];
    let currentBranch = req.params.branch;
    const visited = new Set<string>();

    while (currentBranch && !visited.has(currentBranch)) {
      visited.add(currentBranch);
      
      const config = await prisma.branchBaseline.findUnique({
        where: {
          projectId_branch: {
            projectId: projectId as string,
            branch: currentBranch,
          },
        },
      });

      if (config && config.inheritsFrom !== currentBranch) {
        currentBranch = config.inheritsFrom;
        chain.push(currentBranch);
      } else if (currentBranch !== 'main') {
        chain.push('main');
        break;
      } else {
        break;
      }
    }

    res.json({
      success: true,
      data: {
        branch: req.params.branch,
        chain,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /baselines/promote
 * Promote branch baseline to parent
 */
router.post('/promote', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, fromBranch, toBranch, screenNames } = z.object({
      projectId: z.string().cuid(),
      fromBranch: z.string(),
      toBranch: z.string(),
      screenNames: z.array(z.string()).optional(),
    }).parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Get baselines to promote
    const baselines = await prisma.baseline.findMany({
      where: {
        projectId,
        branch: fromBranch,
        ...(screenNames && { name: { in: screenNames } }),
      },
    });

    if (baselines.length === 0) {
      throw BadRequestError('No baselines found to promote');
    }

    // Promote each baseline
    const promoted: Array<{ name: string; action: string }> = [];
    for (const baseline of baselines) {
      const existing = await prisma.baseline.findUnique({
        where: {
          projectId_name_branch: {
            projectId,
            name: baseline.name,
            branch: toBranch,
          },
        },
      });

      if (existing) {
        // Update existing
        await prisma.baseline.update({
          where: { id: existing.id },
          data: {
            screenshots: baseline.screenshots as Prisma.InputJsonValue,
          },
        });
        promoted.push({ name: baseline.name, action: 'updated' });
      } else {
        // Create new
        await prisma.baseline.create({
          data: {
            projectId,
            name: baseline.name,
            branch: toBranch,
            type: baseline.type,
            screenshots: baseline.screenshots as Prisma.InputJsonValue,
          },
        });
        promoted.push({ name: baseline.name, action: 'created' });
      }
    }

    logger.info(`Baselines promoted: ${fromBranch} -> ${toBranch} (${promoted.length} baselines)`);

    res.json({
      success: true,
      data: {
        promoted,
        fromBranch,
        toBranch,
      },
    });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /baselines/:baselineId
 * Get baseline details
 */
router.get('/:baselineId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseline = await prisma.baseline.findUnique({
      where: { id: req.params.baselineId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
        ignoreMasks: true,
      },
    });

    if (!baseline) {
      throw NotFoundError('Baseline');
    }

    if (baseline.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: {
        ...baseline,
        screenshots: JSON.parse(baseline.screenshots as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /baselines/:baselineId
 * Update baseline (replace screenshots)
 */
router.put('/:baselineId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseline = await prisma.baseline.findUnique({
      where: { id: req.params.baselineId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
      },
    });

    if (!baseline) {
      throw NotFoundError('Baseline');
    }

    if (baseline.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const updates = updateBaselineSchema.parse(req.body);

    const updated = await prisma.baseline.update({
      where: { id: baseline.id },
      data: {
        name: updates.name,
        metadata: updates.metadata as Prisma.InputJsonValue | undefined,
        screenshots: updates.screenshots ? JSON.stringify(updates.screenshots) : undefined,
      },
    });

    logger.info(`Baseline updated: ${baseline.id}`);

    res.json({
      success: true,
      data: {
        ...updated,
        screenshots: JSON.parse(updated.screenshots as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /baselines/:baselineId
 * Delete a baseline
 */
router.delete('/:baselineId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseline = await prisma.baseline.findUnique({
      where: { id: req.params.baselineId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId: req.user!.id } } } },
          },
        },
      },
    });

    if (!baseline) {
      throw NotFoundError('Baseline');
    }

    if (baseline.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    await prisma.baseline.delete({
      where: { id: baseline.id },
    });

    logger.info(`Baseline deleted: ${baseline.id}`);

    res.json({
      success: true,
      data: { message: 'Baseline deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
