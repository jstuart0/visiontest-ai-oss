// VisionTest.ai - Device Profile Routes
// CRUD endpoints for mobile device profiles + device discovery

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { BadRequestError } from '../middleware/error';
import { devicesService } from '../services/devices.service';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createDeviceProfileSchema = z.object({
  projectId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  platform: z.enum(['WEB', 'IOS', 'ANDROID', 'MOBILE_WEB']),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
  scaleFactor: z.number().min(0.1).max(10).optional(),
  userAgent: z.string().max(500).optional(),
  osVersion: z.string().max(50).optional(),
  isEmulator: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const updateDeviceProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  platform: z.enum(['WEB', 'IOS', 'ANDROID', 'MOBILE_WEB']).optional(),
  width: z.number().int().min(1).max(10000).optional(),
  height: z.number().int().min(1).max(10000).optional(),
  scaleFactor: z.number().min(0.1).max(10).optional(),
  userAgent: z.string().max(500).optional(),
  osVersion: z.string().max(50).optional(),
  isEmulator: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /devices
 * List device profiles (built-in + custom)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, platform } = req.query;

    const profiles = await devicesService.list({
      projectId: projectId as string | undefined,
      platform: platform as string | undefined,
      includeGlobal: true,
      includeBuiltIn: true,
    });

    res.json({
      success: true,
      data: profiles,
      meta: {
        total: profiles.length,
        builtIn: profiles.filter((p: any) => p.isBuiltIn).length,
        custom: profiles.filter((p: any) => !p.isBuiltIn).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /devices/available
 * List connected/available devices and emulators
 */
router.get('/available', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = await devicesService.discoverDevices();

    res.json({
      success: true,
      data: devices,
      meta: {
        total: devices.length,
        ios: devices.filter(d => d.platform === 'IOS').length,
        android: devices.filter(d => d.platform === 'ANDROID').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /devices/:id
 * Get a single device profile
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await devicesService.getById(req.params.id);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /devices/:id/capability
 * Check device profile capabilities
 */
router.get('/:id/capability', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await devicesService.checkCapability(req.params.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /devices
 * Create a custom device profile
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createDeviceProfileSchema.parse(req.body);

    const profile = await devicesService.create(input as any);

    logger.info(`Device profile created via API: ${profile.id}`);

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /devices/:id
 * Update a device profile
 */
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateDeviceProfileSchema.parse(req.body);

    const profile = await devicesService.update(req.params.id, input);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /devices/:id
 * Delete a custom device profile
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await devicesService.delete(req.params.id);

    res.json({
      success: true,
      data: { message: 'Device profile deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
