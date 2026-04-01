// VisionTest.ai - Health Check Routes

import { Router, Request, Response } from 'express';
import { prisma } from '@visiontest/database';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'visiontest-api',
    version: process.env.npm_package_version || '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Readiness check (includes DB connection)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'ready',
      checks: {
        database: 'connected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/live
 * Liveness check
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
