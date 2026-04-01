// VisionTest AI - Video Service
// Handles video storage and database record creation

import { Client } from 'minio';
import { prisma } from '@visiontest/database';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const VIDEO_BUCKET = process.env.VIDEO_BUCKET || 'visiontest-videos';

export class VideoService {
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
      const exists = await this.client.bucketExists(VIDEO_BUCKET);
      if (!exists) {
        await this.client.makeBucket(VIDEO_BUCKET);
        logger.info(`Created bucket: ${VIDEO_BUCKET}`);
      }
    } catch (error) {
      logger.error('Failed to ensure video bucket exists:', error);
    }
  }

  /**
   * Save a video file to object storage and create database record
   */
  async save(executionId: string, videoPath: string): Promise<string> {
    const filename = `${uuid()}.webm`;
    const key = `${executionId}/videos/${filename}`;

    // Read the video file
    const videoBuffer = fs.readFileSync(videoPath);
    const stats = fs.statSync(videoPath);

    // Upload to MinIO
    await this.client.putObject(VIDEO_BUCKET, key, videoBuffer, {
      'Content-Type': 'video/webm',
    });

    // Build API proxy URL
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
    const url = `${apiBaseUrl}/videos/${executionId}/${filename}`;

    // Create database record
    await prisma.video.create({
      data: {
        executionId,
        url,
        size: stats.size,
        format: 'webm',
        metadata: {
          originalPath: videoPath,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Clean up temp file
    try {
      fs.unlinkSync(videoPath);
    } catch {
      logger.debug('Could not delete temp video file');
    }

    logger.info(`Video saved: ${key} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    return url;
  }
}
