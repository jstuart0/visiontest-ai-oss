// VisionTest AI - Real-time Execution Stream (SSE)

import { Router, Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { authenticate } from '../middleware/auth';
import { prisma } from '@visiontest/database';
import { ForbiddenError, NotFoundError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PUBSUB_CHANNEL = 'visiontest:executions';

/**
 * Authenticate via query param for SSE (EventSource doesn't support custom headers)
 */
async function authenticateSSE(req: Request, res: Response, next: NextFunction) {
  // Try query param first (for EventSource)
  const tokenFromQuery = req.query.token as string;
  if (tokenFromQuery) {
    req.headers.authorization = `Bearer ${tokenFromQuery}`;
  }
  // Fall back to regular authenticate middleware
  return authenticate(req, res, next);
}

/**
 * GET /stream/executions/:executionId
 * SSE endpoint for real-time execution progress
 */
router.get('/executions/:executionId', authenticateSSE, async (req: Request, res: Response, next: NextFunction) => {
  const { executionId } = req.params;

  try {
    // Verify access to this execution
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        project: {
          include: {
            org: {
              include: {
                users: { where: { userId: req.user!.id } },
              },
            },
          },
        },
        test: { select: { id: true, name: true, steps: true } },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access to this execution');
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial state
    const initialData = {
      type: 'init',
      executionId: execution.id,
      status: execution.status,
      test: execution.test,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      timestamp: Date.now(),
    };
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);

    // If already completed, send final state and close
    if (['PASSED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(execution.status)) {
      const finalData = {
        type: 'execution:complete',
        executionId: execution.id,
        status: execution.status,
        duration: execution.duration,
        result: execution.result,
        errorMessage: execution.errorMessage,
        timestamp: Date.now(),
      };
      res.write(`data: ${JSON.stringify(finalData)}\n\n`);
      res.end();
      return;
    }

    // Subscribe to Redis pub/sub for this execution
    const subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    
    // Handle Redis errors to prevent crash
    subscriber.on('error', (err) => {
      logger.warn({ err, executionId }, 'Redis subscriber error');
    });

    subscriber.subscribe(PUBSUB_CHANNEL, (err) => {
      if (err) {
        logger.error({ err, executionId }, 'Failed to subscribe to Redis channel');
        res.end();
        return;
      }
      logger.info({ executionId }, 'SSE client connected, subscribed to Redis');
    });

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        
        // Only forward messages for this execution
        if (data.executionId === executionId) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);

          // Close connection when execution completes
          if (data.type === 'execution:status' && 
              ['PASSED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(data.status)) {
            setTimeout(() => {
              subscriber.quit().catch(() => {}); // Ignore errors on quit
              res.end();
            }, 1000); // Give time for final messages
          }
        }
      } catch (e) {
        logger.warn({ err: e }, 'Failed to parse Redis message');
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      logger.info({ executionId }, 'SSE client disconnected');
      subscriber.quit().catch(() => {}); // Ignore errors on quit
    });

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /stream/projects/:projectId/executions
 * SSE endpoint for all executions in a project
 */
router.get('/projects/:projectId/executions', authenticateSSE, async (req: Request, res: Response, next: NextFunction) => {
  const { projectId } = req.params;

  try {
    // Verify access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        org: {
          include: {
            users: { where: { userId: req.user!.id } },
          },
        },
      },
    });

    if (!project) {
      throw NotFoundError('Project');
    }

    if (project.org.users.length === 0) {
      throw ForbiddenError('No access to this project');
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send current running executions
    const runningExecutions = await prisma.execution.findMany({
      where: { projectId, status: { in: ['PENDING', 'QUEUED', 'RUNNING'] } },
      include: { test: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.write(`data: ${JSON.stringify({
      type: 'init',
      projectId,
      executions: runningExecutions,
      timestamp: Date.now(),
    })}\n\n`);

    // Subscribe to Redis pub/sub
    const subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

    subscriber.subscribe(PUBSUB_CHANNEL, (err) => {
      if (err) {
        logger.error({ err, projectId }, 'Failed to subscribe to Redis channel');
        res.end();
        return;
      }
    });

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        // Forward all execution events (worker should include projectId)
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (e) {
        // Ignore parse errors
      }
    });

    req.on('close', () => {
      subscriber.quit();
    });

    // Keep-alive
    const keepAlive = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    next(error);
  }
});

export default router;
