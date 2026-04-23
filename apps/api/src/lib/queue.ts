import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CANCEL_CHANNEL = 'visiontest:cancel';

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

// Redis client for pub/sub cancellation
const redisPubsub = new Redis(REDIS_URL);

export const testExecutionQueue = new Queue('test-execution', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

testExecutionQueue.on('error', (err) => {
  logger.error({ err }, 'Queue connection error');
});

export interface ExecutionJobData {
  executionId: string;
  projectId: string;
  testId?: string;
  suiteId?: string;
  config?: Record<string, unknown>;
  checkpointId?: string;
  platform?: string;
  deviceProfileId?: string;
}

export async function queueExecution(data: ExecutionJobData): Promise<string> {
  const job = await testExecutionQueue.add('run-test', data, {
    jobId: data.executionId,
  });
  logger.info({ jobId: job.id, executionId: data.executionId }, 'Queued execution job');
  return job.id!;
}

export interface ScanJobData {
  executionId: string;
  projectId: string;
  startUrl: string;
  maxPages?: number;
  maxClicksPerPage?: number;
  loginSteps?: unknown[];
  safety?: {
    mode?: 'read-only' | 'allow-destructive' | 'sandbox';
    destructivePhrases?: string[];
    allowedSelectors?: string[];
    blockedSelectors?: string[];
    allowFormSubmit?: boolean;
    stubNetworkWrites?: boolean;
    resetHookUrl?: string | null;
  };
}

/**
 * Queue an exploratory-scan job (Phase 2). Same queue as test-execution
 * so one worker pool serves both — the `scan` job name routes it through
 * the scan processor in the worker.
 */
export async function queueScan(data: ScanJobData): Promise<string> {
  const job = await testExecutionQueue.add('scan', data, {
    jobId: data.executionId,
  });
  logger.info(
    { jobId: job.id, executionId: data.executionId },
    'Queued scan job',
  );
  return job.id!;
}

export interface RecomparisonJobData {
  comparisonId: string;
  executionId: string;
  baselineId: string;
  screenshotId?: string;
  maskIds: string[];
}

/**
 * Queue a re-comparison job with masks applied
 */
export async function queueRecomparison(data: RecomparisonJobData): Promise<string> {
  const job = await testExecutionQueue.add('recompare', data, {
    jobId: `recompare-${data.comparisonId}`,
  });
  logger.info({ jobId: job.id, comparisonId: data.comparisonId }, 'Queued recomparison job');
  return job.id!;
}

/**
 * Cancel an execution by removing the job from queue or signaling the worker
 */
export async function cancelExecution(executionId: string): Promise<boolean> {
  try {
    // Try to remove the job if it's still in the queue (waiting state)
    const job = await testExecutionQueue.getJob(executionId);
    
    if (job) {
      const state = await job.getState();
      
      if (state === 'waiting' || state === 'delayed') {
        // Job hasn't started yet, just remove it
        await job.remove();
        logger.info({ executionId }, 'Cancelled queued execution job');
        return true;
      }
      
      if (state === 'active') {
        // Job is currently running, signal worker to stop via pub/sub
        await redisPubsub.publish(CANCEL_CHANNEL, JSON.stringify({
          type: 'cancel',
          executionId,
          timestamp: Date.now(),
        }));
        logger.info({ executionId }, 'Sent cancellation signal for active execution');
        return true;
      }
    }
    
    // Job not found or already completed
    logger.warn({ executionId }, 'Execution not found or already completed');
    return false;
  } catch (error) {
    logger.error({ executionId, error }, 'Failed to cancel execution');
    throw error;
  }
}
