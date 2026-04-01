// VisionTest AI - Smart Test Selection Routes
// P1 Feature: Run only tests affected by code changes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const smartSelectSchema = z.object({
  projectId: z.string().cuid(),
  baseRef: z.string(),
  headRef: z.string(),
  repoPath: z.string().optional(),
  alwaysInclude: z.array(z.string()).optional(), // Tags to always include
});

const rebuildMappingSchema = z.object({
  projectId: z.string().cuid(),
  repoPath: z.string(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getChangedFiles(repoPath: string, baseRef: string, headRef: string): Promise<string[]> {
  try {
    const output = execSync(
      `git diff --name-only ${baseRef}...${headRef}`,
      { cwd: repoPath, encoding: 'utf-8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    logger.error('Failed to get git diff:', error);
    return [];
  }
}

function findAffectedTests(
  changedFiles: string[],
  impactMappings: Array<{ filePath: string; tests: string[] }>,
  allTests: Array<{ id: string; coveredFiles: string[] }>
): Set<string> {
  const affected = new Set<string>();

  // Check impact mappings
  for (const file of changedFiles) {
    const mapping = impactMappings.find((m) => m.filePath === file || file.includes(m.filePath));
    if (mapping) {
      mapping.tests.forEach((testId) => affected.add(testId));
    }
  }

  // Check test coveredFiles
  for (const test of allTests) {
    if (test.coveredFiles.some((cf) => changedFiles.some((f) => f.includes(cf) || cf.includes(f)))) {
      affected.add(test.id);
    }
  }

  return affected;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /smart-select
 * Get affected tests for a git diff
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = smartSelectSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
        tests: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            tags: true,
            coveredFiles: true,
            suiteId: true,
          },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Get changed files
    let changedFiles: string[] = [];
    if (input.repoPath && fs.existsSync(input.repoPath)) {
      changedFiles = await getChangedFiles(input.repoPath, input.baseRef, input.headRef);
    } else if (project.repoUrl) {
      // Use the smart select service to handle remote repo cloning
      const { smartSelectService } = await import('../services/smartSelect.service');
      const result = await smartSelectService.select(req.user!.id, input);
      
      // Return early with the service result
      return res.json({
        success: true,
        data: result,
      });
    }

    // Get impact mappings
    const impactMappings = await prisma.impactMapping.findMany({
      where: { projectId: input.projectId },
    });

    // Find affected tests
    const affectedIds = changedFiles.length > 0
      ? findAffectedTests(
          changedFiles,
          impactMappings.map((m) => ({ filePath: m.filePath, tests: m.tests })),
          project.tests as any[]
        )
      : new Set<string>();

    // Always include tests with specified tags
    const alwaysIncludeTags = input.alwaysInclude || ['smoke', 'critical'];
    project.tests.forEach((test) => {
      if (test.tags.some((tag) => alwaysIncludeTags.includes(tag))) {
        affectedIds.add(test.id);
      }
    });

    // Build response
    const affectedTests = project.tests
      .filter((t) => affectedIds.has(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        tags: t.tags,
        suiteId: t.suiteId,
        impactedBy: changedFiles.filter((f) =>
          t.coveredFiles.some((cf) => f.includes(cf) || cf.includes(f))
        ),
      }));

    const totalTests = project.tests.length;
    const selectedTests = affectedTests.length;
    const reduction = totalTests > 0 ? Math.round((1 - selectedTests / totalTests) * 100) : 0;

    // Estimate time (assume 30s per test average)
    const estimatedTime = selectedTests * 30;

    logger.info(`Smart selection: ${selectedTests}/${totalTests} tests selected (${reduction}% reduction)`);

    return res.json({
      success: true,
      data: {
        changedFiles,
        affectedTests,
        stats: {
          totalTests,
          selectedTests,
          reduction,
          estimatedTime,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /smart-select/mapping
 * Get impact mapping for a project
 */
router.get('/mapping', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

    const mappings = await prisma.impactMapping.findMany({
      where: { projectId: projectId as string },
      orderBy: { filePath: 'asc' },
    });

    res.json({
      success: true,
      data: mappings,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /smart-select/mapping/rebuild
 * Rebuild impact mapping from repo
 */
router.post('/mapping/rebuild', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = rebuildMappingSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: { include: { users: { where: { userId: req.user!.id } } } },
        tests: {
          select: { id: true, name: true, coveredFiles: true },
        },
      },
    });

    if (!project || project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    // Delete existing mappings
    await prisma.impactMapping.deleteMany({
      where: { projectId: input.projectId },
    });

    // Build mappings from test coveredFiles
    const mappings: Record<string, Set<string>> = {};

    for (const test of project.tests) {
      for (const file of test.coveredFiles) {
        if (!mappings[file]) {
          mappings[file] = new Set();
        }
        mappings[file].add(test.id);
      }
    }

    // Create new mappings
    const created = await prisma.impactMapping.createMany({
      data: Object.entries(mappings).map(([filePath, testIds]) => ({
        projectId: input.projectId,
        filePath,
        components: [],
        tests: Array.from(testIds),
      })),
    });

    logger.info(`Impact mapping rebuilt: ${created.count} mappings for project ${input.projectId}`);

    res.json({
      success: true,
      data: {
        mappingsCreated: created.count,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /smart-select/stats
 * Get smart selection statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

    // Get executions with smart selection metadata
    const recentExecutions = await prisma.execution.findMany({
      where: {
        projectId: projectId as string,
        triggeredBy: 'CI',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        metadata: true,
        duration: true,
      },
    });

    // Calculate savings
    let totalFullTime = 0;
    let totalActualTime = 0;
    let smartSelectRuns = 0;

    for (const exec of recentExecutions) {
      const meta = exec.metadata as any;
      if (meta?.smartSelect) {
        smartSelectRuns++;
        totalFullTime += meta.fullSuiteEstimate || 0;
        totalActualTime += exec.duration || 0;
      }
    }

    const timeSaved = totalFullTime - totalActualTime;
    const avgReduction = smartSelectRuns > 0 
      ? Math.round((1 - totalActualTime / totalFullTime) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        smartSelectRuns,
        timeSavedMs: timeSaved,
        timeSavedMinutes: Math.round(timeSaved / 60000),
        avgReduction,
        period: '30 days',
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
