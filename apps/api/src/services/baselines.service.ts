// VisionTest.ai - Baselines Service
// Hospital-Grade: Branch-based baseline management

import { prisma, BaselineType, Prisma } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface BaselineScreenshot {
  name: string;
  url: string;
  width: number;
  height: number;
  deviceType?: string;
}

export interface CreateBaselineInput {
  projectId: string;
  name: string;
  branch?: string;
  type?: BaselineType;
  screenshots: BaselineScreenshot[];
}

export interface UpdateBaselineInput {
  name?: string;
  screenshots?: BaselineScreenshot[];
  metadata?: Record<string, unknown>;
}

export interface BaselineResult {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  type: BaselineType;
  screenshots: BaselineScreenshot[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class BaselinesService {
  /**
   * List baselines for a project.
   */
  async list(userId: string, projectId: string, branch?: string): Promise<BaselineResult[]> {
    await this.checkProjectAccess(userId, projectId);

    const where: any = { projectId };
    if (branch) where.branch = branch;

    const baselines = await prisma.baseline.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { comparisons: true, ignoreMasks: true } },
      },
    });

    return baselines.map((b) => ({
      id: b.id,
      projectId: b.projectId,
      name: b.name,
      branch: b.branch,
      type: b.type,
      screenshots: JSON.parse(b.screenshots as string),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  }

  /**
   * Create a new baseline.
   */
  async create(userId: string, input: CreateBaselineInput): Promise<BaselineResult> {
    await this.checkProjectAccess(userId, input.projectId);

    const branch = input.branch || 'main';

    // Check for existing baseline with same name/branch
    const existing = await prisma.baseline.findUnique({
      where: {
        projectId_name_branch: {
          projectId: input.projectId,
          name: input.name,
          branch,
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
        branch,
        type: input.type || 'PROJECT',
        screenshots: JSON.stringify(input.screenshots),
      },
    });

    logger.info(`Baseline created: ${baseline.id}`);

    return {
      id: baseline.id,
      projectId: baseline.projectId,
      name: baseline.name,
      branch: baseline.branch,
      type: baseline.type,
      screenshots: input.screenshots,
      createdAt: baseline.createdAt,
      updatedAt: baseline.updatedAt,
    };
  }

  /**
   * Get baseline by ID.
   */
  async getById(userId: string, baselineId: string): Promise<BaselineResult> {
    const baseline = await this.getBaselineWithAccess(userId, baselineId);

    return {
      id: baseline.id,
      projectId: baseline.projectId,
      name: baseline.name,
      branch: baseline.branch,
      type: baseline.type,
      screenshots: JSON.parse(baseline.screenshots as string),
      createdAt: baseline.createdAt,
      updatedAt: baseline.updatedAt,
    };
  }

  /**
   * Update a baseline.
   */
  async update(userId: string, baselineId: string, input: UpdateBaselineInput): Promise<BaselineResult> {
    const baseline = await this.getBaselineWithAccess(userId, baselineId);

    const updated = await prisma.baseline.update({
      where: { id: baseline.id },
      data: {
        name: input.name,
        ...(input.screenshots && { screenshots: JSON.stringify(input.screenshots) }),
        ...(input.metadata && { metadata: input.metadata as Prisma.InputJsonValue }),
      },
    });

    logger.info(`Baseline updated: ${baseline.id}`);

    return {
      id: updated.id,
      projectId: updated.projectId,
      name: updated.name,
      branch: updated.branch,
      type: updated.type,
      screenshots: JSON.parse(updated.screenshots as string),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a baseline.
   */
  async delete(userId: string, baselineId: string): Promise<void> {
    const baseline = await this.getBaselineWithAccess(userId, baselineId);

    await prisma.baseline.delete({ where: { id: baseline.id } });

    logger.info(`Baseline deleted: ${baseline.id}`);
  }

  /**
   * Get baseline for a branch with inheritance.
   */
  async getForBranch(userId: string, projectId: string, branch: string, name?: string): Promise<BaselineResult & { inherited: boolean; requestedBranch: string }> {
    await this.checkProjectAccess(userId, projectId);

    // First, check for branch-specific baseline
    let baseline = await prisma.baseline.findFirst({
      where: {
        projectId,
        branch,
        ...(name && { name }),
      },
    });

    let inherited = false;

    // If not found, check branch inheritance
    if (!baseline) {
      const branchConfig = await prisma.branchBaseline.findUnique({
        where: {
          projectId_branch: { projectId, branch },
        },
      });

      const parentBranch = branchConfig?.inheritsFrom || 'main';

      if (parentBranch !== branch) {
        baseline = await prisma.baseline.findFirst({
          where: {
            projectId,
            branch: parentBranch,
            ...(name && { name }),
          },
        });
        inherited = true;
      }
    }

    if (!baseline) {
      throw NotFoundError('Baseline');
    }

    return {
      id: baseline.id,
      projectId: baseline.projectId,
      name: baseline.name,
      branch: baseline.branch,
      type: baseline.type,
      screenshots: JSON.parse(baseline.screenshots as string),
      createdAt: baseline.createdAt,
      updatedAt: baseline.updatedAt,
      inherited,
      requestedBranch: branch,
    };
  }

  /**
   * Get inheritance chain for a branch.
   */
  async getInheritanceChain(userId: string, projectId: string, branch: string): Promise<string[]> {
    await this.checkProjectAccess(userId, projectId);

    const chain: string[] = [branch];
    let currentBranch = branch;
    const visited = new Set<string>();

    while (currentBranch && !visited.has(currentBranch)) {
      visited.add(currentBranch);
      
      const config = await prisma.branchBaseline.findUnique({
        where: {
          projectId_branch: { projectId, branch: currentBranch },
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

    return chain;
  }

  /**
   * Promote baselines from one branch to another.
   */
  async promote(userId: string, projectId: string, fromBranch: string, toBranch: string, screenNames?: string[]): Promise<{ promoted: Array<{ name: string; action: 'created' | 'updated' }> }> {
    await this.checkProjectAccess(userId, projectId);

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

    const promoted: Array<{ name: string; action: 'created' | 'updated' }> = [];

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
        await prisma.baseline.update({
          where: { id: existing.id },
          data: { screenshots: baseline.screenshots as Prisma.InputJsonValue },
        });
        promoted.push({ name: baseline.name, action: 'updated' });
      } else {
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

    return { promoted };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async checkProjectAccess(userId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: { include: { users: { where: { userId } } } },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }
  }

  private async getBaselineWithAccess(userId: string, baselineId: string) {
    const baseline = await prisma.baseline.findUnique({
      where: { id: baselineId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId } } } },
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

    return baseline;
  }
}

export const baselinesService = new BaselinesService();
export default baselinesService;
