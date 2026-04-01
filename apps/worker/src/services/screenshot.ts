// VisionTest AI - Screenshot Service
// Handles screenshot capture, storage, and comparison

import { Client } from 'minio';
import Jimp from 'jimp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { prisma } from '@visiontest/database';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const SCREENSHOT_BUCKET = process.env.SCREENSHOT_BUCKET || 'visiontest-screenshots';

export interface ComparisonResult {
  diffPixels: number;
  diffPercent: number;
  dimensions: { width: number; height: number };
  diffImageUrl?: string;
}

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ScreenshotService {
  private client: Client;

  constructor() {
    this.client = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });

    this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(SCREENSHOT_BUCKET);
      if (!exists) {
        await this.client.makeBucket(SCREENSHOT_BUCKET);
        logger.info(`Created bucket: ${SCREENSHOT_BUCKET}`);
      }
    } catch (error) {
      logger.error('Failed to ensure bucket exists:', error);
    }
  }

  /**
   * Save a screenshot to object storage
   */
  async save(executionId: string, stepNumber: number, screenshot: Buffer): Promise<string> {
    const filename = `${stepNumber}-${uuid()}.png`;
    const key = `${executionId}/${filename}`;
    
    await this.client.putObject(SCREENSHOT_BUCKET, key, screenshot, {
      'Content-Type': 'image/png',
    });

    // Return API proxy URL instead of direct MinIO URL
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
    const url = `${apiBaseUrl}/screenshots/${executionId}/${filename}`;
    
    logger.info(`Screenshot saved: ${key}`);
    return url;
  }

  /**
   * Save a screenshot and create database record
   */
  async saveWithRecord(
    executionId: string,
    stepNumber: number,
    screenshot: Buffer,
    metadata: {
      name: string;
      viewport?: { width: number; height: number };
      deviceId?: string;
    }
  ): Promise<string> {
    const url = await this.save(executionId, stepNumber, screenshot);
    
    // Get image dimensions
    const image = PNG.sync.read(screenshot);
    
    // Create database record
    await prisma.screenshot.create({
      data: {
        executionId,
        name: metadata.name,
        url,
        stepNumber,
        width: image.width,
        height: image.height,
        deviceId: metadata.deviceId,
        metadata: {
          viewport: metadata.viewport,
          capturedAt: new Date().toISOString(),
        },
      },
    });

    return url;
  }

  /**
   * Compare two screenshots
   */
  async compare(
    baselineBuffer: Buffer,
    currentBuffer: Buffer,
    masks: MaskRegion[] = [],
    threshold: number = 0.1
  ): Promise<ComparisonResult> {
    const baseline = PNG.sync.read(baselineBuffer);
    const current = PNG.sync.read(currentBuffer);

    // Check dimensions match
    if (baseline.width !== current.width || baseline.height !== current.height) {
      // Resize current to match baseline
      logger.warn('Image dimensions mismatch, resizing...');
      
      const resized = await Jimp.read(currentBuffer);
      resized.resize(baseline.width, baseline.height);
      const resizedBuffer = await resized.getBufferAsync(Jimp.MIME_PNG);
      return this.compare(baselineBuffer, resizedBuffer, masks, threshold);
    }

    // Apply masks
    if (masks.length > 0) {
      this.applyMasks(baseline, masks);
      this.applyMasks(current, masks);
    }

    // Create diff image
    const diff = new PNG({ width: baseline.width, height: baseline.height });

    const diffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      baseline.width,
      baseline.height,
      { threshold }
    );

    const totalPixels = baseline.width * baseline.height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    // Save diff image if there are differences
    let diffImageUrl: string | undefined;
    if (diffPixels > 0) {
      const diffBuffer = PNG.sync.write(diff);
      diffImageUrl = await this.save('diffs', Date.now(), diffBuffer);
    }

    return {
      diffPixels,
      diffPercent: Math.round(diffPercent * 100) / 100,
      dimensions: { width: baseline.width, height: baseline.height },
      diffImageUrl,
    };
  }

  /**
   * Apply mask regions to an image (black out areas)
   */
  private applyMasks(image: PNG, masks: MaskRegion[]): void {
    for (const mask of masks) {
      for (let y = mask.y; y < mask.y + mask.height && y < image.height; y++) {
        for (let x = mask.x; x < mask.x + mask.width && x < image.width; x++) {
          const idx = (image.width * y + x) << 2;
          // Set to black
          image.data[idx] = 0;
          image.data[idx + 1] = 0;
          image.data[idx + 2] = 0;
          image.data[idx + 3] = 255;
        }
      }
    }
  }

  /**
   * Get a screenshot from storage
   */
  async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(SCREENSHOT_BUCKET, key);
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Delete a screenshot
   */
  async delete(key: string): Promise<void> {
    await this.client.removeObject(SCREENSHOT_BUCKET, key);
    logger.info(`Screenshot deleted: ${key}`);
  }

  /**
   * Generate a presigned URL for direct browser access
   */
  async getPresignedUrl(key: string, expirySeconds: number = 3600): Promise<string> {
    return this.client.presignedGetObject(SCREENSHOT_BUCKET, key, expirySeconds);
  }

  /**
   * Process baseline comparison and create comparison record
   */
  async processComparison(
    executionId: string,
    screenshotId: string,
    baselineId: string
  ): Promise<{
    comparisonId: string;
    status: 'PASSED' | 'DIFF_DETECTED' | 'NEW_BASELINE';
    diffPercent: number;
  }> {
    const screenshot = await prisma.screenshot.findUnique({ where: { id: screenshotId } });
    const baseline = await prisma.baseline.findUnique({ where: { id: baselineId } });

    if (!screenshot || !baseline) {
      throw new Error('Screenshot or baseline not found');
    }

    // Get masks for this baseline
    const masks = await prisma.ignoreMask.findMany({
      where: { baselineId: baseline.id },
    });

    // Parse mask values (stored as JSON strings)
    const maskRegions: MaskRegion[] = masks
      .filter((m) => m.type === 'RECTANGLE' && m.isActive)
      .map((m) => {
        const value = typeof m.value === 'string' ? JSON.parse(m.value) : m.value;
        return {
          x: value.x || 0,
          y: value.y || 0,
          width: value.width || 0,
          height: value.height || 0,
        };
      })
      .filter((r) => r.width > 0 && r.height > 0);

    // Get image buffers
    const screenshotKey = new URL(screenshot.url).pathname.replace(`/${SCREENSHOT_BUCKET}/`, '');
    const currentBuffer = await this.get(screenshotKey);

    // Get baseline screenshots
    const baselineScreenshots = JSON.parse(baseline.screenshots as string);
    const matchingBaseline = baselineScreenshots.find(
      (bs: { name: string }) => bs.name === screenshot.name
    );

    if (!matchingBaseline) {
      // New screenshot - no baseline exists
      const comparison = await prisma.comparison.create({
        data: {
          executionId,
          baselineId,
          screenshotId,
          status: 'PENDING', // New baselines need review
          diffScore: 0,
          metadata: { isNew: true },
        },
      });

      return {
        comparisonId: comparison.id,
        status: 'NEW_BASELINE',
        diffPercent: 0,
      };
    }

    // Get baseline buffer
    const baselineKey = new URL(matchingBaseline.url).pathname.replace(`/${SCREENSHOT_BUCKET}/`, '');
    const baselineBuffer = await this.get(baselineKey);

    // Compare
    const result = await this.compare(baselineBuffer, currentBuffer, maskRegions);

    // Determine status
    const status = result.diffPercent > 0 ? 'DIFF_DETECTED' : 'PASSED';

    // Create comparison record
    const comparison = await prisma.comparison.create({
      data: {
        executionId,
        baselineId,
        screenshotId,
        status: status === 'DIFF_DETECTED' ? 'PENDING' : 'AUTO_APPROVED',
        diffScore: result.diffPercent,
        diffUrl: result.diffImageUrl,
        masksApplied: masks.length,
        metadata: {
          diffPixels: result.diffPixels,
          dimensions: result.dimensions,
        },
      },
    });

    logger.info(`Comparison created: ${comparison.id}`, {
      status,
      diffPercent: result.diffPercent,
    });

    return {
      comparisonId: comparison.id,
      status,
      diffPercent: result.diffPercent,
    };
  }
}
