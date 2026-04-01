// VisionTest AI - Test Execution Worker
// Hospital-Grade Test Execution Engine

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma, ExecutionStatus, FlakyStatus, type Prisma, syncStorybook, updateImpactMappings } from '@visiontest/database';
import { TestRunner } from './services/testRunner';
import { MobileTestRunner } from './services/mobileTestRunner';
import { ScreenshotService } from './services/screenshot';
import { MobileScreenshotService } from './services/mobileScreenshot';
import { VideoService } from './services/video';
import { HealingService } from './services/healing';
import { CheckpointService } from './services/checkpoint';
import { DeviceManager } from './services/deviceManager';
import { FixOrchestrator } from './services/fixOrchestrator';
import { ApiTestExecutor } from './services/apiTestExecutor';
import { AiDiffPipeline } from './services/aiDiffPipeline';
import { EmbeddingsClient } from './services/embeddingsClient';
import { logger } from './utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2');
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const PUBSUB_CHANNEL = 'visiontest:executions';

// =============================================================================
// REDIS CONNECTION
// =============================================================================

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Separate connection for pub/sub (Redis requires dedicated connection for publishing)
const redisPubsub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis');
});

redisConnection.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

// =============================================================================
// REAL-TIME PROGRESS PUBLISHING
// =============================================================================

/**
 * Publish execution progress via Redis pub/sub for real-time updates
 */
async function publishProgress(executionId: string, data: {
  type: string;
  executionId: string;
  testIndex?: number;
  stepIndex?: number;
  total?: number;
  status?: string;
  error?: string;
  screenshot?: string;
  duration?: number;
  timestamp: number;
}): Promise<void> {
  try {
    await redisPubsub.publish(PUBSUB_CHANNEL, JSON.stringify({
      ...data,
      workerId: WORKER_ID,
    }));
  } catch (error) {
    logger.warn('Failed to publish progress:', error);
  }
}

/**
 * Publish execution status change
 */
async function publishStatusChange(executionId: string, status: ExecutionStatus, error?: string): Promise<void> {
  await publishProgress(executionId, {
    type: 'execution:status',
    executionId,
    status,
    error,
    timestamp: Date.now(),
  });
}

// =============================================================================
// SERVICES
// =============================================================================

const testRunner = new TestRunner();
const mobileTestRunner = new MobileTestRunner();
const screenshotService = new ScreenshotService();
const mobileScreenshotService = new MobileScreenshotService();
const videoService = new VideoService();
const healingService = new HealingService();
const checkpointService = new CheckpointService();
const fixOrchestrator = new FixOrchestrator(redisPubsub);
const apiTestExecutor = new ApiTestExecutor(redisPubsub);
const deviceManager = new DeviceManager();

// =============================================================================
// JOB PROCESSOR
// =============================================================================

