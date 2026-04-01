// VisionTest AI - Visual Diff Service
// Runs pixelmatch comparisons between screenshots and baselines

import { Client as MinioClient } from 'minio';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { prisma } from '@visiontest/database';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const SCREENSHOT_BUCKET = process.env.SCREENSHOT_BUCKET || 'visiontest-screenshots';

const minioClient = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

// =============================================================================
// TYPES
// =============================================================================

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageComparisonResult {
  diffPixels: number;
  diffPercent: number;
  dimensions: { width: number; height: number };
  diffImageBuffer?: Buffer;
}

export interface ComparisonSummary {
  executionId: string;
  baselineId: string;
  baselineName: string;
  total: number;
  matched: number;
  diffDetected: number;
  newScreenshots: number;
  comparisons: Array<{
    comparisonId: string;
    screenshotName: string;
    diffPercent: number;
    status: string;
  }>;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract MinIO object key from a screenshot URL.
 * URLs can be:
 *   - /api/v1/screenshots/{executionId}/{filename}
 *   - {executionId}/{filename} (raw key)
 */
function extractObjectKey(url: string): string {
  // If it starts with /api/v1/screenshots/, strip the prefix
  const apiPrefix = '/api/v1/screenshots/';
  if (url.startsWith(apiPrefix)) {
    return url.slice(apiPrefix.length);
  }
  // If it contains the full URL with host
  const match = url.match(/\/screenshots\/(.+)$/);
  if (match) {
    return match[1];
  }
  // Already a raw key
  return url;
}

/**
 * Download an object from MinIO as a Buffer.
 */
async function getObjectBuffer(key: string): Promise<Buffer> {
  const stream = await minioClient.getObject(SCREENSHOT_BUCKET, key);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Upload a buffer to MinIO and return the object key.
 */
async function uploadBuffer(key: string, buffer: Buffer, contentType = 'image/png'): Promise<string> {
  await minioClient.putObject(SCREENSHOT_BUCKET, key, buffer, buffer.length, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000',
  });
  return key;
}

// =============================================================================
// CORE COMPARISON
// =============================================================================

/**
 * Compare two PNG image buffers using pixelmatch.
 */
export function compareImages(
  baselineBuffer: Buffer,
  currentBuffer: Buffer,
  masks: MaskRegion[] = [],
  threshold: number = 0.1
): ImageComparisonResult {
  const baseline = PNG.sync.read(baselineBuffer);
  const current = PNG.sync.read(currentBuffer);

  // If dimensions don't match, report 100% diff
  if (baseline.width !== current.width || baseline.height !== current.height) {
    logger.warn(
      `Dimension mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`
    );
    // Use the larger dimensions for the diff image
    const width = Math.max(baseline.width, current.width);
    const height = Math.max(baseline.height, current.height);
    return {
      diffPixels: width * height,
      diffPercent: 100,
      dimensions: { width, height },
    };
  }

  // Apply masks (black out regions)
  if (masks.length > 0) {
    applyMasks(baseline, masks);
    applyMasks(current, masks);
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });

  const diffPixels = pixelmatch(
    baseline.data as unknown as Uint8Array,
    current.data as unknown as Uint8Array,
    diff.data as unknown as Uint8Array,
    baseline.width,
    baseline.height,
    { threshold }
  );

  const totalPixels = baseline.width * baseline.height;
  const diffPercent = Math.round((diffPixels / totalPixels) * 10000) / 100;

  return {
    diffPixels,
    diffPercent,
    dimensions: { width: baseline.width, height: baseline.height },
    diffImageBuffer: diffPixels > 0 ? PNG.sync.write(diff) : undefined,
  };
}

function applyMasks(image: PNG, masks: MaskRegion[]): void {
  for (const mask of masks) {
    for (let y = mask.y; y < mask.y + mask.height && y < image.height; y++) {
      for (let x = mask.x; x < mask.x + mask.width && x < image.width; x++) {
        const idx = (image.width * y + x) << 2;
        image.data[idx] = 0;
        image.data[idx + 1] = 0;
        image.data[idx + 2] = 0;
        image.data[idx + 3] = 255;
      }
    }
  }
}

// =============================================================================
// EXECUTION-LEVEL COMPARISON
// =============================================================================

/**
 * Run visual comparisons for all screenshots in an execution against matching baselines.
 *
 * @param executionId - The execution whose screenshots to compare
 * @param explicitBaselineName - Optional: explicit baseline name to match against
 * @returns Summary of all comparisons created
 */
