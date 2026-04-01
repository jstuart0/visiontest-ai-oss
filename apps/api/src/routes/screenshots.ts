// VisionTest.ai - Screenshot Proxy & Upload Route

import { Router, Request, Response, NextFunction } from 'express';
import { Client as MinioClient } from 'minio';
import { authenticate, optionalAuth } from '../middleware/auth';
import { prisma } from '@visiontest/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../middleware/error';
import multer from 'multer';
import { randomUUID } from 'crypto';

const router = Router();

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

/**
 * GET /screenshots/url/:executionId/:filename
 * Get a presigned URL for the screenshot (alternative approach)
 */
const SCREENSHOT_PUBLIC_ACCESS = process.env.SCREENSHOT_PUBLIC_ACCESS === 'true';

if (SCREENSHOT_PUBLIC_ACCESS) {
  console.warn('WARNING: SCREENSHOT_PUBLIC_ACCESS=true -- screenshots are publicly accessible without authentication. Only use in trusted environments.');
}

/**
 * GET /screenshots/:executionId/:filename
 * Proxy screenshot from MinIO storage
 *
 * By default, requires authentication via ?token= query param (for <img> tags).
 * Set SCREENSHOT_PUBLIC_ACCESS=true to allow unauthenticated access.
 */
router.get('/:executionId/:filename', async (req: Request, res: Response, next: NextFunction) => {
  // If public access is disabled, require auth and org membership check
  if (!SCREENSHOT_PUBLIC_ACCESS) {
    // Use authenticate middleware inline
    await new Promise<void>((resolve, reject) => {
      authenticate(req, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const { executionId } = req.params;

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
      },
    });

    if (!execution) {
      throw NotFoundError('Execution');
    }

    if (execution.project.org.users.length === 0) {
      throw ForbiddenError('No access to this execution');
    }
  }
  try {
    const { executionId, filename } = req.params;

    // When public access is enabled, just validate execution exists
    if (SCREENSHOT_PUBLIC_ACCESS) {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        select: { id: true },
      });

      if (!execution) {
        throw NotFoundError('Execution');
      }
    }

    const objectPath = `${executionId}/${filename}`;

    // Stream the file from MinIO
    const stream = await minioClient.getObject(SCREENSHOT_BUCKET, objectPath);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    stream.pipe(res);
    
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, error: { message: 'Screenshot not found' } });
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/url/:executionId/:filename', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, filename } = req.params;

    // Verify access
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

    const objectPath = `${executionId}/${filename}`;
    
    // Generate presigned URL (valid for 1 hour)
    const url = await minioClient.presignedGetObject(SCREENSHOT_BUCKET, objectPath, 3600);
    
    res.json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
});

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

/**
 * POST /screenshots/upload
 * Upload screenshot(s) to MinIO and create DB records
 */
router.post('/upload', authenticate, upload.array('screenshots'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, stepNumber, name, width, height, platform, deviceType, deviceName, deviceProfileId, metadata } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw BadRequestError('No files uploaded');
    }

    if (!executionId) {
      throw BadRequestError('executionId is required');
    }

    // Verify access to the execution
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
      throw ForbiddenError('No access to this execution');
    }

    const uploadedScreenshots: any[] = [];

    // Process each uploaded file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileStepNumber = Array.isArray(stepNumber) ? parseInt(stepNumber[i]) || i + 1 : parseInt(stepNumber) || i + 1;
      const fileName = Array.isArray(name) ? name[i] || file.originalname : name || file.originalname;
      const fileWidth = Array.isArray(width) ? parseInt(width[i]) : parseInt(width);
      const fileHeight = Array.isArray(height) ? parseInt(height[i]) : parseInt(height);

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop() || 'png';
      const uniqueFilename = `${randomUUID()}.${fileExtension}`;
      const objectPath = `${executionId}/${uniqueFilename}`;

      // Upload to MinIO
      await minioClient.putObject(
        SCREENSHOT_BUCKET,
        objectPath,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'Cache-Control': 'public, max-age=31536000',
        }
      );

      // Create screenshot record in database
      const screenshot = await prisma.screenshot.create({
        data: {
          executionId,
          stepNumber: fileStepNumber,
          name: fileName,
          url: objectPath,
          width: fileWidth || 1280,
          height: fileHeight || 720,
          deviceType: Array.isArray(deviceType) ? deviceType[i] : deviceType,
          platform: Array.isArray(platform) ? platform[i] : platform,
          deviceName: Array.isArray(deviceName) ? deviceName[i] : deviceName,
          deviceProfileId: Array.isArray(deviceProfileId) ? deviceProfileId[i] : deviceProfileId,
          metadata: Array.isArray(metadata) ? JSON.parse(metadata[i] || '{}') : JSON.parse(metadata || '{}'),
        },
      });

      uploadedScreenshots.push({
        ...screenshot,
        url: `/api/v1/screenshots/${executionId}/${uniqueFilename}`,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        uploaded: uploadedScreenshots.length,
        screenshots: uploadedScreenshots,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