async function processTestExecution(job: Job) {
  const { executionId, testId, suiteId, config, replayFrom, platform, deviceProfileId } = job.data;

  logger.info(`Processing execution: ${executionId}`, {
    testId,
    suiteId,
    workerId: WORKER_ID,
  });

  try {
    // Update status to running
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Get test(s) to run
    let tests;
    if (testId) {
      const test = await prisma.test.findUnique({
        where: { id: testId },
        include: { project: true },
      });
      tests = test ? [test] : [];
    } else if (suiteId) {
      tests = await prisma.test.findMany({
        where: { suiteId, status: 'ACTIVE' },
        include: { project: true },
      });
    }

    if (!tests || tests.length === 0) {
      throw new Error('No tests found to execute');
    }

    // Determine platform from execution, test, or job data
    const executionPlatform = platform || tests[0]?.platform || 'WEB';

    // Fetch device profile if specified
    let deviceProfile: Prisma.DeviceProfileGetPayload<{}> | null = null;
    const dpId = deviceProfileId || tests[0]?.deviceProfileId;
    if (dpId) {
      deviceProfile = await prisma.deviceProfile.findUnique({
        where: { id: dpId },
      });
    }

    // Route to mobile runner for native IOS/ANDROID tests
    if (executionPlatform === 'IOS' || executionPlatform === 'ANDROID') {
      const mobileResults = await mobileTestRunner.runTests(tests, {
        executionId,
        platform: executionPlatform as 'IOS' | 'ANDROID',
        deviceProfile: deviceProfile ? {
          name: deviceProfile.name,
          width: deviceProfile.width,
          height: deviceProfile.height,
          scaleFactor: deviceProfile.scaleFactor,
          osVersion: deviceProfile.osVersion || undefined,
          isEmulator: deviceProfile.isEmulator,
          config: deviceProfile.config as Record<string, unknown>,
        } : undefined,
        onProgress: async (progress) => {
          job.updateProgress(progress);
          await publishProgress(executionId, {
            type: 'step:start',
            executionId,
            stepIndex: progress.stepIndex,
            total: progress.total,
            timestamp: Date.now(),
          });
        },
        onStepComplete: async (stepIndex, duration) => {
          await publishProgress(executionId, {
            type: 'step:complete',
            executionId,
            stepIndex,
            timestamp: Date.now(),
          });
        },
        onStepFailed: async (stepIndex, error) => {
          await publishProgress(executionId, {
            type: 'step:failed',
            executionId,
            stepIndex,
            error,
            timestamp: Date.now(),
          });
        },
        onScreenshot: async (stepNumber, screenshot) => {
          await mobileScreenshotService.processAndStore(screenshot, {
            executionId,
            stepNumber,
            name: `step-${stepNumber}`,
            platform: executionPlatform as 'IOS' | 'ANDROID',
            deviceName: deviceProfile?.name,
            deviceProfileId: deviceProfile?.id,
            scaleFactor: deviceProfile?.scaleFactor,
          });
        },
      });

      // Process mobile results
      const passed = mobileResults.filter(r => r.status === 'passed').length;
      const failed = mobileResults.filter(r => r.status === 'failed').length;
      const skipped = mobileResults.filter(r => r.status === 'skipped').length;
      const totalDuration = mobileResults.reduce((sum, r) => sum + r.duration, 0);
      const finalStatus: ExecutionStatus = failed > 0 ? 'FAILED' : 'PASSED';

      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          duration: totalDuration,
          platform: executionPlatform,
          deviceProfileId: deviceProfile?.id,
          result: { passed, failed, skipped, total: mobileResults.length, steps: mobileResults } as unknown as Prisma.InputJsonValue,
        },
      });

      await publishStatusChange(executionId, finalStatus);
      logger.info(`Mobile execution completed: ${executionId}`, { status: finalStatus, platform: executionPlatform });
      return { status: finalStatus, results: mobileResults };
    }

    // Resolve execution settings from test config and project settings
    const testConfig = (tests[0]?.config || {}) as Record<string, any>;
    const projectSettings = (tests[0]?.project?.settings || {}) as Record<string, any>;
    const autoScreenshot = testConfig.screenshotEveryStep ?? projectSettings.screenshotEveryStep ?? false;
    const recordVideo = testConfig.videoRecording ?? projectSettings.videoRecording ?? false;
    const enableLiveStream = config?.browser !== 'firefox' && config?.browser !== 'webkit';

    // Attach AIService for LLM-powered self-healing (optional)
    try {
      const { AIService } = await import('./services/aiService');
      const aiService = new AIService();
      const projectId = tests[0]?.projectId || tests[0]?.project?.id;
      if (projectId) {
        await aiService.loadConfig(projectId);
        if (aiService.isAvailable()) {
          testRunner.setAIService(aiService);
        }
      }
    } catch {
      // AI service not available, LLM healing will be skipped
    }

    // Throttle for live stream frames (max 5fps)
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 200; // 5fps

    // Run web tests (WEB or MOBILE_WEB)
    const results = await testRunner.runTests(tests, {
      executionId,
      config,
      platform: executionPlatform as 'WEB' | 'MOBILE_WEB',
      deviceProfile: deviceProfile ? {
        name: deviceProfile.name,
        width: deviceProfile.width,
        height: deviceProfile.height,
        scaleFactor: deviceProfile.scaleFactor,
        userAgent: deviceProfile.userAgent || undefined,
      } : undefined,
      mobileWebDevice: deviceProfile?.name?.replace(' (Mobile Web)', ''),
      replayFrom,
      autoScreenshot,
      recordVideo,
      enableLiveStream,
      onVideoReady: async (videoPath) => {
        try {
          await videoService.save(executionId, videoPath);
          await publishProgress(executionId, {
            type: 'video:ready',
            executionId,
            timestamp: Date.now(),
          });
          logger.info(`Video saved for execution: ${executionId}`);
        } catch (error) {
          logger.error('Failed to save video:', error);
        }
      },
      onFrame: async (frameData) => {
        const now = Date.now();
        if (now - lastFrameTime < FRAME_INTERVAL) return;
        lastFrameTime = now;
        try {
          await redisPubsub.publish(
            `visiontest:stream:${executionId}`,
            frameData
          );
        } catch {
          // Ignore frame publish errors
        }
      },
      onProgress: async (progress) => {
        job.updateProgress(progress);
        logger.info(`Step ${progress.stepIndex + 1}/${progress.total} starting`);
        
        // Publish step:start event
        await publishProgress(executionId, {
          type: 'step:start',
          executionId,
          stepIndex: progress.stepIndex,
          total: progress.total,
          timestamp: Date.now(),
        });
      },
      onStepComplete: async (stepIndex, duration) => {
        logger.info(`Step ${stepIndex + 1} completed in ${duration}ms`);
        // Publish step:complete event
        await publishProgress(executionId, {
          type: 'step:complete',
          executionId,
          stepIndex,
          duration,
          timestamp: Date.now(),
        });
      },
      onStepFailed: async (stepIndex, error) => {
        // Publish step:failed event
        await publishProgress(executionId, {
          type: 'step:failed',
          executionId,
          stepIndex,
          error,
          timestamp: Date.now(),
        });
      },
      onScreenshot: async (stepNumber, screenshot) => {
        // Use saveWithRecord to create both MinIO object AND database record
        const url = await screenshotService.saveWithRecord(executionId, stepNumber, screenshot, {
          name: `step-${stepNumber}`,
          viewport: config?.viewport as { width: number; height: number } | undefined,
        });
        
        // Publish screenshot event with URL
        await publishProgress(executionId, {
          type: 'screenshot',
          executionId,
          stepIndex: stepNumber,
          screenshot: url,
          timestamp: Date.now(),
        });
      },
      onHealing: async (event) => {
        await healingService.recordHealing(executionId, event);
      },
      onCheckpoint: async (stepNumber, state) => {
        await checkpointService.save(executionId, stepNumber, state);
      },
    });

    // Calculate final status
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const finalStatus: ExecutionStatus = failed > 0 ? 'FAILED' : 'PASSED';

    // Update execution with results
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        duration: totalDuration,
        result: {
          passed,
          failed,
          skipped,
          total: results.length,
          steps: results,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Record flaky data for each test
    for (const result of results) {
      if (result.testId) {
        await recordFlakyData(result.testId, result.status === 'passed', result.duration);
      }
    }

    // Incrementally update impact mappings based on execution outcome
    try {
      await updateImpactMappings(prisma, executionId);
    } catch (err) {
      logger.warn('Failed to update impact mappings', { executionId, error: err });
    }

    // Publish completion status
    await publishStatusChange(executionId, finalStatus);

    logger.info(`Execution completed: ${executionId}`, {
      status: finalStatus,
      passed,
      failed,
      skipped,
      duration: totalDuration,
    });

    // Send notifications for scheduled executions that failed
    if (finalStatus === 'FAILED') {
      try {
        const execution = await prisma.execution.findUnique({
          where: { id: executionId },
          include: {
            project: { select: { id: true, name: true, settings: true, orgId: true } },
          },
        });
        if (execution?.triggeredBy === 'SCHEDULE') {
          const settings = execution.project.settings as any;
          const notifications = settings?.notifications;
          if (notifications?.emailOnFailure) {
            // Get org members to notify
            const members = await prisma.organizationUser.findMany({
              where: { orgId: execution.project.orgId },
              include: { user: { select: { email: true } } },
            });
            // Publish notification event (email sending happens via the API's email service)
            redisPubsub.publish('visiontest:notifications', JSON.stringify({
              type: 'schedule:failed',
              projectName: execution.project.name,
              executionId,
              scheduleName: (execution.metadata as any)?.scheduleName || 'Unknown',
              error: `${failed} test(s) failed out of ${results.length}`,
              recipients: members.map(m => m.user.email),
              timestamp: Date.now(),
            }));
            logger.info(`Published failure notification for scheduled execution ${executionId}`);
          }
        }
      } catch (notifError) {
        logger.warn('Failed to send execution notification:', notifError);
      }
    }

    return { status: finalStatus, results };
  } catch (error) {
    logger.error(`Execution failed: ${executionId}`, error);

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // Publish failure status
    await publishStatusChange(
      executionId,
      'FAILED',
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;
  }
}

