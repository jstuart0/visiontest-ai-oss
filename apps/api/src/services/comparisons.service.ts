// VisionTest AI - Comparisons Service
// Hospital-Grade: Visual comparison management

import { prisma, ComparisonStatus } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface ComparisonResult {
  id: string;
  executionId: string;
  baselineId: string;
  screenshotId: string | null;
  diffScore: number;
  diffUrl: string | null;
  status: ComparisonStatus;
  changes: VisualChange[] | null;
  masksApplied: number;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface VisualChange {
  type: 'color' | 'layout' | 'content' | 'missing' | 'added';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  bounds?: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface ListComparisonsOptions {
  projectId?: string;
  executionId?: string;
  status?: ComparisonStatus;
  page?: number;
  limit?: number;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ComparisonsService {
  /**
   * List comparisons with filtering and pagination.
   */
  async list(userId: string, options: ListComparisonsOptions): Promise<{
    comparisons: ComparisonResult[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    if (!options.projectId && !options.executionId) {
      throw BadRequestError('projectId or executionId is required');
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (options.executionId) {
      where.executionId = options.executionId;
    }

    if (options.projectId) {
      where.execution = { projectId: options.projectId };
    }

    if (options.status) {
      where.status = options.status;
    }

    // Check access
    await this.checkComparisonAccess(userId, where);

    const [comparisons, total] = await Promise.all([
      prisma.comparison.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          baseline: { select: { id: true, name: true, branch: true } },
          screenshot: { select: { id: true, name: true, url: true } },
          approval: true,
        },
      }),
      prisma.comparison.count({ where }),
    ]);

    return {
      comparisons: comparisons.map((c) => ({
        id: c.id,
        executionId: c.executionId,
        baselineId: c.baselineId,
        screenshotId: c.screenshotId,
        diffScore: c.diffScore,
        diffUrl: c.diffUrl,
        status: c.status,
        changes: c.changes as VisualChange[] | null,
        masksApplied: c.masksApplied,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
      })),
      total,
      page,
      limit,
      hasMore: skip + comparisons.length < total,
    };
  }

  /**
   * Get comparison by ID.
   */
  async getById(userId: string, comparisonId: string): Promise<ComparisonResult> {
    const comparison = await this.getComparisonWithAccess(userId, comparisonId);

    return {
      id: comparison.id,
      executionId: comparison.executionId,
      baselineId: comparison.baselineId,
      screenshotId: comparison.screenshotId,
      diffScore: comparison.diffScore,
      diffUrl: comparison.diffUrl,
      status: comparison.status,
      changes: comparison.changes as VisualChange[] | null,
      masksApplied: comparison.masksApplied,
      createdAt: comparison.createdAt,
      resolvedAt: comparison.resolvedAt,
    };
  }

  /**
   * Approve a comparison.
   */
  async approve(userId: string, comparisonId: string, options?: {
    comment?: string;
    updateBaseline?: boolean;
  }): Promise<ComparisonResult> {
    const comparison = await this.getComparisonWithAccess(userId, comparisonId);

    const updated = await prisma.comparison.update({
      where: { id: comparison.id },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
        metadata: {
          ...(comparison.metadata as any || {}),
          approvedBy: userId,
          approvedAt: new Date().toISOString(),
          comment: options?.comment,
        },
      },
    });

    // Update approval request if exists
    if (comparison.approval) {
      await prisma.approvalRequest.update({
        where: { id: comparison.approval.id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          comment: options?.comment,
          resolvedAt: new Date(),
        },
      });
    }

    // Update baseline if requested
    if (options?.updateBaseline && comparison.screenshot) {
      await this.updateBaseline(comparison);
    }

    logger.info(`Comparison approved: ${comparison.id}`);

    return {
      id: updated.id,
      executionId: updated.executionId,
      baselineId: updated.baselineId,
      screenshotId: updated.screenshotId,
      diffScore: updated.diffScore,
      diffUrl: updated.diffUrl,
      status: updated.status,
      changes: updated.changes as VisualChange[] | null,
      masksApplied: updated.masksApplied,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
    };
  }

  /**
   * Reject a comparison.
   */
  async reject(userId: string, comparisonId: string, comment: string, createBug?: boolean): Promise<ComparisonResult> {
    const comparison = await this.getComparisonWithAccess(userId, comparisonId);

    const updated = await prisma.comparison.update({
      where: { id: comparison.id },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        metadata: {
          ...(comparison.metadata as any || {}),
          rejectedBy: userId,
          rejectedAt: new Date().toISOString(),
          comment,
        },
      },
    });

    // Update approval request if exists
    await prisma.approvalRequest.updateMany({
      where: { comparisonId: comparison.id },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
        comment,
        resolvedAt: new Date(),
      },
    });

    if (createBug) {
      // Create bug in configured issue tracker
      const { issueTrackerService } = await import('./issueTracker.service');
      const bugResult = await issueTrackerService.createBug({
        projectId: comparison.execution.project.id,
        comparisonId: comparison.id,
        title: `Visual regression detected in comparison ${comparison.id}`,
        description: comment || 'Visual difference detected that needs investigation.',
        severity: 'MEDIUM',
        diffUrl: comparison.diffUrl || undefined,
      });
      logger.info(`Bug created for comparison: ${comparison.id}`, { bug: bugResult });
    }

    logger.info(`Comparison rejected: ${comparison.id}`);

    return {
      id: updated.id,
      executionId: updated.executionId,
      baselineId: updated.baselineId,
      screenshotId: updated.screenshotId,
      diffScore: updated.diffScore,
      diffUrl: updated.diffUrl,
      status: updated.status,
      changes: updated.changes as VisualChange[] | null,
      masksApplied: updated.masksApplied,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
    };
  }

  /**
   * Bulk approve comparisons.
   */
  async bulkApprove(userId: string, comparisonIds: string[], updateBaseline?: boolean): Promise<{ approved: number }> {
    // Verify access to all comparisons
    for (const id of comparisonIds) {
      await this.getComparisonWithAccess(userId, id);
    }

    // Update all
    await prisma.comparison.updateMany({
      where: { id: { in: comparisonIds } },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
      },
    });

    // Update approval requests
    await prisma.approvalRequest.updateMany({
      where: { comparisonId: { in: comparisonIds } },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        resolvedAt: new Date(),
      },
    });

    logger.info(`Bulk approved ${comparisonIds.length} comparisons`);

    return { approved: comparisonIds.length };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async checkComparisonAccess(userId: string, where: any): Promise<void> {
    const sampleComparison = await prisma.comparison.findFirst({
      where,
      include: {
        execution: {
          include: {
            project: {
              include: {
                org: { include: { users: { where: { userId } } } },
              },
            },
          },
        },
      },
    });

    if (sampleComparison && sampleComparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }
  }

  private async getComparisonWithAccess(userId: string, comparisonId: string) {
    const comparison = await prisma.comparison.findUnique({
      where: { id: comparisonId },
      include: {
        execution: {
          include: {
            project: {
              include: {
                org: { include: { users: { where: { userId } } } },
              },
            },
          },
        },
        baseline: true,
        screenshot: true,
        approval: true,
      },
    });

    if (!comparison) {
      throw NotFoundError('Comparison');
    }

    if (comparison.execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    return comparison;
  }

  private async updateBaseline(comparison: any): Promise<void> {
    const currentScreenshots = JSON.parse(comparison.baseline.screenshots as string);
    const screenshotIndex = currentScreenshots.findIndex(
      (s: any) => s.name === comparison.screenshot!.name
    );
    
    if (screenshotIndex >= 0) {
      currentScreenshots[screenshotIndex] = {
        name: comparison.screenshot.name,
        url: comparison.screenshot.url,
        width: comparison.screenshot.width,
        height: comparison.screenshot.height,
      };
    } else {
      currentScreenshots.push({
        name: comparison.screenshot.name,
        url: comparison.screenshot.url,
        width: comparison.screenshot.width,
        height: comparison.screenshot.height,
      });
    }

    await prisma.baseline.update({
      where: { id: comparison.baselineId },
      data: { screenshots: JSON.stringify(currentScreenshots) },
    });

    logger.info(`Baseline updated from approval: ${comparison.baselineId}`);
  }
}

export const comparisonsService = new ComparisonsService();
export default comparisonsService;
