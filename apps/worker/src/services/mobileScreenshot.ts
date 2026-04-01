// VisionTest.ai - Mobile Screenshot Service
// Handles screenshot capture, scaling, and storage for mobile devices

import { Client } from 'minio';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { prisma } from '@visiontest/database';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { AppiumDriver } from './mobileTestRunner';
import { DeviceManager } from './deviceManager';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const SCREENSHOT_BUCKET = process.env.SCREENSHOT_BUCKET || 'visiontest-screenshots';

// =============================================================================
// TYPES
// =============================================================================

export interface MobileScreenshotOptions {
  executionId: string;
  stepNumber: number;
  name: string;
  platform: 'IOS' | 'ANDROID';
  deviceName?: string;
  deviceProfileId?: string;
  scaleFactor?: number;
  cropStatusBar?: boolean;
  cropNavigationBar?: boolean;
  statusBarHeight?: number;
  navigationBarHeight?: number;
}

export interface CropConfig {
  top: number;    // Status bar height to crop
  bottom: number; // Navigation bar height to crop
  left: number;
  right: number;
}

// Default status bar heights (in device pixels) for common devices
const IOS_STATUS_BAR_HEIGHTS: Record<string, number> = {
  'default': 47,      // iPhone with Dynamic Island
  'notch': 44,        // iPhone with notch
  'classic': 20,      // Classic iPhone
  'ipad': 24,         // iPad
};

const ANDROID_STATUS_BAR_HEIGHTS: Record<string, number> = {
  'default': 24,       // Default dp
  'navigation': 48,    // Navigation bar dp
};

// =============================================================================
// MOBILE SCREENSHOT SERVICE
// =============================================================================

export class MobileScreenshotService {
  private client: Client;
  private deviceManager: DeviceManager;

  constructor() {
    this.client = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });

    this.deviceManager = new DeviceManager();
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
   * Capture screenshot via Appium driver (primary method)
   */
  async captureViaAppium(
    driver: AppiumDriver,
    options: MobileScreenshotOptions
  ): Promise<string> {
    const screenshot = await driver.takeScreenshot();
    return this.processAndStore(screenshot, options);
  }

  /**
   * Capture screenshot via platform tools (fallback)
   */
  async captureViaPlatformTools(
    deviceId: string,
    options: MobileScreenshotOptions
  ): Promise<string> {
    const screenshot = await this.deviceManager.takeScreenshot(deviceId, options.platform);
    return this.processAndStore(screenshot, options);
  }

  /**
   * Process the screenshot: handle scaling, crop bars, then store
   */
  async processAndStore(
    screenshot: Buffer,
    options: MobileScreenshotOptions
  ): Promise<string> {
    let processed = screenshot;

    // Get image metadata
    const metadata = await sharp(screenshot).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;
    const scaleFactor = options.scaleFactor || 1;

    // Crop status/navigation bars if requested
    if (options.cropStatusBar || options.cropNavigationBar) {
      const cropConfig = this.getCropConfig(options, scaleFactor);
      
      if (cropConfig.top > 0 || cropConfig.bottom > 0) {
        const cropTop = Math.min(cropConfig.top, originalHeight);
        const cropHeight = Math.max(1, originalHeight - cropTop - cropConfig.bottom);

        processed = await sharp(screenshot)
          .extract({
            left: 0,
            top: cropTop,
            width: originalWidth,
            height: cropHeight,
          })
          .png()
          .toBuffer();
      }
    }

    // Scale down from device pixels to CSS pixels if needed
    if (scaleFactor > 1) {
      const targetWidth = Math.round(originalWidth / scaleFactor);
      const processedMeta = await sharp(processed).metadata();
      const targetHeight = Math.round((processedMeta.height || originalHeight) / scaleFactor);

      processed = await sharp(processed)
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer();
    }

    // Store in MinIO
    return this.store(processed, options);
  }

  /**
   * Store screenshot in MinIO with mobile-specific metadata
   */
  private async store(
    screenshot: Buffer,
    options: MobileScreenshotOptions
  ): Promise<string> {
    const filename = `${options.stepNumber}-${uuid()}.png`;
    const key = `${options.executionId}/mobile/${filename}`;

    const metadata = await sharp(screenshot).metadata();

    await this.client.putObject(SCREENSHOT_BUCKET, key, screenshot, {
      'Content-Type': 'image/png',
      'X-Platform': options.platform,
      'X-Device-Name': options.deviceName || 'unknown',
      'X-Scale-Factor': String(options.scaleFactor || 1),
    });

    // Return API proxy URL
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
    const url = `${apiBaseUrl}/screenshots/${options.executionId}/mobile/${filename}`;

    // Create database record
    await prisma.screenshot.create({
      data: {
        executionId: options.executionId,
        name: options.name,
        url,
        stepNumber: options.stepNumber,
        width: metadata.width || 0,
        height: metadata.height || 0,
        platform: options.platform,
        deviceName: options.deviceName,
        deviceProfileId: options.deviceProfileId,
        metadata: {
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          scaleFactor: options.scaleFactor,
          platform: options.platform,
          deviceName: options.deviceName,
          capturedAt: new Date().toISOString(),
          isMobile: true,
        },
      },
    });

    logger.info(`Mobile screenshot saved: ${key}`, {
      platform: options.platform,
      device: options.deviceName,
    });

    return url;
  }

  /**
   * Get crop configuration based on platform and device
   */
  private getCropConfig(options: MobileScreenshotOptions, scaleFactor: number): CropConfig {
    let statusBarHeight = 0;
    let navBarHeight = 0;

    if (options.cropStatusBar) {
      if (options.statusBarHeight) {
        statusBarHeight = options.statusBarHeight;
      } else if (options.platform === 'IOS') {
        statusBarHeight = IOS_STATUS_BAR_HEIGHTS['default'];
      } else {
        statusBarHeight = ANDROID_STATUS_BAR_HEIGHTS['default'];
      }
    }

    if (options.cropNavigationBar) {
      if (options.navigationBarHeight) {
        navBarHeight = options.navigationBarHeight;
      } else if (options.platform === 'ANDROID') {
        navBarHeight = ANDROID_STATUS_BAR_HEIGHTS['navigation'];
      }
    }

    // Scale to device pixels
    return {
      top: Math.round(statusBarHeight * scaleFactor),
      bottom: Math.round(navBarHeight * scaleFactor),
      left: 0,
      right: 0,
    };
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
}
