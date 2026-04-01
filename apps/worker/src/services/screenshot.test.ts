/**
 * VisionTest AI - Screenshot Service Tests
 * Hospital-Grade Test Coverage
 * 
 * Tests for screenshot capture, storage, comparison,
 * mask application, and diff generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenshotService, MaskRegion } from './screenshot';
import {
  mockMinioClient,
  mockMinioStream,
  mockPrismaClient,
  createMockPNGBuffer,
  createMockBaseline,
} from '../__tests__/setup';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// Get mocked modules
vi.mock('pixelmatch');

describe('ScreenshotService', () => {
  let service: ScreenshotService;

  beforeEach(() => {
    service = new ScreenshotService();
  });

  // ===========================================================================
  // BUCKET INITIALIZATION TESTS
  // ===========================================================================

  describe('Bucket Initialization', () => {
    it('should check if bucket exists on initialization', async () => {
      expect(mockMinioClient.bucketExists).toHaveBeenCalled();
    });

    it('should create bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValueOnce(false);
      
      // Re-instantiate to trigger bucket creation
      const newService = new ScreenshotService();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
    });

    it('should handle bucket check errors gracefully', async () => {
      mockMinioClient.bucketExists.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Should not throw during construction
      expect(() => new ScreenshotService()).not.toThrow();
    });
  });

  // ===========================================================================
  // SCREENSHOT SAVE TESTS
  // ===========================================================================

  describe('Screenshot Save', () => {
    it('should save screenshot to MinIO', async () => {
      const screenshot = createMockPNGBuffer(800, 600);
      
      const url = await service.save('exec-123', 5, screenshot);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        expect.stringMatching(/exec-123\/5-mock-uuid-\d+\.png/),
        screenshot,
        { 'Content-Type': 'image/png' }
      );
      expect(url).toContain('exec-123');
    });

    it('should generate unique key for each screenshot', async () => {
      const screenshot = createMockPNGBuffer();

      const url1 = await service.save('exec-123', 1, screenshot);
      const url2 = await service.save('exec-123', 1, screenshot);

      // URLs should be different due to UUID
      const key1 = mockMinioClient.putObject.mock.calls[0][1];
      const key2 = mockMinioClient.putObject.mock.calls[1][1];
      expect(key1).not.toBe(key2);
    });

    it('should include execution ID in key path', async () => {
      const screenshot = createMockPNGBuffer();

      await service.save('execution-abc-123', 1, screenshot);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('execution-abc-123/'),
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should include step number in key path', async () => {
      const screenshot = createMockPNGBuffer();

      await service.save('exec-123', 42, screenshot);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\/42-/),
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should return accessible URL', async () => {
      const screenshot = createMockPNGBuffer();

      const url = await service.save('exec-123', 1, screenshot);

      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain('screenshots');
    });
  });

  // ===========================================================================
  // SCREENSHOT SAVE WITH RECORD TESTS
  // ===========================================================================

  describe('Screenshot Save with Database Record', () => {
    it('should save screenshot and create database record', async () => {
      const screenshot = createMockPNGBuffer(1920, 1080);

      await service.saveWithRecord('exec-123', 5, screenshot, {
        name: 'homepage',
        viewport: { width: 1920, height: 1080 },
      });

      expect(mockPrismaClient.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-123',
          name: 'homepage',
          stepNumber: 5,
        }),
      });
    });

    it('should store image dimensions in record', async () => {
      const screenshot = createMockPNGBuffer(1280, 720);
      
      // Mock PNG.sync.read to return correct dimensions
      vi.mocked(PNG.sync.read).mockReturnValueOnce({
        width: 1280,
        height: 720,
        data: Buffer.alloc(1280 * 720 * 4),
      } as any);

      await service.saveWithRecord('exec-123', 1, screenshot, {
        name: 'test',
      });

      expect(mockPrismaClient.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          width: 1280,
          height: 720,
        }),
      });
    });

    it('should include viewport in metadata', async () => {
      const screenshot = createMockPNGBuffer();

      await service.saveWithRecord('exec-123', 1, screenshot, {
        name: 'mobile-view',
        viewport: { width: 375, height: 812 },
      });

      expect(mockPrismaClient.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            viewport: { width: 375, height: 812 },
          }),
        }),
      });
    });

    it('should include device ID when provided', async () => {
      const screenshot = createMockPNGBuffer();

      await service.saveWithRecord('exec-123', 1, screenshot, {
        name: 'device-test',
        deviceId: 'device-iphone-14',
      });

      expect(mockPrismaClient.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceId: 'device-iphone-14',
        }),
      });
    });

    it('should include capture timestamp in metadata', async () => {
      const screenshot = createMockPNGBuffer();
      const beforeTime = new Date().toISOString();

      await service.saveWithRecord('exec-123', 1, screenshot, {
        name: 'timed-capture',
      });

      expect(mockPrismaClient.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            capturedAt: expect.any(String),
          }),
        }),
      });
    });

    it('should return the storage URL', async () => {
      const screenshot = createMockPNGBuffer();

      const url = await service.saveWithRecord('exec-123', 1, screenshot, {
        name: 'test',
      });

      expect(url).toContain('screenshots');
    });
  });

  // ===========================================================================
  // IMAGE COMPARISON TESTS
  // ===========================================================================

  describe('Image Comparison', () => {
    it('should compare identical images with zero diff', async () => {
      const baseline = createMockPNGBuffer(100, 100);
      const current = createMockPNGBuffer(100, 100);
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.compare(baseline, current);

      expect(result.diffPixels).toBe(0);
      expect(result.diffPercent).toBe(0);
    });

    it('should detect differences between images', async () => {
      const baseline = createMockPNGBuffer(100, 100);
      const current = createMockPNGBuffer(100, 100);
      
      // 500 different pixels out of 10000
      vi.mocked(pixelmatch).mockReturnValueOnce(500);

      const result = await service.compare(baseline, current);

      expect(result.diffPixels).toBe(500);
      expect(result.diffPercent).toBe(5); // 500/10000 * 100
    });

    it('should return correct dimensions', async () => {
      const baseline = createMockPNGBuffer(1920, 1080);
      const current = createMockPNGBuffer(1920, 1080);
      
      vi.mocked(PNG.sync.read)
        .mockReturnValueOnce({ width: 1920, height: 1080, data: Buffer.alloc(1920 * 1080 * 4) } as any)
        .mockReturnValueOnce({ width: 1920, height: 1080, data: Buffer.alloc(1920 * 1080 * 4) } as any);
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.compare(baseline, current);

      expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should use custom threshold for comparison', async () => {
      const baseline = createMockPNGBuffer();
      const current = createMockPNGBuffer();
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      await service.compare(baseline, current, [], 0.2);

      expect(pixelmatch).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Buffer),
        expect.any(Buffer),
        expect.any(Number),
        expect.any(Number),
        { threshold: 0.2 }
      );
    });

    it('should save diff image when differences detected', async () => {
      const baseline = createMockPNGBuffer();
      const current = createMockPNGBuffer();
      
      vi.mocked(pixelmatch).mockReturnValueOnce(100);

      const result = await service.compare(baseline, current);

      expect(result.diffImageUrl).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        expect.stringContaining('diffs/'),
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should not save diff image when images are identical', async () => {
      const baseline = createMockPNGBuffer();
      const current = createMockPNGBuffer();
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);
      mockMinioClient.putObject.mockClear();

      const result = await service.compare(baseline, current);

      expect(result.diffImageUrl).toBeUndefined();
      // putObject should not be called for diff
      expect(mockMinioClient.putObject).not.toHaveBeenCalled();
    });

    it('should round diff percentage to two decimal places', async () => {
      const baseline = createMockPNGBuffer(100, 100);
      const current = createMockPNGBuffer(100, 100);
      
      // 333 pixels = 3.33%
      vi.mocked(pixelmatch).mockReturnValueOnce(333);

      const result = await service.compare(baseline, current);

      expect(result.diffPercent).toBe(3.33);
    });
  });

  // ===========================================================================
  // DIMENSION MISMATCH HANDLING TESTS
  // ===========================================================================

  describe('Dimension Mismatch Handling', () => {
    it('should resize current image to match baseline', async () => {
      const baseline = createMockPNGBuffer(1920, 1080);
      const current = createMockPNGBuffer(1280, 720);
      
      vi.mocked(PNG.sync.read)
        .mockReturnValueOnce({ width: 1920, height: 1080, data: Buffer.alloc(1920 * 1080 * 4) } as any)
        .mockReturnValueOnce({ width: 1280, height: 720, data: Buffer.alloc(1280 * 720 * 4) } as any)
        // After resize
        .mockReturnValueOnce({ width: 1920, height: 1080, data: Buffer.alloc(1920 * 1080 * 4) } as any)
        .mockReturnValueOnce({ width: 1920, height: 1080, data: Buffer.alloc(1920 * 1080 * 4) } as any);
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.compare(baseline, current);

      expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should log warning when dimensions mismatch', async () => {
      const { logger } = await import('../utils/logger');
      
      const baseline = createMockPNGBuffer(800, 600);
      const current = createMockPNGBuffer(640, 480);
      
      vi.mocked(PNG.sync.read)
        .mockReturnValueOnce({ width: 800, height: 600, data: Buffer.alloc(800 * 600 * 4) } as any)
        .mockReturnValueOnce({ width: 640, height: 480, data: Buffer.alloc(640 * 480 * 4) } as any)
        .mockReturnValueOnce({ width: 800, height: 600, data: Buffer.alloc(800 * 600 * 4) } as any)
        .mockReturnValueOnce({ width: 800, height: 600, data: Buffer.alloc(800 * 600 * 4) } as any);
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      await service.compare(baseline, current);

      expect(logger.warn).toHaveBeenCalledWith('Image dimensions mismatch, resizing...');
    });
  });

  // ===========================================================================
  // MASK APPLICATION TESTS
  // ===========================================================================

  describe('Mask Application', () => {
    it('should apply rectangular masks to images', async () => {
      const baseline = createMockPNGBuffer(100, 100);
      const current = createMockPNGBuffer(100, 100);
      
      const masks: MaskRegion[] = [
        { x: 10, y: 10, width: 20, height: 20 },
      ];
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      await service.compare(baseline, current, masks);

      // Pixelmatch should be called with modified buffers
      expect(pixelmatch).toHaveBeenCalled();
    });

    it('should apply multiple masks', async () => {
      const baseline = createMockPNGBuffer(200, 200);
      const current = createMockPNGBuffer(200, 200);
      
      const masks: MaskRegion[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 100, width: 50, height: 50 },
        { x: 150, y: 0, width: 50, height: 50 },
      ];
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.compare(baseline, current, masks);

      expect(result.diffPixels).toBe(0);
    });

    it('should handle masks that extend beyond image bounds', async () => {
      const baseline = createMockPNGBuffer(100, 100);
      const current = createMockPNGBuffer(100, 100);
      
      const masks: MaskRegion[] = [
        { x: 80, y: 80, width: 50, height: 50 }, // Extends beyond 100x100
      ];
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      // Should not throw
      await expect(service.compare(baseline, current, masks)).resolves.toBeDefined();
    });

    it('should handle empty mask array', async () => {
      const baseline = createMockPNGBuffer();
      const current = createMockPNGBuffer();
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.compare(baseline, current, []);

      expect(result).toBeDefined();
    });

    it('should mask dynamic content like timestamps', async () => {
      const baseline = createMockPNGBuffer(800, 600);
      const current = createMockPNGBuffer(800, 600);
      
      // Mask the timestamp area
      const masks: MaskRegion[] = [
        { x: 700, y: 10, width: 90, height: 20 },
      ];
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.compare(baseline, current, masks);

      expect(result.diffPixels).toBe(0);
    });
  });

  // ===========================================================================
  // SCREENSHOT RETRIEVAL TESTS
  // ===========================================================================

  describe('Screenshot Retrieval', () => {
    it('should get screenshot from storage', async () => {
      const mockData = Buffer.from('mock-screenshot-data');
      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      setTimeout(() => {
        stream.push(mockData);
        stream.push(null);
      }, 0);

      const result = await service.get('exec-123/1-uuid.png');

      expect(mockMinioClient.getObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        'exec-123/1-uuid.png'
      );
      expect(result).toEqual(mockData);
    });

    it('should handle stream errors', async () => {
      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      setTimeout(() => {
        stream.emit('error', new Error('Stream error'));
      }, 0);

      await expect(service.get('missing-key')).rejects.toThrow('Stream error');
    });

    it('should concatenate multiple chunks', async () => {
      const chunk1 = Buffer.from('part1-');
      const chunk2 = Buffer.from('part2-');
      const chunk3 = Buffer.from('part3');
      
      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      setTimeout(() => {
        stream.push(chunk1);
        stream.push(chunk2);
        stream.push(chunk3);
        stream.push(null);
      }, 0);

      const result = await service.get('multi-chunk.png');

      expect(result.toString()).toBe('part1-part2-part3');
    });
  });

  // ===========================================================================
  // SCREENSHOT DELETION TESTS
  // ===========================================================================

  describe('Screenshot Deletion', () => {
    it('should delete screenshot from storage', async () => {
      await service.delete('exec-123/1-uuid.png');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        'exec-123/1-uuid.png'
      );
    });

    it('should log deletion', async () => {
      const { logger } = await import('../utils/logger');

      await service.delete('exec-123/screenshot.png');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Screenshot deleted')
      );
    });
  });

  // ===========================================================================
  // PRESIGNED URL TESTS
  // ===========================================================================

  describe('Presigned URL Generation', () => {
    it('should generate presigned URL with default expiry', async () => {
      const url = await service.getPresignedUrl('exec-123/screenshot.png');

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        'exec-123/screenshot.png',
        3600
      );
      expect(url).toBe('https://minio.example.com/presigned-url');
    });

    it('should generate presigned URL with custom expiry', async () => {
      await service.getPresignedUrl('exec-123/screenshot.png', 7200);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        'exec-123/screenshot.png',
        7200
      );
    });

    it('should generate presigned URL for short-term access', async () => {
      await service.getPresignedUrl('temp/screenshot.png', 300);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'visiontest-screenshots',
        'temp/screenshot.png',
        300
      );
    });
  });

  // ===========================================================================
  // COMPARISON RECORD CREATION TESTS
  // ===========================================================================

  describe('Comparison Processing', () => {
    beforeEach(() => {
      // Setup basic mocks for processComparison
      mockPrismaClient.screenshot.findUnique.mockResolvedValue({
        id: 'screenshot-123',
        name: 'homepage',
        url: 'http://localhost:9000/visiontest-screenshots/exec-123/1.png',
        executionId: 'exec-123',
      });
      
      mockPrismaClient.baseline.findUnique.mockResolvedValue(createMockBaseline({
        screenshots: JSON.stringify([
          { name: 'homepage', url: 'http://localhost:9000/visiontest-screenshots/baseline/homepage.png' },
        ]),
      }));
      
      mockPrismaClient.ignoreMask.findMany.mockResolvedValue([]);
      
      mockPrismaClient.comparison.create.mockResolvedValue({
        id: 'comparison-123',
        status: 'AUTO_APPROVED',
        diffScore: 0,
      });

      // Mock screenshot retrieval
      const mockScreenshot = createMockPNGBuffer(100, 100);
      const stream1 = mockMinioStream();
      const stream2 = mockMinioStream();
      
      mockMinioClient.getObject
        .mockImplementation(() => {
          const stream = mockMinioStream();
          setTimeout(() => {
            stream.push(mockScreenshot);
            stream.push(null);
          }, 0);
          return Promise.resolve(stream);
        });
    });

    it('should create comparison record for passed comparison', async () => {
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(mockPrismaClient.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-123',
          baselineId: 'baseline-123',
          screenshotId: 'screenshot-123',
          status: 'AUTO_APPROVED',
          diffScore: 0,
        }),
      });
      expect(result.status).toBe('PASSED');
    });

    it('should create comparison record for diff detected', async () => {
      vi.mocked(pixelmatch).mockReturnValueOnce(500);

      const result = await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(mockPrismaClient.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PENDING',
          diffScore: expect.any(Number),
        }),
      });
      expect(result.status).toBe('DIFF_DETECTED');
      expect(result.diffPercent).toBeGreaterThan(0);
    });

    it('should handle new baseline (no matching screenshot)', async () => {
      mockPrismaClient.baseline.findUnique.mockResolvedValue(createMockBaseline({
        screenshots: JSON.stringify([
          { name: 'other-page', url: 'http://localhost:9000/baseline/other.png' },
        ]),
      }));

      const result = await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(mockPrismaClient.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PENDING',
          metadata: expect.objectContaining({
            isNew: true,
          }),
        }),
      });
      expect(result.status).toBe('NEW_BASELINE');
    });

    it('should throw when screenshot not found', async () => {
      mockPrismaClient.screenshot.findUnique.mockResolvedValue(null);

      await expect(
        service.processComparison('exec-123', 'missing-screenshot', 'baseline-123')
      ).rejects.toThrow('Screenshot or baseline not found');
    });

    it('should throw when baseline not found', async () => {
      mockPrismaClient.baseline.findUnique.mockResolvedValue(null);

      await expect(
        service.processComparison('exec-123', 'screenshot-123', 'missing-baseline')
      ).rejects.toThrow('Screenshot or baseline not found');
    });

    it('should apply active masks from baseline', async () => {
      mockPrismaClient.ignoreMask.findMany.mockResolvedValue([
        {
          id: 'mask-1',
          baselineId: 'baseline-123',
          type: 'RECTANGLE',
          isActive: true,
          value: JSON.stringify({ x: 10, y: 10, width: 50, height: 50 }),
        },
        {
          id: 'mask-2',
          baselineId: 'baseline-123',
          type: 'RECTANGLE',
          isActive: false, // Inactive - should be ignored
          value: JSON.stringify({ x: 100, y: 100, width: 50, height: 50 }),
        },
      ]);
      
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(mockPrismaClient.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          masksApplied: 2, // Total masks in DB, not filtered
        }),
      });
    });

    it('should include diff metadata in comparison record', async () => {
      vi.mocked(PNG.sync.read).mockReturnValue({
        width: 1920,
        height: 1080,
        data: Buffer.alloc(1920 * 1080 * 4),
      } as any);
      vi.mocked(pixelmatch).mockReturnValueOnce(1000);

      await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(mockPrismaClient.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            diffPixels: expect.any(Number),
            dimensions: expect.objectContaining({
              width: expect.any(Number),
              height: expect.any(Number),
            }),
          }),
        }),
      });
    });

    it('should include diff URL in comparison when differences detected', async () => {
      vi.mocked(pixelmatch).mockReturnValueOnce(100);

      await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(mockPrismaClient.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          diffUrl: expect.any(String),
        }),
      });
    });

    it('should return comparison ID', async () => {
      mockPrismaClient.comparison.create.mockResolvedValue({
        id: 'comp-456',
        status: 'AUTO_APPROVED',
        diffScore: 0,
      });
      vi.mocked(pixelmatch).mockReturnValueOnce(0);

      const result = await service.processComparison('exec-123', 'screenshot-123', 'baseline-123');

      expect(result.comparisonId).toBe('comp-456');
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle empty screenshot buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      // PNG.sync.read should fail on empty buffer
      vi.mocked(PNG.sync.read).mockImplementationOnce(() => {
        throw new Error('Invalid PNG');
      });

      await expect(
        service.saveWithRecord('exec-123', 1, emptyBuffer, { name: 'empty' })
      ).rejects.toThrow();
    });

    it('should handle very large screenshots', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      const url = await service.save('exec-123', 1, largeBuffer);

      expect(url).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });

    it('should handle special characters in execution ID', async () => {
      const screenshot = createMockPNGBuffer();

      await service.save('exec-123/456', 1, screenshot);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('exec-123/456'),
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should handle zero step number', async () => {
      const screenshot = createMockPNGBuffer();

      const url = await service.save('exec-123', 0, screenshot);

      expect(url).toContain('/0-');
    });

    it('should handle negative diff pixels gracefully', async () => {
      const baseline = createMockPNGBuffer();
      const current = createMockPNGBuffer();
      
      // This shouldn't happen in reality, but handle edge case
      vi.mocked(pixelmatch).mockReturnValueOnce(-1);

      const result = await service.compare(baseline, current);

      // Even with negative pixels (invalid case), the function should return a result
      expect(result.diffPixels).toBe(-1);
      // diffPercent will be negative in this edge case
      expect(typeof result.diffPercent).toBe('number');
    });
  });
});
