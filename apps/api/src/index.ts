// VisionTest AI - API Server Entry Point
// Hospital-Grade Visual Regression Testing Platform

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@visiontest/database';

import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/requestId';
import { verifyToken } from './middleware/auth';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import organizationRoutes from './routes/organizations';
import projectRoutes from './routes/projects';
import testRoutes from './routes/tests';
import suiteRoutes from './routes/suites';
import executionRoutes from './routes/executions';
import baselineRoutes from './routes/baselines';
import comparisonRoutes from './routes/comparisons';
import maskRoutes from './routes/masks';
import flakyRoutes from './routes/flaky';
import smartSelectRoutes from './routes/smartSelect';
import approvalRoutes from './routes/approvals';
import scheduleRoutes from './routes/schedules';
import streamRoutes from './routes/stream';
import screenshotRoutes from './routes/screenshots';
import videoRoutes from './routes/videos';
import deviceRoutes from './routes/devices';
import healthRoutes from './routes/health';
import teamRoutes from './routes/teams';
import webhookRoutes from './routes/webhooks';
import workflowRoutes from './routes/workflows';
import blockRoutes from './routes/blocks';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import fixRoutes from './routes/fixes';
import repoRoutes from './routes/repos';
import fixPolicyRoutes from './routes/fixPolicies';
import fixRunnerRoutes from './routes/fixRunners';
import apiTestRoutes from './routes/apiTests';
import aiProviderRoutes from './routes/aiProviders';
import aiDiffRoutes from './routes/aiDiff';
import storybookRoutes, { reconcileAllPollingSchedulers } from './routes/storybook';

const app = express();
const httpServer = createServer(app);

// WebSocket server
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Trust proxy (H2: required behind Traefik / k8s ingress)
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || '1'));

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Request processing
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestId);
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// =============================================================================
// ROUTES
// =============================================================================

// Health check (no auth)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API v1 routes
const v1Router = express.Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/organizations', organizationRoutes);
v1Router.use('/projects', projectRoutes);
v1Router.use('/tests', testRoutes);
v1Router.use('/suites', suiteRoutes);
v1Router.use('/executions', executionRoutes);
v1Router.use('/baselines', baselineRoutes);
v1Router.use('/comparisons', comparisonRoutes);
v1Router.use('/masks', maskRoutes);
v1Router.use('/flaky', flakyRoutes);
v1Router.use('/smart-select', smartSelectRoutes);
v1Router.use('/approvals', approvalRoutes);
v1Router.use('/schedules', scheduleRoutes);
v1Router.use('/stream', streamRoutes);
v1Router.use('/screenshots', screenshotRoutes);
v1Router.use('/videos', videoRoutes);
v1Router.use('/devices', deviceRoutes);
v1Router.use('/teams', teamRoutes);
v1Router.use('/webhooks', webhookRoutes);
v1Router.use('/workflows', workflowRoutes);
v1Router.use('/blocks', blockRoutes);
v1Router.use('/dashboard', dashboardRoutes);
v1Router.use('/reports', reportRoutes);
v1Router.use('/fixes', fixRoutes);
v1Router.use('/repos', repoRoutes);
v1Router.use('/fix-policies', fixPolicyRoutes);
v1Router.use('/fix-runners', fixRunnerRoutes);
v1Router.use('/api-tests', apiTestRoutes);
v1Router.use('/ai-providers', aiProviderRoutes);
v1Router.use('/ai-diff', aiDiffRoutes);
v1Router.use('/storybook', storybookRoutes);

app.use('/api/v1', v1Router);

// Legacy API support (redirect to v1)
app.use('/api', v1Router);

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =============================================================================
// WEBSOCKET
// =============================================================================

// Redis subscriber for live stream relay
import Redis from 'ioredis';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Track active stream subscriptions per socket
const streamSubscriptions = new Map<string, Redis>();

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));
  const payload = verifyToken(token as string);
  if (!payload || payload.type !== 'access') return next(new Error('Invalid token'));
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return next(new Error('User not found'));
  (socket as any).user = user;
  next();
});