async function recordFlakyData(testId: string, passed: boolean, duration: number) {
  try {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) return;

    let flakyTest = await prisma.flakyTest.findUnique({ where: { testId } });

    const newRun = {
      timestamp: Date.now(),
      passed,
      duration,
    };

    if (!flakyTest) {
      await prisma.flakyTest.create({
        data: {
          testId,
          projectId: test.projectId,
          runHistory: JSON.stringify([newRun]),
          status: 'WATCHING',
        },
      });
    } else {
      const history = JSON.parse(flakyTest.runHistory as string);
      history.push(newRun);

      // Keep only last 30 days
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentHistory = history.filter((h: any) => h.timestamp > cutoff);

      // Calculate flakiness score
      const score = calculateFlakinessScore(recentHistory);
      const newStatus = determineStatus(score, recentHistory.length, flakyTest.status as any);

      await prisma.flakyTest.update({
        where: { id: flakyTest.id },
        data: {
          runHistory: JSON.stringify(recentHistory),
          flakinessScore: score,
          status: newStatus,
          lastAnalyzedAt: new Date(),
        },
      });

      // Update test status if quarantined
      if (newStatus === 'QUARANTINED' && flakyTest.status !== 'QUARANTINED') {
        await prisma.test.update({
          where: { id: testId },
          data: { status: 'QUARANTINED' },
        });
        logger.info(`Test auto-quarantined: ${testId} (score: ${score}%)`);
      }
    }
  } catch (error) {
    logger.error('Failed to record flaky data:', error);
  }
}