export async function runComparisonsForExecution(
  executionId: string,
  explicitBaselineName?: string
): Promise<ComparisonSummary | null> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      screenshots: true,
      project: true,
    },
  });

  if (!execution) {
    logger.error(`Execution not found: ${executionId}`);
    return null;
  }

  if (execution.screenshots.length === 0) {
    logger.warn(`No screenshots in execution ${executionId}`);
    return null;
  }

  const metadata = execution.metadata as Record<string, any> || {};

  // Find matching baseline
  const baselineName = explicitBaselineName
    || metadata.baselineName
    || metadata.suiteName
    || metadata.testName
    || 'VRT Baseline';

  const branch = metadata.branch || 'main';

  logger.info(`Looking for baseline: name="${baselineName}", branch="${branch}", project="${execution.projectId}"`);

  let baseline = await prisma.baseline.findFirst({
    where: {
      projectId: execution.projectId,
      name: baselineName,
      branch,
    },
  });

  // Fall back: try testName if suiteName didn't match
  if (!baseline && metadata.suiteName && metadata.testName) {
    baseline = await prisma.baseline.findFirst({
      where: {
        projectId: execution.projectId,
        name: metadata.testName,
        branch,
      },
    });
  }

  // Fall back: try any baseline for this project on this branch
  if (!baseline) {
    baseline = await prisma.baseline.findFirst({
      where: {
        projectId: execution.projectId,
        branch,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!baseline) {
    logger.warn(`No baseline found for project ${execution.projectId}, branch ${branch}`);
    return null;
  }

  const baselineScreenshots: Array<{ name: string; url: string; width: number; height: number }> =
    JSON.parse(baseline.screenshots as string);

  logger.info(`Found baseline "${baseline.name}" with ${baselineScreenshots.length} screenshots`);

  // Get masks for this baseline
  const masks = await prisma.ignoreMask.findMany({
    where: {
      baselineId: baseline.id,
      isActive: true,
      type: 'RECTANGLE',
    },
  });

  const maskRegions: MaskRegion[] = masks.map((m) => {
    const value = typeof m.value === 'string' ? JSON.parse(m.value) : m.value;
    return { x: value.x || 0, y: value.y || 0, width: value.width || 0, height: value.height || 0 };
  }).filter((r) => r.width > 0 && r.height > 0);

  const summary: ComparisonSummary = {
    executionId,
    baselineId: baseline.id,
    baselineName: baseline.name,
    total: execution.screenshots.length,
    matched: 0,
    diffDetected: 0,
    newScreenshots: 0,
    comparisons: [],
  };

  // Compare each screenshot against the baseline
  for (const screenshot of execution.screenshots) {
    const matchingBaseline = baselineScreenshots.find((bs) => bs.name === screenshot.name);

    if (!matchingBaseline) {
      // New screenshot — no baseline to compare against
      const comparison = await prisma.comparison.create({
        data: {
          executionId,
          baselineId: baseline.id,
          screenshotId: screenshot.id,
          status: 'PENDING',
          diffScore: 0,
          metadata: { isNew: true, screenshotName: screenshot.name },
        },
      });

      summary.newScreenshots++;
      summary.comparisons.push({
        comparisonId: comparison.id,
        screenshotName: screenshot.name,
        diffPercent: 0,
        status: 'NEW',
      });

      logger.info(`New screenshot (no baseline): ${screenshot.name}`);
      continue;
    }

    try {
      // Download both images from MinIO
      const currentKey = extractObjectKey(screenshot.url);
      const baselineKey = extractObjectKey(matchingBaseline.url);

      const [currentBuffer, baselineBuffer] = await Promise.all([
        getObjectBuffer(currentKey),
        getObjectBuffer(baselineKey),
      ]);

      // Run pixelmatch comparison
      const result = compareImages(baselineBuffer, currentBuffer, maskRegions);

      // Upload diff image if there are differences
      let diffUrl: string | null = null;
      if (result.diffImageBuffer) {
        const diffKey = `diffs/${executionId}/${randomUUID()}.png`;
        await uploadBuffer(diffKey, result.diffImageBuffer);
        diffUrl = `/api/v1/screenshots/${diffKey}`;
      }

      // Determine status
      const status = result.diffPercent === 0 ? 'AUTO_APPROVED' : 'PENDING';

      // Create comparison record
      const comparison = await prisma.comparison.create({
        data: {
          executionId,
          baselineId: baseline.id,
          screenshotId: screenshot.id,
          status,
          diffScore: result.diffPercent,
          diffUrl,
          masksApplied: maskRegions.length,
          metadata: {
            diffPixels: result.diffPixels,
            dimensions: result.dimensions,
            screenshotName: screenshot.name,
          },
        },
      });

      if (result.diffPercent === 0) {
        summary.matched++;
      } else {
        summary.diffDetected++;
      }

      summary.comparisons.push({
        comparisonId: comparison.id,
        screenshotName: screenshot.name,
        diffPercent: result.diffPercent,
        status: result.diffPercent === 0 ? 'MATCHED' : 'DIFF_DETECTED',
      });

      logger.info(`Compared ${screenshot.name}: ${result.diffPercent}% diff (${status})`);
    } catch (error) {
      logger.error(`Failed to compare screenshot ${screenshot.name}:`, error);

      // Create a failed comparison record
      const comparison = await prisma.comparison.create({
        data: {
          executionId,
          baselineId: baseline.id,
          screenshotId: screenshot.id,
          status: 'PENDING',
          diffScore: -1,
          metadata: {
            error: (error as Error).message,
            screenshotName: screenshot.name,
          },
        },
      });

      summary.comparisons.push({
        comparisonId: comparison.id,
        screenshotName: screenshot.name,
        diffPercent: -1,
        status: 'ERROR',
      });
    }
  }

  logger.info(
    `Comparison complete for execution ${executionId}: ` +
    `${summary.matched} matched, ${summary.diffDetected} diffs, ${summary.newScreenshots} new`
  );

  return summary;
}

export default { compareImages, runComparisonsForExecution };
