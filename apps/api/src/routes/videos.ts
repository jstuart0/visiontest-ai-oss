// VisionTest.ai - Video Proxy Routes

import { Router, Request, Response, NextFunction } from 'express';
import { Client as MinioClient } from 'minio';
import { authenticate } from '../middleware/auth';
import { prisma } from '@visiontest/database';
import { NotFoundError, ForbiddenError } from '../middleware/error';

const router = Router();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const VIDEO_BUCKET = process.env.VIDEO_BUCKET || 'visiontest-videos';

const minioClient = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

/**
 * GET /videos/:executionId
 * List videos for an execution
 */
router.get('/:executionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
        videos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    res.json({
      success: true,
      data: execution.videos,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /videos/:executionId/:filename
 * Stream video from MinIO storage
 */
router.get('/:executionId/:filename', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, filename } = req.params;

    // Validate the execution exists and user has org access
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        project: {
          include: {
            org: {
              include: { users: { where: { userId: req.user!.id } } },
            },
          },
        },
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access');
    }

    const objectPath = `${executionId}/videos/${filename}`;

    // Get object stats for content-length
    let stat;
    try {
      stat = await minioClient.statObject(VIDEO_BUCKET, objectPath);
    } catch {
      throw NotFoundError('Video');
    }

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const stream = await minioClient.getPartialObject(VIDEO_BUCKET, objectPath, start, chunkSize);

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');

      stream.pipe(res);
    } else {
      const stream = await minioClient.getObject(VIDEO_BUCKET, objectPath);

      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');

      stream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