function calculateFlakinessScore(history: { passed: boolean }[]): number {
  if (history.length < 5) return 0;

  const failures = history.filter((h) => !h.passed).length;
  const failureRate = failures / history.length;

  let alternations = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].passed !== history[i - 1].passed) {
      alternations++;
    }
  }
  const alternationRate = alternations / (history.length - 1);

  const score = failureRate * 100 * (1 + alternationRate);
  return Math.min(100, Math.round(score * 10) / 10);
}

function determineStatus(score: number, runs: number, currentStatus: string): FlakyStatus {
  if (runs < 5) return 'WATCHING';
  if (score >= 35) return 'QUARANTINED';
  if (score >= 20) return 'WARNING';
  if (score <= 5 && currentStatus === 'QUARANTINED') return 'STABLE';
  return 'WATCHING';
}

// =============================================================================
// WORKER SETUP
// =============================================================================

/**
 * Process a recomparison job (re-run visual diff with updated masks)
 */
async function processRecomparison(job: Job) {
  const { comparisonId, executionId, baselineId, screenshotId, maskIds } = job.data;

  logger.info(`Processing recomparison: ${comparisonId}`, {
    executionId,
    baselineId,
    workerId: WORKER_ID,
  });

  try {
    // Load the comparison with its screenshot and baseline
    const comparison = await prisma.comparison.findUnique({
      where: { id: comparisonId },
      include: {
        screenshot: true,
        baseline: true,
      },
    });

    if (!comparison || !comparison.screenshot || !comparison.baseline) {
      logger.error(`Recomparison ${comparisonId}: missing comparison, screenshot, or baseline`);
      return;
    }

    // Run the comparison using the screenshot service
    const screenshotService = new ScreenshotService();
    const result = await screenshotService.processComparison(
      executionId,
      comparison.screenshot.id,
      baselineId
    );

    // Update the comparison record with recomparison metadata
    await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        diffScore: result.diffPercent,
        status: result.diffPercent === 0 ? 'AUTO_APPROVED' : 'PENDING',
        metadata: {
          ...((comparison.metadata as any) || {}),
          recomparedAt: new Date().toISOString(),
          masksApplied: maskIds,
        },
      },
    });

    // Publish event
    redisPubsub.publish('visiontest:executions', JSON.stringify({
      type: 'comparison:updated',
      comparisonId,
      executionId,
      diffScore: result.diffPercent,
      timestamp: Date.now(),
    }));

    logger.info(`Recomparison complete: ${comparisonId}, diff=${result.diffPercent}%`);
  } catch (error) {
    logger.error(`Recomparison failed: ${comparisonId}`, error);
    throw error;
  }
}

