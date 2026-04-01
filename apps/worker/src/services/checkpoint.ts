// VisionTest AI - Checkpoint Service
// Saves and restores test execution state for replay-from-failure

import { Client } from 'minio';
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
const CHECKPOINT_BUCKET = process.env.CHECKPOINT_BUCKET || 'visiontest-checkpoints';

export interface CheckpointState {
  url: string;
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  viewportSize?: { width: number; height: number };
  timestamp?: number;
}

export interface CheckpointMetadata {
  executionId: string;
  testId?: string;
  stepNumber: number;
  stepType: string;
  createdAt: string;
}

export class CheckpointService {
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
      const exists = await this.client.bucketExists(CHECKPOINT_BUCKET);
      if (!exists) {
        await this.client.makeBucket(CHECKPOINT_BUCKET);
        logger.info(`Created bucket: ${CHECKPOINT_BUCKET}`);
      }
    } catch (error) {
      logger.error('Failed to ensure checkpoint bucket exists:', error);
    }
  }

  /**
   * Save a checkpoint (uses upsert to handle duplicate step numbers)
   */
  async save(executionId: string, stepNumber: number, state: CheckpointState): Promise<string> {
    try {
      const id = uuid();
      const key = `${executionId}/${stepNumber}-${id}.json`;
      
      const stateWithMeta = {
        ...state,
        timestamp: Date.now(),
      };

      const buffer = Buffer.from(JSON.stringify(stateWithMeta));
      
      await this.client.putObject(CHECKPOINT_BUCKET, key, buffer, {
        'Content-Type': 'application/json',
      });

      // Use upsert to handle unique constraint on (executionId, stepNumber)
      const checkpoint = await prisma.checkpoint.upsert({
        where: {
          executionId_stepNumber: {
            executionId,
            stepNumber,
          },
        },
        update: {
          state: stateWithMeta,
          storageKey: key,
        },
        create: {
          executionId,
          stepNumber,
          state: stateWithMeta,
          storageKey: key,
        },
      });

      logger.info(`Checkpoint saved: ${checkpoint.id}`, { step: stepNumber });
      return checkpoint.id;
    } catch (error) {
      logger.error('Failed to save checkpoint:', error);
      throw error;
    }
  }

  /**
   * Load a checkpoint
   */
  async load(checkpointId: string): Promise<CheckpointState | null> {
    try {
      const checkpoint = await prisma.checkpoint.findUnique({
        where: { id: checkpointId },
      });

      if (!checkpoint) {
        return null;
      }

      // If state is stored directly in DB
      if (checkpoint.state && typeof checkpoint.state === 'object') {
        return checkpoint.state as unknown as CheckpointState;
      }

      // Otherwise, fetch from object storage
      if (checkpoint.storageKey) {
        const stream = await this.client.getObject(CHECKPOINT_BUCKET, checkpoint.storageKey);
        
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => {
            const data = Buffer.concat(chunks).toString('utf-8');
            resolve(JSON.parse(data));
          });
          stream.on('error', reject);
        });
      }

      return null;
    } catch (error) {
      logger.error('Failed to load checkpoint:', error);
      throw error;
    }
  }

  /**
   * List checkpoints for an execution
   */
  async listForExecution(executionId: string): Promise<Array<{
    id: string;
    stepNumber: number;
    createdAt: Date;
  }>> {
    const checkpoints = await prisma.checkpoint.findMany({
      where: { executionId },
      orderBy: { stepNumber: 'asc' },
      select: {
        id: true,
        stepNumber: true,
        createdAt: true,
      },
    });

    return checkpoints;
  }

  /**
   * Get the latest checkpoint before a step
   */
  async getLatestBefore(executionId: string, stepNumber: number): Promise<{
    id: string;
    stepNumber: number;
    state: CheckpointState;
  } | null> {
    const checkpoint = await prisma.checkpoint.findFirst({
      where: {
        executionId,
        stepNumber: { lt: stepNumber },
      },
      orderBy: { stepNumber: 'desc' },
    });

    if (!checkpoint) {
      return null;
    }

    const state = await this.load(checkpoint.id);
    if (!state) {
      return null;
    }

    return {
      id: checkpoint.id,
      stepNumber: checkpoint.stepNumber,
      state,
    };
  }

  /**
   * Delete checkpoints for an execution
   */
  async deleteForExecution(executionId: string): Promise<number> {
    const checkpoints = await prisma.checkpoint.findMany({
      where: { executionId },
      select: { id: true, storageKey: true },
    });

    // Delete from object storage
    for (const cp of checkpoints) {
      if (cp.storageKey) {
        try {
          await this.client.removeObject(CHECKPOINT_BUCKET, cp.storageKey);
        } catch (error) {
          logger.warn(`Failed to delete checkpoint object: ${cp.storageKey}`, error);
        }
      }
    }

    // Delete from database
    const result = await prisma.checkpoint.deleteMany({
      where: { executionId },
    });

    logger.info(`Deleted ${result.count} checkpoints for execution ${executionId}`);
    return result.count;
  }

  /**
   * Cleanup old checkpoints (retention policy)
   */
  async cleanupOld(retentionDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const oldCheckpoints = await prisma.checkpoint.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
    });

    // Delete from object storage
    for (const cp of oldCheckpoints) {
      if (cp.storageKey) {
        try {
          await this.client.removeObject(CHECKPOINT_BUCKET, cp.storageKey);
        } catch (error) {
          // Ignore errors for missing objects
        }
      }
    }

    // Delete from database
    const result = await prisma.checkpoint.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    logger.info(`Cleaned up ${result.count} old checkpoints`);
    return result.count;
  }
}
