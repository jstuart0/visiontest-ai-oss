// VisionTest.ai - Projects Service
// Hospital-Grade: Full CRUD with access control

import { prisma, Role, Prisma } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateProjectInput {
  orgId: string;
  name: string;
  slug?: string;
  description?: string;
  repoUrl?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  repoUrl?: string | null;
  settings?: Record<string, unknown>;
}

export interface ProjectSettings {
  defaultBrowser: 'chromium' | 'firefox' | 'webkit';
  defaultViewport: { width: number; height: number };
  screenshotOnFailure: boolean;
  videoOnFailure: boolean;
  flakyThreshold: number;
  ciBlockQuarantined: boolean;
  notifications?: {
    slack?: string;
    email?: string[];
  };
}

export interface ProjectWithStats {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  repoUrl: string | null;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
  testCount: number;
  suiteCount: number;
  baselineCount: number;
  recentExecutions: number;
}

export interface ProjectDetails extends Omit<ProjectWithStats, 'recentExecutions'> {
  role: Role;
  stats: {
    testCount: number;
    suiteCount: number;
    baselineCount: number;
    flakyCount: number;
  };
  recentExecutions: Array<{
    id: string;
    status: string;
    triggeredBy: string;
    duration: number | null;
    createdAt: Date;
  }>;
}