/**
 * Process a fix session job
 */
async function processFixSession(job: Job) {
  const { fixSessionId, bugCandidateId } = job.data;
  logger.info(`Processing fix session job: ${fixSessionId}`);
  await fixOrchestrator.processFixSession({ fixSessionId, bugCandidateId });
}

/**
 * Process an AI diff analysis job
 */
async function processAiDiffAnalysis(job: Job) {
  const { comparisonId, projectId } = job.data;
  logger.info(`Processing AI diff analysis: ${comparisonId}`);

  try {
    // Load config
    const config = await prisma.aiDiffConfig.findUnique({ where: { projectId } });
    if (!config || !config.enabled) {
      logger.info(`AI diff not enabled for project ${projectId}, skipping`);
      return;
    }

    // Load comparison
    const comparison = await prisma.comparison.findUnique({
      where: { id: comparisonId },
      include: {
        baseline: true,
        screenshot: true,
      },
    });
    if (!comparison) {
      logger.warn(`Comparison not found: ${comparisonId}`);
      return;
    }

    // Initialize pipeline
    const embeddingsClient = new EmbeddingsClient(config.sidecarUrl || undefined);
    const { AIService } = await import('./services/aiService');
    const aiService = new AIService();
    await aiService.loadConfig(projectId);

    const pipeline = new AiDiffPipeline(config as any, embeddingsClient, aiService);

    // Fetch real images from MinIO
    const SCREENSHOT_BUCKET = process.env.SCREENSHOT_BUCKET || 'visiontest-screenshots';
    function urlToKey(url: string): string {
      try {
        const pathname = new URL(url).pathname;
        if (pathname.includes(SCREENSHOT_BUCKET)) {
          return pathname.replace(`/${SCREENSHOT_BUCKET}/`, '');
        }
        return pathname.replace(/^\//, '');
      } catch {
        return url;
      }
    }

    let baselineBuffer = Buffer.alloc(0);
    let currentBuffer = Buffer.alloc(0);
    let diffBuffer = Buffer.alloc(0);

    try {
      // Current screenshot
      if (comparison.screenshot?.url) {
        currentBuffer = Buffer.from(await screenshotService.get(urlToKey(comparison.screenshot.url)));
      }

      // Baseline: resolve matching image from the baseline's screenshots JSON array
      if (comparison.baseline?.screenshots && comparison.screenshot?.name) {
        const baselineScreenshots: Array<{ name: string; url: string }> =
          typeof comparison.baseline.screenshots === 'string'
            ? JSON.parse(comparison.baseline.screenshots as string)
            : comparison.baseline.screenshots as any;

        const match = baselineScreenshots.find(
          (bs: { name: string }) => bs.name === comparison.screenshot!.name
        );
        if (match?.url) {
          baselineBuffer = Buffer.from(await screenshotService.get(urlToKey(match.url)));
        } else {
          logger.warn('No baseline screenshot matched by name', {
            screenshotName: comparison.screenshot.name,
            baselineId: comparison.baselineId,
            available: baselineScreenshots.map((bs: { name: string }) => bs.name),
          });
        }
      }

      // Diff overlay
      if (comparison.diffUrl) {
        diffBuffer = Buffer.from(await screenshotService.get(urlToKey(comparison.diffUrl)));
      }
    } catch (fetchErr) {
      logger.warn('Failed to fetch images from MinIO, proceeding with available data', {
        error: fetchErr,
        baselineSize: baselineBuffer.length,
        currentSize: currentBuffer.length,
      });
    }

    logger.info('AI diff image buffers resolved', {
      comparisonId,
      baselineBytes: baselineBuffer.length,
      currentBytes: currentBuffer.length,
      diffBytes: diffBuffer.length,
    });

    const result = await pipeline.analyze(
      baselineBuffer,
      currentBuffer,
      comparison.diffScore,
      diffBuffer,
      { testName: comparison.screenshot?.name || comparison.baselineId },
    );

    // Update comparison with AI results
    await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        aiClassification: result.classification,
        aiConfidence: result.confidence,
        aiStageReached: result.stageReached,
        aiExplanation: result.explanation,
        aiRegions: result.regions as any,
        aiSuggestedAction: result.suggestedAction,
        aiModelUsed: result.modelUsed || null,
        aiProcessingTimeMs: result.processingTimeMs,
        aiAnalyzedAt: new Date(),
        aiScores: result.scores as any,
      },
    });

    // Auto-approve noise if configured
    if (config.autoApproveNoise && result.classification === 'NOISE') {
      await prisma.comparison.update({
        where: { id: comparisonId },
        data: { status: 'AUTO_APPROVED', resolvedAt: new Date() },
      });
    }

    // Auto-escalate breaking if configured
    if (config.escalateBreaking && result.classification === 'BREAKING') {
      await prisma.comparison.update({
        where: { id: comparisonId },
        data: { status: 'ESCALATED' },
      });
    }

    logger.info(`AI diff analysis complete: ${comparisonId} => ${result.classification} (stage ${result.stageReached}, ${result.processingTimeMs}ms)`);
  } catch (error) {
    logger.error(`AI diff analysis failed: ${comparisonId}`, error);
  }
}