io.on('connection', (socket) => {
  logger.info(`WebSocket connected: ${socket.id}`);

  socket.on('subscribe:execution', async (executionId: string) => {
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: {
          project: {
            include: {
              org: {
                include: { users: { where: { userId: (socket as any).user.id } } },
              },
            },
          },
        },
      });
      if (!execution || execution.project.org.users.length === 0) {
        socket.emit('error', { message: 'No access to this execution' });
        return;
      }
      socket.join(`execution:${executionId}`);
      logger.debug(`Socket ${socket.id} subscribed to execution ${executionId}`);
    } catch (err) {
      logger.error(`Error in subscribe:execution for ${socket.id}:`, err);
    }
  });

  socket.on('unsubscribe:execution', (executionId: string) => {
    socket.leave(`execution:${executionId}`);
    logger.debug(`Socket ${socket.id} unsubscribed from execution ${executionId}`);
  });

  socket.on('subscribe:project', async (projectId: string) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          org: {
            include: { users: { where: { userId: (socket as any).user.id } } },
          },
        },
      });
      if (!project || project.org.users.length === 0) {
        socket.emit('error', { message: 'No access to this project' });
        return;
      }
      socket.join(`project:${projectId}`);
      logger.debug(`Socket ${socket.id} subscribed to project ${projectId}`);
    } catch (err) {
      logger.error(`Error in subscribe:project for ${socket.id}:`, err);
    }
  });

  // Live stream subscription - relay frames from Redis to WebSocket
  socket.on('subscribe:stream', async (executionId: string) => {
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: {
          project: {
            include: {
              org: {
                include: { users: { where: { userId: (socket as any).user.id } } },
              },
            },
          },
        },
      });
      if (!execution || execution.project.org.users.length === 0) {
        socket.emit('error', { message: 'No access to this execution' });
        return;
      }

      const subKey = `${socket.id}:${executionId}`;
      if (streamSubscriptions.has(subKey)) return;

      const subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
      streamSubscriptions.set(subKey, subscriber);

      const channel = `visiontest:stream:${executionId}`;
      subscriber.subscribe(channel, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to stream ${channel}:`, err);
          return;
        }
        logger.debug(`Socket ${socket.id} subscribed to stream ${executionId}`);
      });

      subscriber.on('message', (_ch: string, frameData: string) => {
        socket.emit('stream:frame', { executionId, data: frameData });
      });
    } catch (err) {
      logger.error(`Error in subscribe:stream for ${socket.id}:`, err);
    }
  });

  socket.on('unsubscribe:stream', (executionId: string) => {
    const subKey = `${socket.id}:${executionId}`;
    const subscriber = streamSubscriptions.get(subKey);
    if (subscriber) {
      subscriber.unsubscribe();
      subscriber.quit();
      streamSubscriptions.delete(subKey);
      logger.debug(`Socket ${socket.id} unsubscribed from stream ${executionId}`);
    }
  });

  socket.on('disconnect', () => {
    // Clean up all stream subscriptions for this socket
    for (const [key, subscriber] of streamSubscriptions.entries()) {
      if (key.startsWith(`${socket.id}:`)) {
        subscriber.unsubscribe();
        subscriber.quit();
        streamSubscriptions.delete(key);
      }
    }
    logger.info(`WebSocket disconnected: ${socket.id}`);
  });
});

// =============================================================================
// SERVER START
// =============================================================================

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    httpServer.listen(PORT, async () => {
      logger.info(`✅ VisionTest AI API running on port ${PORT}`);
      logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`   API: http://localhost:${PORT}/api/v1`);
      logger.info(`   Health: http://localhost:${PORT}/health`);

      // Reconcile storybook polling schedulers on startup
      try {
        await reconcileAllPollingSchedulers();
      } catch (err) {
        logger.error({ err }, 'Failed to reconcile storybook polling schedulers on startup');
      }
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

start();

export default app;