export interface ProjectStats {
  tests: {
    total: number;
    active: number;
    quarantined: number;
  };
  executions: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    today: number;
    thisWeek: number;
    avgDuration: number | null;
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ProjectsService {
  /**
   * List projects user has access to.
   */
  async list(userId: string, orgId?: string): Promise<ProjectWithStats[]> {
    // Get user's organizations
    const memberships = await prisma.organizationUser.findMany({
      where: { 
        userId,
        ...(orgId && { orgId }),
      },
      select: { orgId: true },
    });

    const orgIds = memberships.map((m) => m.orgId);

    if (orgIds.length === 0) {
      return [];
    }

    // Get projects
    const projects = await prisma.project.findMany({
      where: { orgId: { in: orgIds } },
      include: {
        _count: {
          select: {
            tests: true,
            suites: true,
            baselines: true,
            executions: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      orgId: p.orgId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      repoUrl: p.repoUrl,
      settings: p.settings as unknown as ProjectSettings,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      testCount: p._count.tests,
      suiteCount: p._count.suites,
      baselineCount: p._count.baselines,
      recentExecutions: p._count.executions,
    }));
  }

  /**
   * Create a new project.
   */
  async create(userId: string, input: CreateProjectInput): Promise<ProjectWithStats> {
    const { orgId, name, slug, description, repoUrl } = input;

    // Check org membership
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: { userId, orgId },
      },
    });

    if (!membership) {
      throw ForbiddenError('Not a member of this organization');
    }

    // Generate slug if not provided
    let projectSlug = slug || this.generateSlug(name);

    // Check if slug is unique within org
    const existing = await prisma.project.findUnique({
      where: {
        orgId_slug: { orgId, slug: projectSlug },
      },
    });

    if (existing) {
      throw BadRequestError('Project slug already exists in this organization');
    }

    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        slug: projectSlug,
        description,
        repoUrl,
        settings: this.getDefaultSettings() as unknown as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId,
        userId,
        action: 'project.created',
        resource: 'project',
        resourceId: project.id,
      },
    });

    logger.info(`Project created: ${project.id} by user ${userId}`);

    return {
      ...project,
      settings: project.settings as unknown as ProjectSettings,
      testCount: 0,
      suiteCount: 0,
      baselineCount: 0,
      recentExecutions: 0,
    };
  }

  /**
   * Get project details with stats.
   */
  async getById(userId: string, projectId: string): Promise<ProjectDetails> {
    const { project, role } = await this.checkAccess(userId, projectId);

    // Get counts
    const [testCount, suiteCount, baselineCount, flakyCount] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.testSuite.count({ where: { projectId: project.id } }),
      prisma.baseline.count({ where: { projectId: project.id } }),
      prisma.flakyTest.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
    ]);

    // Get recent executions
    const recentExecutions = await prisma.execution.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        triggeredBy: true,
        duration: true,
        createdAt: true,
      },
    });

    return {
      id: project.id,
      orgId: project.orgId,
      name: project.name,
      slug: project.slug,
      description: project.description,
      repoUrl: project.repoUrl,
      settings: project.settings as ProjectSettings,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      testCount,
      suiteCount,
      baselineCount,
      role,
      stats: {
        testCount,
        suiteCount,
        baselineCount,
        flakyCount,
      },
      recentExecutions,
    };
  }

  /**
   * Update project.
   */
  async update(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectWithStats> {
    const { project, role } = await this.checkAccess(userId, projectId);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required');
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        name: input.name,
        description: input.description,
        repoUrl: input.repoUrl,
        ...(input.settings && {
          settings: {
            ...(project.settings as any),
            ...input.settings,
          } as Prisma.InputJsonValue,
        }),
      },
      include: {
        _count: {
          select: {
            tests: true,
            suites: true,
            baselines: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        userId,
        action: 'project.updated',
        resource: 'project',
        resourceId: project.id,
        details: { name: input.name, description: input.description, repoUrl: input.repoUrl } as Prisma.InputJsonValue,
      },
    });

    logger.info(`Project updated: ${project.id} by user ${userId}`);

    return {
      id: updated.id,
      orgId: updated.orgId,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      repoUrl: updated.repoUrl,
      settings: updated.settings as unknown as ProjectSettings,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      testCount: updated._count.tests,
      suiteCount: updated._count.suites,
      baselineCount: updated._count.baselines,
      recentExecutions: 0,
    };
  }

  /**
   * Delete project.
   */
  async delete(userId: string, projectId: string): Promise<void> {
    const { project, role } = await this.checkAccess(userId, projectId);

    if (role !== 'OWNER') {
      throw ForbiddenError('Owner access required');
    }

    await prisma.project.delete({
      where: { id: project.id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        userId,
        action: 'project.deleted',
        resource: 'project',
        resourceId: project.id,
      },
    });

    logger.info(`Project deleted: ${project.id} by user ${userId}`);
  }

  /**
   * Get project statistics.
   */
  async getStats(userId: string, projectId: string): Promise<ProjectStats> {
    const { project } = await this.checkAccess(userId, projectId);

    // Date ranges
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get statistics
    const [
      totalTests,
      activeTests,
      quarantinedTests,
      totalExecutions,
      passedExecutions,
      failedExecutions,
      executionsToday,
      executionsWeek,
      avgDuration,
    ] = await Promise.all([
      prisma.test.count({ where: { projectId: project.id } }),
      prisma.test.count({ where: { projectId: project.id, status: 'ACTIVE' } }),
      prisma.test.count({ where: { projectId: project.id, status: 'QUARANTINED' } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: month } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'PASSED', createdAt: { gte: month } } }),
      prisma.execution.count({ where: { projectId: project.id, status: 'FAILED', createdAt: { gte: month } } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: day } } }),
      prisma.execution.count({ where: { projectId: project.id, createdAt: { gte: week } } }),
      prisma.execution.aggregate({
        where: { projectId: project.id, duration: { not: null }, createdAt: { gte: month } },
        _avg: { duration: true },
      }),
    ]);

    const passRate = totalExecutions > 0 
      ? Math.round((passedExecutions / totalExecutions) * 100) 
      : 0;

    return {
      tests: {
        total: totalTests,
        active: activeTests,
        quarantined: quarantinedTests,
      },
      executions: {
        total: totalExecutions,
        passed: passedExecutions,
        failed: failedExecutions,
        passRate,
        today: executionsToday,
        thisWeek: executionsWeek,
        avgDuration: avgDuration._avg.duration,
      },
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  async checkAccess(userId: string, projectId: string): Promise<{ project: any; role: Role }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: {
          include: {
            users: {
              where: { userId },
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

    return { project, role: project.org.users[0].role };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private getDefaultSettings(): ProjectSettings {
    return {
      defaultBrowser: 'chromium',
      defaultViewport: { width: 1920, height: 1080 },
      screenshotOnFailure: true,
      videoOnFailure: false,
      flakyThreshold: 35,
      ciBlockQuarantined: false,
    };
  }
}

export const projectsService = new ProjectsService();
export default projectsService;