/**
 * Process an API test execution job
 */
async function processApiTestExecution(job: Job) {
  const { apiExecutionId, apiTestId, environmentName, variableOverrides } = job.data;
  logger.info(`Processing API test execution: ${apiExecutionId}`);
  await apiTestExecutor.processApiTest({ apiExecutionId, apiTestId, environmentName, variableOverrides });
}

/**
 * Process a storybook-sync job (scheduled polling)
 */
async function processStorybookSync(job: Job) {
  const { projectId } = job.data;
  logger.info(`Processing storybook-sync for project ${projectId}`);

  const config = await prisma.storybookConfig.findUnique({ where: { projectId } });
  if (!config) {
    logger.warn(`No StorybookConfig found for project ${projectId}, skipping sync`);
    return;
  }
  if (!config.enabled) {
    logger.info(`Storybook integration disabled for project ${projectId}, skipping sync`);
    return;
  }
  if (!config.storybookUrl) {
    logger.warn(`No storybookUrl configured for project ${projectId}, skipping sync`);
    return;
  }

  try {
    const result = await syncStorybook(prisma, projectId, config.storybookUrl, {
      includePatterns: config.includePatterns || [],
      excludePatterns: config.excludePatterns || ['*--docs'],
      waitAfterLoadMs: config.waitAfterLoadMs ?? 500,
    });
    logger.info(
      `Storybook sync complete for project ${projectId}: ` +
      `discovered=${result.storiesDiscovered}, created=${result.testsCreated}, ` +
      `updated=${result.testsUpdated}, archived=${result.testsArchived}`,
    );
  } catch (error) {
    logger.error(`Storybook sync failed for project ${projectId}:`, error);
    throw error; // let BullMQ handle retries
  }
}

/**
 * Route jobs to the correct processor based on job name
 */
async function processJob(job: Job) {
  if (job.name === 'recompare') {
    return processRecomparison(job);
  }
  if (job.name === 'fix-session') {
    return processFixSession(job);
  }
  if (job.name === 'api-test-execution') {
    return processApiTestExecution(job);
  }
  if (job.name === 'ai-diff-analysis') {
    return processAiDiffAnalysis(job);
  }
  if (job.name === 'storybook-sync') {
    return processStorybookSync(job);
  }
  return processTestExecution(job);
}

const worker = new Worker(
  'test-execution',
  processJob,
  {
    connection: redisConnection,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

worker.on('completed', (job) => {
  logger.info(`Job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  logger.error(`Job failed: ${job?.id}`, error);
});

worker.on('error', (error) => {
  logger.error('Worker error:', error);
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

async function shutdown() {
  logger.info('Shutting down worker...');
  
  await worker.close();
  await redisPubsub.quit();
  await redisConnection.quit();
  await prisma.$disconnect();
  
  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// =============================================================================
// START
// =============================================================================

logger.info(`VisionTest AI Worker started`, {
  workerId: WORKER_ID,
  concurrency: WORKER_CONCURRENCY,
  redis: REDIS_URL.replace(/\/\/[^@]*@/, '//***@'),
});
