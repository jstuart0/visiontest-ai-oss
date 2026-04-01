// VisionTest.ai - Smart Test Selection Service
// Hospital-Grade: Run only tests affected by code changes

import { prisma } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { execSync } from 'child_process';
import * as fs from 'fs';

// =============================================================================
// TYPES
// =============================================================================

export interface SmartSelectInput {
  projectId: string;
  baseRef: string;
  headRef: string;
  repoPath?: string;
  alwaysInclude?: string[];
}

export interface AffectedTest {
  id: string;
  name: string;
  tags: string[];
  suiteId: string | null;
  impactedBy: string[];
}

export interface SmartSelectResult {
  changedFiles: string[];
  affectedTests: AffectedTest[];
  stats: {
    totalTests: number;
    selectedTests: number;
    reduction: number;
    estimatedTime: number;
  };
}

export interface ImpactMapping {
  filePath: string;
  components: string[];
  tests: string[];
}

export interface SmartSelectStats {
  smartSelectRuns: number;
  timeSavedMs: number;
  timeSavedMinutes: number;
  avgReduction: number;
  period: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get changed files between two git refs.
 */
export function getChangedFiles(repoPath: string, baseRef: string, headRef: string): string[] {
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

/**
 * Find tests affected by changed files.
 */
export function findAffectedTests(
  changedFiles: string[],
  impactMappings: ImpactMapping[],
  allTests: Array<{ id: string; coveredFiles: string[] }>
): Set<string> {
  const affected = new Set<string>();

  // Check impact mappings
  for (const file of changedFiles) {
    const mapping = impactMappings.find((m) => 
      m.filePath === file || file.includes(m.filePath) || m.filePath.includes(file)
    );
    if (mapping) {
      mapping.tests.forEach((testId) => affected.add(testId));
    }
  }

  // Check test coveredFiles
  for (const test of allTests) {
    if (test.coveredFiles.some((cf) => 
      changedFiles.some((f) => f.includes(cf) || cf.includes(f))
    )) {
      affected.add(test.id);
    }
  }

  return affected;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class SmartSelectService {
  /**
   * Get affected tests for a git diff.
   */
  async select(userId: string, input: SmartSelectInput): Promise<SmartSelectResult> {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        org: { include: { users: { where: { userId } } } },
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
      changedFiles = getChangedFiles(input.repoPath, input.baseRef, input.headRef);
    } else if (project.repoUrl) {
      // Clone repo temporarily and get diff
      const tempChangedFiles = await this.getChangedFilesFromRemote(
        project.repoUrl,
        input.baseRef,
        input.headRef
      );
      if (tempChangedFiles) {
        changedFiles = tempChangedFiles;
      } else {
        logger.warn('Failed to get diff from remote repo, returning all tests');
      }
    }

    // Get impact mappings
    const impactMappings = await prisma.impactMapping.findMany({
      where: { projectId: input.projectId },
    });

    // Find affected tests
    const affectedIds = changedFiles.length > 0
      ? findAffectedTests(
          changedFiles,
          impactMappings.map((m) => ({
            filePath: m.filePath,
            components: m.components,
            tests: m.tests,
          })),
          project.tests
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
    const affectedTests: AffectedTest[] = project.tests
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
    const estimatedTime = selectedTests * 30; // Assume 30s per test

    logger.info(`Smart selection: ${selectedTests}/${totalTests} tests selected (${reduction}% reduction)`);

    return {
      changedFiles,
      affectedTests,
      stats: {
        totalTests,
        selectedTests,
        reduction,
        estimatedTime,
      },
    };
  }

  /**
   * Get impact mapping for a project.
   */
  async getMapping(userId: string, projectId: string): Promise<ImpactMapping[]> {
    await this.checkProjectAccess(userId, projectId);

    const mappings = await prisma.impactMapping.findMany({
      where: { projectId },
      orderBy: { filePath: 'asc' },
    });

    return mappings.map((m) => ({
      filePath: m.filePath,
      components: m.components,
      tests: m.tests,
    }));
  }

  /**
   * Rebuild impact mapping from repo.
   */
  async rebuildMapping(userId: string, projectId: string, repoPath: string): Promise<{ mappingsCreated: number }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: { include: { users: { where: { userId } } } },
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
      where: { projectId },
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
        projectId,
        filePath,
        components: [],
        tests: Array.from(testIds),
      })),
    });

    logger.info(`Impact mapping rebuilt: ${created.count} mappings for project ${projectId}`);

    return { mappingsCreated: created.count };
  }

  /**
   * Get smart selection statistics.
   */
  async getStats(userId: string, projectId: string): Promise<SmartSelectStats> {
    await this.checkProjectAccess(userId, projectId);

    // Get executions with smart selection metadata
    const recentExecutions = await prisma.execution.findMany({
      where: {
        projectId,
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

    const timeSavedMs = totalFullTime - totalActualTime;
    const avgReduction = smartSelectRuns > 0 && totalFullTime > 0
      ? Math.round((1 - totalActualTime / totalFullTime) * 100)
      : 0;

    return {
      smartSelectRuns,
      timeSavedMs,
      timeSavedMinutes: Math.round(timeSavedMs / 60000),
      avgReduction,
      period: '30 days',
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
      throw ForbiddenError('No access');
    }
  }

  /**
   * Clone a remote repository temporarily and get changed files between refs
   */
  private async getChangedFilesFromRemote(
    repoUrl: string,
    baseRef: string,
    headRef: string
  ): Promise<string[] | null> {
    const os = await import('os');
    const path = await import('path');
    const crypto = await import('crypto');
    
    const tempId = crypto.randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `visiontest-repo-${tempId}`);

    try {
      // Shallow clone with only the refs we need (faster)
      execSync(
        `git clone --depth 1 --no-checkout --filter=blob:none ${repoUrl} ${tempDir}`,
        { encoding: 'utf-8', timeout: 60000 }
      );

      // Fetch the specific refs
      execSync(
        `git fetch origin ${baseRef}:${baseRef} ${headRef}:${headRef}`,
        { cwd: tempDir, encoding: 'utf-8', timeout: 30000 }
      );

      // Get the diff
      const changedFiles = getChangedFiles(tempDir, baseRef, headRef);

      logger.info(`Got ${changedFiles.length} changed files from remote repo`, { repoUrl });
      
      return changedFiles;
    } catch (error) {
      logger.error('Failed to clone/diff remote repo:', error);
      return null;
    } finally {
      // Cleanup temp directory
      try {
        execSync(`rm -rf ${tempDir}`, { encoding: 'utf-8' });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export const smartSelectService = new SmartSelectService();
export default smartSelectService;
