// VisionTest.ai - Tests Service
// Hospital-Grade: Test management with full validation

import { prisma, TestStatus, Prisma } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface TestStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  name?: string;
  assertion?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

export interface CreateTestInput {
  projectId: string;
  suiteId?: string;
  name: string;
  description?: string;
  steps: TestStep[];
  tags?: string[];
  config?: Record<string, unknown>;
  coveredFiles?: string[];
}

export interface UpdateTestInput {
  name?: string;
  description?: string | null;
  suiteId?: string | null;
  steps?: TestStep[];
  tags?: string[];
  config?: Record<string, unknown>;
  status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  coveredFiles?: string[];
}

export interface TestWithDetails {
  id: string;
  projectId: string;
  suiteId: string | null;
  name: string;
  description: string | null;
  steps: TestStep[];
  tags: string[];
  config: Record<string, unknown>;
  coveredFiles: string[];
  status: TestStatus;
  createdAt: Date;
  updatedAt: Date;
  suite?: { id: string; name: string } | null;
  flakyData?: { flakinessScore: number; status: string } | null;
  executionCount?: number;
}

export interface ListTestsOptions {
  projectId: string;
  suiteId?: string;
  status?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class TestsService {
  /**
   * List tests with filtering and pagination.
   */
  async list(userId: string, options: ListTestsOptions): Promise<{
    tests: TestWithDetails[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    await this.checkProjectAccess(userId, options.projectId);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      projectId: options.projectId,
    };

    if (options.suiteId) {
      where.suiteId = options.suiteId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [tests, total] = await Promise.all([
      prisma.test.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          suite: { select: { id: true, name: true } },
          flakyData: { select: { flakinessScore: true, status: true } },
          _count: { select: { executions: true } },
        },
      }),
      prisma.test.count({ where }),
    ]);

