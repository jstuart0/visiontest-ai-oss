import { PrismaClient } from '@prisma/client';

/**
 * Incrementally update impact mappings after a test execution.
 * Adjusts confidence based on pass/fail correlation.
 */
export async function updateImpactMappings(
  prisma: PrismaClient,
  executionId: string
): Promise<{ updated: number; created: number }> {
  // Load the execution with its tests and covered files
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      test: {
        select: {
          id: true,
          projectId: true,
          coveredFiles: true,
        },
      },
    },
  });

  if (!execution?.test?.projectId) return { updated: 0, created: 0 };

  const { projectId } = execution.test;
  const coveredFiles = (execution.test.coveredFiles || []) as string[];
  if (coveredFiles.length === 0) return { updated: 0, created: 0 };

  const testId = execution.test.id;
  const passed = execution.status === 'PASSED';
  let updated = 0;
  let created = 0;

  for (const filePath of coveredFiles) {
    const existing = await prisma.impactMapping.findUnique({
      where: { projectId_filePath: { projectId, filePath } },
    });

    if (existing) {
      // Update confidence: increase for pass, decrease for fail
      const currentTests = existing.tests as string[];
      const testsSet = new Set(currentTests);
      testsSet.add(testId);

      const confidenceAdjustment = passed ? 0.02 : -0.05;
      const newConfidence = Math.max(0.1, Math.min(1.0, existing.confidence + confidenceAdjustment));

      await prisma.impactMapping.update({
        where: { id: existing.id },
        data: {
          tests: Array.from(testsSet),
          confidence: newConfidence,
        },
      });
      updated++;
    } else {
      await prisma.impactMapping.create({
        data: {
          projectId,
          filePath,
          components: [],
          tests: [testId],
          confidence: passed ? 0.7 : 0.3,
        },
      });
      created++;
    }
  }

  return { updated, created };
}

/**
 * Decay confidence for stale mappings not confirmed by recent executions.
 */
export async function decayStaleConfidence(
  prisma: PrismaClient,
  projectId: string,
  staleDays: number = 30,
  decayFactor: number = 0.9
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const stale = await prisma.impactMapping.findMany({
    where: {
      projectId,
      updatedAt: { lt: cutoff },
      confidence: { gt: 0.1 },
    },
  });

  let decayed = 0;
  for (const mapping of stale) {
    await prisma.impactMapping.update({
      where: { id: mapping.id },
      data: { confidence: Math.max(0.1, mapping.confidence * decayFactor) },
    });
    decayed++;
  }

  return decayed;
}