    return {
      tests: tests.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        suiteId: t.suiteId,
        name: t.name,
        description: t.description,
        steps: this.parseSteps(t.steps),
        tags: t.tags,
        config: t.config as Record<string, unknown>,
        coveredFiles: t.coveredFiles,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        suite: t.suite,
        flakyData: t.flakyData,
        executionCount: t._count.executions,
      })),
      total,
      page,
      limit,
      hasMore: skip + tests.length < total,
    };
  }

  /**
   * Create a new test.
   */
  async create(userId: string, input: CreateTestInput): Promise<TestWithDetails> {
    await this.checkProjectAccess(userId, input.projectId);

    // Validate suite exists
    if (input.suiteId) {
      const suite = await prisma.testSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
      });
      if (!suite) {
        throw BadRequestError('Suite not found in this project');
      }
    }

    // Validate steps
    this.validateSteps(input.steps);

    const test = await prisma.test.create({
      data: {
        projectId: input.projectId,
        suiteId: input.suiteId,
        name: input.name,
        description: input.description,
        steps: JSON.stringify(input.steps),
        tags: input.tags || [],
        config: (input.config || {}) as Prisma.InputJsonValue,
        coveredFiles: input.coveredFiles || [],
        status: TestStatus.ACTIVE,
      },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    logger.info(`Test created: ${test.id} in project ${input.projectId}`);

    return {
      id: test.id,
      projectId: test.projectId,
      suiteId: test.suiteId,
      name: test.name,
      description: test.description,
      steps: input.steps,
      tags: test.tags,
      config: test.config as Record<string, unknown>,
      coveredFiles: test.coveredFiles,
      status: test.status,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      suite: test.suite,
    };
  }

  /**
   * Get test by ID with full details.
   */
  async getById(userId: string, testId: string): Promise<TestWithDetails & {
    recentExecutions: Array<{
      id: string;
      status: string;
      duration: number | null;
      createdAt: Date;
    }>;
  }> {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        suite: { select: { id: true, name: true } },
        flakyData: true,
        ignoreMasks: true,
        project: {
          include: {
            org: { include: { users: { where: { userId } } } },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    const recentExecutions = await prisma.execution.findMany({
      where: { testId: test.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        duration: true,
        createdAt: true,
      },
    });

    return {
      id: test.id,
      projectId: test.projectId,
      suiteId: test.suiteId,
      name: test.name,
      description: test.description,
      steps: this.parseSteps(test.steps),
      tags: test.tags,
      config: test.config as Record<string, unknown>,
      coveredFiles: test.coveredFiles,
      status: test.status,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      suite: test.suite,
      flakyData: test.flakyData,
      recentExecutions,
    };
  }

  /**
   * Update a test.
   */
  async update(userId: string, testId: string, input: UpdateTestInput): Promise<TestWithDetails> {
    const test = await this.getTestWithAccess(userId, testId);

    // Validate suite if changing
    if (input.suiteId) {
      const suite = await prisma.testSuite.findFirst({
        where: { id: input.suiteId, projectId: test.projectId },
      });
      if (!suite) {
        throw BadRequestError('Suite not found in this project');
      }
    }

    // Validate steps if provided
    if (input.steps) {
      this.validateSteps(input.steps);
    }

    const updated = await prisma.test.update({
      where: { id: test.id },
      data: {
        name: input.name,
        description: input.description,
        suiteId: input.suiteId,
        tags: input.tags,
        config: input.config as Prisma.InputJsonValue | undefined,
        coveredFiles: input.coveredFiles,
        status: input.status as TestStatus,
        ...(input.steps && { steps: JSON.stringify(input.steps) }),
      },
      include: {
        suite: { select: { id: true, name: true } },
        flakyData: { select: { flakinessScore: true, status: true } },
      },
    });

    logger.info(`Test updated: ${test.id}`);

    return {
      id: updated.id,
      projectId: updated.projectId,
      suiteId: updated.suiteId,
      name: updated.name,
      description: updated.description,
      steps: this.parseSteps(updated.steps),
      tags: updated.tags,
      config: updated.config as Record<string, unknown>,
      coveredFiles: updated.coveredFiles,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      suite: updated.suite,
      flakyData: updated.flakyData,
    };
  }

  /**
   * Delete a test.
   */
  async delete(userId: string, testId: string): Promise<void> {
    const test = await this.getTestWithAccess(userId, testId);

    await prisma.test.delete({
      where: { id: test.id },
    });

    logger.info(`Test deleted: ${test.id}`);
  }

  /**
   * Run a test.
   */
  async run(userId: string, testId: string, config?: {
    browser?: string;
    viewport?: { width: number; height: number };
  }): Promise<{ executionId: string }> {
    const test = await this.getTestWithAccess(userId, testId);

    if (test.status === 'QUARANTINED') {
      throw BadRequestError('Cannot run quarantined test');
    }

    const execution = await prisma.execution.create({
      data: {
        projectId: test.projectId,
        testId: test.id,
        status: 'PENDING',
        triggeredBy: 'MANUAL',
        metadata: {
          browser: config?.browser || 'chromium',
          viewport: config?.viewport,
        },
      },
    });

    logger.info(`Execution created: ${execution.id} for test ${test.id}`);

    return { executionId: execution.id };
  }

  /**
   * Duplicate a test.
   */
  async duplicate(userId: string, testId: string, name?: string): Promise<TestWithDetails> {
    const test = await this.getTestWithAccess(userId, testId);

    const duplicate = await prisma.test.create({
      data: {
        projectId: test.projectId,
        suiteId: test.suiteId,
        name: name || `${test.name} (copy)`,
        description: test.description,
        steps: test.steps as Prisma.InputJsonValue,
        tags: test.tags,
        config: test.config as Prisma.InputJsonValue,
        coveredFiles: test.coveredFiles,
        status: TestStatus.ACTIVE,
      },
      include: {
        suite: { select: { id: true, name: true } },
      },
    });

    logger.info(`Test duplicated: ${test.id} -> ${duplicate.id}`);

    return {
      id: duplicate.id,
      projectId: duplicate.projectId,
      suiteId: duplicate.suiteId,
      name: duplicate.name,
      description: duplicate.description,
      steps: this.parseSteps(duplicate.steps),
      tags: duplicate.tags,
      config: duplicate.config as Record<string, unknown>,
      coveredFiles: duplicate.coveredFiles,
      status: duplicate.status,
      createdAt: duplicate.createdAt,
      updatedAt: duplicate.updatedAt,
      suite: duplicate.suite,
    };
  }

  /**
   * Get test execution history.
   */
  async getHistory(userId: string, testId: string, page = 1, limit = 20): Promise<{
    executions: Array<{
      id: string;
      status: string;
      triggeredBy: string;
      duration: number | null;
      errorMessage: string | null;
      createdAt: Date;
      completedAt: Date | null;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    await this.getTestWithAccess(userId, testId);

    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where: { testId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          triggeredBy: true,
          duration: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.execution.count({ where: { testId } }),
    ]);

    return {
      executions,
      total,
      page,
      limit,
      hasMore: skip + executions.length < total,
    };
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
      throw ForbiddenError('No access to this project');
    }
  }

  private async getTestWithAccess(userId: string, testId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: {
          include: {
            org: { include: { users: { where: { userId } } } },
          },
        },
      },
    });

    if (!test) {
      throw NotFoundError('Test');
    }

    if (test.project.org.users.length === 0) {
      throw ForbiddenError('No access to this test');
    }

    return test;
  }

  private parseSteps(steps: any): TestStep[] {
    if (typeof steps === 'string') {
      return JSON.parse(steps);
    }
    return steps || [];
  }

  private validateSteps(steps: TestStep[]): void {
    const validTypes = [
      // Web steps
      'navigate', 'click', 'type', 'clear', 'select', 'hover',
      'scroll', 'waitFor', 'assert', 'screenshot', 'ai', 'loop', 'condition',
      // Mobile-specific steps
      'tap', 'swipe', 'pinch', 'longPress', 'doubleTap', 'shake', 'rotate',
      'launchApp', 'deepLink', 'notification', 'backButton', 'homeButton',
      'typeText', 'hideKeyboard',
    ];

    for (const step of steps) {
      if (!validTypes.includes(step.type)) {
        throw BadRequestError(`Invalid step type: ${step.type}`);
      }

      if (step.type === 'navigate' && !step.url) {
        throw BadRequestError('Navigate step requires url');
      }

      if (['click', 'type', 'hover'].includes(step.type) && !step.selector) {
        throw BadRequestError(`${step.type} step requires selector`);
      }
    }
  }
}

export const testsService = new TestsService();
export default testsService;
