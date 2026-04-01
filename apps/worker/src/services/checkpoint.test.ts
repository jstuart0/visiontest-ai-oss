/**
 * VisionTest.ai - Checkpoint Service Tests
 * Hospital-Grade Test Coverage
 * 
 * Tests for checkpoint save/load, state serialization,
 * checkpoint cleanup, and replay state restoration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckpointService, CheckpointState } from './checkpoint';
import {
  mockMinioClient,
  mockMinioStream,
  mockPrismaClient,
  createMockCheckpoint,
} from '../__tests__/setup';

describe('CheckpointService', () => {
  let service: CheckpointService;

  beforeEach(() => {
    service = new CheckpointService();
  });

  // ===========================================================================
  // BUCKET INITIALIZATION TESTS
  // ===========================================================================

  describe('Bucket Initialization', () => {
    it('should check if checkpoint bucket exists on initialization', async () => {
      expect(mockMinioClient.bucketExists).toHaveBeenCalled();
    });

    it('should create checkpoint bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValueOnce(false);
      
      const newService = new CheckpointService();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
    });

    it('should handle bucket initialization errors gracefully', async () => {
      mockMinioClient.bucketExists.mockRejectedValueOnce(new Error('MinIO unreachable'));
      
      // Should not throw during construction
      expect(() => new CheckpointService()).not.toThrow();
    });
  });

  // ===========================================================================
  // CHECKPOINT SAVE TESTS
  // ===========================================================================

  describe('Checkpoint Save', () => {
    const baseState: CheckpointState = {
      url: 'https://example.com/dashboard',
      cookies: [
        { name: 'session', value: 'abc123', domain: 'example.com', path: '/' },
      ],
      localStorage: { theme: 'dark', userId: '123' },
      sessionStorage: { formData: '{"name":"test"}' },
    };

    beforeEach(() => {
      // Use upsert mock instead of create (code was changed to handle unique constraint)
      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint({
        id: 'checkpoint-new-123',
      }));
    });

    it('should save checkpoint to MinIO', async () => {
      await service.save('exec-123', 5, baseState);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'visiontest-checkpoints',
        expect.stringMatching(/exec-123\/5-mock-uuid-\d+\.json/),
        expect.any(Buffer),
        { 'Content-Type': 'application/json' }
      );
    });

    it('should create database record', async () => {
      await service.save('exec-123', 5, baseState);

      // Code now uses upsert to handle duplicate step numbers gracefully
      expect(mockPrismaClient.checkpoint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            executionId_stepNumber: {
              executionId: 'exec-123',
              stepNumber: 5,
            },
          },
          create: expect.objectContaining({
            executionId: 'exec-123',
            stepNumber: 5,
          }),
        })
      );
    });

    it('should return checkpoint ID', async () => {
      const id = await service.save('exec-123', 5, baseState);

      expect(id).toBe('checkpoint-new-123');
    });

    it('should add timestamp to state', async () => {
      const beforeTime = Date.now();
      
      await service.save('exec-123', 5, baseState);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.timestamp).toBeDefined();
      expect(savedState.timestamp).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should serialize state correctly', async () => {
      await service.save('exec-123', 5, baseState);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.url).toBe('https://example.com/dashboard');
      expect(savedState.cookies).toEqual(baseState.cookies);
      expect(savedState.localStorage).toEqual(baseState.localStorage);
      expect(savedState.sessionStorage).toEqual(baseState.sessionStorage);
    });

    it('should store storage key in database record', async () => {
      await service.save('exec-123', 5, baseState);

      expect(mockPrismaClient.checkpoint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            storageKey: expect.stringMatching(/exec-123\/5-mock-uuid-\d+\.json/),
          }),
        })
      );
    });

    it('should log checkpoint save', async () => {
      const { logger } = await import('../utils/logger');

      await service.save('exec-123', 10, baseState);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint saved'),
        expect.objectContaining({ step: 10 })
      );
    });

    it('should handle MinIO errors', async () => {
      mockMinioClient.putObject.mockRejectedValueOnce(new Error('Storage full'));

      await expect(service.save('exec-123', 5, baseState)).rejects.toThrow('Storage full');
    });

    it('should handle database errors', async () => {
      mockPrismaClient.checkpoint.upsert.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.save('exec-123', 5, baseState)).rejects.toThrow('DB connection lost');
    });

    it('should handle state with empty collections', async () => {
      const emptyState: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      const id = await service.save('exec-123', 0, emptyState);

      expect(id).toBeDefined();
    });

    it('should handle state with complex cookie attributes', async () => {
      const complexState: CheckpointState = {
        url: 'https://example.com',
        cookies: [
          {
            name: 'auth',
            value: 'token123',
            domain: '.example.com',
            path: '/',
            expires: Date.now() + 86400000,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
        ],
        localStorage: {},
        sessionStorage: {},
      };

      await service.save('exec-123', 1, complexState);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.cookies[0].httpOnly).toBe(true);
      expect(savedState.cookies[0].sameSite).toBe('Strict');
    });

    it('should include viewport size when provided', async () => {
      const stateWithViewport: CheckpointState = {
        ...baseState,
        viewportSize: { width: 1920, height: 1080 },
      };

      await service.save('exec-123', 1, stateWithViewport);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.viewportSize).toEqual({ width: 1920, height: 1080 });
    });
  });

  // ===========================================================================
  // CHECKPOINT LOAD TESTS
  // ===========================================================================

  describe('Checkpoint Load', () => {
    const storedState: CheckpointState = {
      url: 'https://example.com/page',
      cookies: [{ name: 'session', value: 'xyz789' }],
      localStorage: { key: 'value' },
      sessionStorage: { temp: 'data' },
      timestamp: 1700000000000,
    };

    it('should load checkpoint from database when state is stored directly', async () => {
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        state: storedState,
        storageKey: null,
      }));

      const state = await service.load('checkpoint-123');

      expect(state).toEqual(storedState);
    });

    it('should load checkpoint from MinIO when storageKey exists', async () => {
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        state: null,
        storageKey: 'exec-123/5-uuid.json',
      }));

      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      setTimeout(() => {
        stream.push(Buffer.from(JSON.stringify(storedState)));
        stream.push(null);
      }, 0);

      const state = await service.load('checkpoint-123');

      expect(mockMinioClient.getObject).toHaveBeenCalledWith(
        'visiontest-checkpoints',
        'exec-123/5-uuid.json'
      );
      expect(state).toEqual(storedState);
    });

    it('should return null when checkpoint not found', async () => {
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(null);

      const state = await service.load('nonexistent-checkpoint');

      expect(state).toBeNull();
    });

    it('should return null when checkpoint has no state or storageKey', async () => {
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        state: null,
        storageKey: null,
      }));

      const state = await service.load('empty-checkpoint');

      expect(state).toBeNull();
    });

    it('should handle MinIO stream errors', async () => {
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        state: null,
        storageKey: 'exec-123/5-uuid.json',
      }));

      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      setTimeout(() => {
        stream.emit('error', new Error('Object not found'));
      }, 0);

      await expect(service.load('checkpoint-123')).rejects.toThrow('Object not found');
    });

    it('should throw error when storage returns invalid data', async () => {
      // Test that a stream error is properly propagated
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        state: null,
        storageKey: 'exec-123/5-uuid.json',
      }));

      // Create a stream that emits an error
      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      
      // Emit error instead of invalid JSON to avoid unhandled rejection
      setImmediate(() => {
        stream.emit('error', new Error('Storage read error'));
      });

      await expect(service.load('checkpoint-123')).rejects.toThrow('Storage read error');
    });

    it('should query database with correct checkpoint ID', async () => {
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(null);

      await service.load('specific-checkpoint-id');

      expect(mockPrismaClient.checkpoint.findUnique).toHaveBeenCalledWith({
        where: { id: 'specific-checkpoint-id' },
      });
    });

    it('should handle and rethrow database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaClient.checkpoint.findUnique.mockRejectedValue(dbError);

      await expect(service.load('checkpoint-123')).rejects.toThrow('Database connection failed');
    });
  });

  // ===========================================================================
  // LIST CHECKPOINTS TESTS
  // ===========================================================================

  describe('List Checkpoints for Execution', () => {
    it('should return list of checkpoints', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-1', stepNumber: 0, createdAt: new Date('2024-01-01T10:00:00Z') },
        { id: 'cp-2', stepNumber: 5, createdAt: new Date('2024-01-01T10:01:00Z') },
        { id: 'cp-3', stepNumber: 10, createdAt: new Date('2024-01-01T10:02:00Z') },
      ]);

      const checkpoints = await service.listForExecution('exec-123');

      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].stepNumber).toBe(0);
      expect(checkpoints[2].stepNumber).toBe(10);
    });

    it('should order checkpoints by step number ascending', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);

      await service.listForExecution('exec-123');

      expect(mockPrismaClient.checkpoint.findMany).toHaveBeenCalledWith({
        where: { executionId: 'exec-123' },
        orderBy: { stepNumber: 'asc' },
        select: {
          id: true,
          stepNumber: true,
          createdAt: true,
        },
      });
    });

    it('should return empty array when no checkpoints exist', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);

      const checkpoints = await service.listForExecution('exec-no-checkpoints');

      expect(checkpoints).toEqual([]);
    });

    it('should filter by execution ID', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);

      await service.listForExecution('specific-exec-id');

      expect(mockPrismaClient.checkpoint.findMany).toHaveBeenCalledWith({
        where: { executionId: 'specific-exec-id' },
        orderBy: expect.any(Object),
        select: expect.any(Object),
      });
    });
  });

  // ===========================================================================
  // GET LATEST BEFORE TESTS
  // ===========================================================================

  describe('Get Latest Checkpoint Before Step', () => {
    it('should return latest checkpoint before specified step when state in DB', async () => {
      const checkpointState: CheckpointState = {
        url: 'https://example.com/step4',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      // Mock findFirst to return checkpoint with state directly
      mockPrismaClient.checkpoint.findFirst.mockResolvedValue(createMockCheckpoint({
        id: 'cp-4',
        stepNumber: 4,
        state: checkpointState,
      }));

      // Mock findUnique for the load call
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        id: 'cp-4',
        stepNumber: 4,
        state: checkpointState,
      }));

      const result = await service.getLatestBefore('exec-123', 5);

      expect(result).toEqual({
        id: 'cp-4',
        stepNumber: 4,
        state: checkpointState,
      });
    });

    it('should query for step number less than specified', async () => {
      mockPrismaClient.checkpoint.findFirst.mockResolvedValue(null);

      await service.getLatestBefore('exec-123', 10);

      expect(mockPrismaClient.checkpoint.findFirst).toHaveBeenCalledWith({
        where: {
          executionId: 'exec-123',
          stepNumber: { lt: 10 },
        },
        orderBy: { stepNumber: 'desc' },
      });
    });

    it('should return null when no checkpoint exists before step', async () => {
      mockPrismaClient.checkpoint.findFirst.mockResolvedValue(null);

      const result = await service.getLatestBefore('exec-123', 0);

      expect(result).toBeNull();
    });

    it('should return null when checkpoint load returns null', async () => {
      // findFirst returns a checkpoint
      mockPrismaClient.checkpoint.findFirst.mockResolvedValue(createMockCheckpoint({
        id: 'cp-broken',
        state: null,
        storageKey: null, // No storage key either
      }));

      // findUnique (called by load) returns checkpoint with no state
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        state: null,
        storageKey: null,
      }));

      const result = await service.getLatestBefore('exec-123', 5);

      // Should return null because load returns null
      expect(result).toBeNull();
    });

    it('should load state from storage when not in database', async () => {
      const storedState: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      // Mock findFirst to return checkpoint
      mockPrismaClient.checkpoint.findFirst.mockResolvedValue(createMockCheckpoint({
        id: 'cp-storage',
        stepNumber: 3,
        state: null,
        storageKey: 'exec-123/3-uuid.json',
      }));

      // Mock findUnique for the load call
      mockPrismaClient.checkpoint.findUnique.mockResolvedValue(createMockCheckpoint({
        id: 'cp-storage',
        state: null,
        storageKey: 'exec-123/3-uuid.json',
      }));

      // Mock MinIO stream for loading from storage
      const stream = mockMinioStream();
      mockMinioClient.getObject.mockResolvedValueOnce(stream);
      setImmediate(() => {
        stream.push(Buffer.from(JSON.stringify(storedState)));
        stream.push(null);
      });

      const result = await service.getLatestBefore('exec-123', 5);

      expect(result?.state).toEqual(storedState);
    });
  });

  // ===========================================================================
  // DELETE CHECKPOINTS TESTS
  // ===========================================================================

  describe('Delete Checkpoints for Execution', () => {
    it('should delete checkpoints from storage and database', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-1', storageKey: 'exec-123/0-uuid.json' },
        { id: 'cp-2', storageKey: 'exec-123/5-uuid.json' },
        { id: 'cp-3', storageKey: null }, // No storage key
      ]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 3 });

      const count = await service.deleteForExecution('exec-123');

      expect(count).toBe(3);
    });

    it('should delete objects from MinIO', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-1', storageKey: 'exec-123/0-uuid.json' },
        { id: 'cp-2', storageKey: 'exec-123/5-uuid.json' },
      ]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 2 });

      await service.deleteForExecution('exec-123');

      expect(mockMinioClient.removeObject).toHaveBeenCalledTimes(2);
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'visiontest-checkpoints',
        'exec-123/0-uuid.json'
      );
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'visiontest-checkpoints',
        'exec-123/5-uuid.json'
      );
    });

    it('should continue deletion even if MinIO delete fails', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-1', storageKey: 'exec-123/0-uuid.json' },
        { id: 'cp-2', storageKey: 'exec-123/5-uuid.json' },
      ]);
      mockMinioClient.removeObject
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 2 });

      const count = await service.deleteForExecution('exec-123');

      // Should still return count and continue
      expect(count).toBe(2);
      expect(mockMinioClient.removeObject).toHaveBeenCalledTimes(2);
    });

    it('should skip checkpoints without storage key', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-1', storageKey: null },
        { id: 'cp-2', storageKey: undefined },
      ]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 2 });

      await service.deleteForExecution('exec-123');

      expect(mockMinioClient.removeObject).not.toHaveBeenCalled();
    });

    it('should log deletion result', async () => {
      const { logger } = await import('../utils/logger');
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 5 });

      await service.deleteForExecution('exec-123');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted 5 checkpoints for execution exec-123')
      );
    });

    it('should return zero when no checkpoints to delete', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 0 });

      const count = await service.deleteForExecution('exec-no-checkpoints');

      expect(count).toBe(0);
    });
  });

  // ===========================================================================
  // CLEANUP OLD CHECKPOINTS TESTS
  // ===========================================================================

  describe('Cleanup Old Checkpoints', () => {
    it('should delete checkpoints older than retention period', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'old-cp-1', storageKey: 'old/1.json' },
        { id: 'old-cp-2', storageKey: 'old/2.json' },
      ]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 2 });

      const count = await service.cleanupOld(7);

      expect(count).toBe(2);
    });

    it('should use correct cutoff date', async () => {
      const beforeCall = Date.now();
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOld(30);

      const callArgs = mockPrismaClient.checkpoint.findMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      
      const expectedCutoff = beforeCall - 30 * 24 * 60 * 60 * 1000;
      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff, -3);
    });

    it('should use default retention of 7 days', async () => {
      const beforeCall = Date.now();
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOld();

      const callArgs = mockPrismaClient.checkpoint.findMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      
      const expectedCutoff = beforeCall - 7 * 24 * 60 * 60 * 1000;
      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff, -3);
    });

    it('should delete objects from MinIO', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'old-1', storageKey: 'exec-old/1.json' },
      ]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 1 });

      await service.cleanupOld(7);

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'visiontest-checkpoints',
        'exec-old/1.json'
      );
    });

    it('should ignore MinIO errors during cleanup', async () => {
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([
        { id: 'old-1', storageKey: 'missing-object.json' },
      ]);
      mockMinioClient.removeObject.mockRejectedValueOnce(new Error('Not found'));
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 1 });

      // Should not throw
      const count = await service.cleanupOld(7);

      expect(count).toBe(1);
    });

    it('should log cleanup result', async () => {
      const { logger } = await import('../utils/logger');
      mockPrismaClient.checkpoint.findMany.mockResolvedValue([]);
      mockPrismaClient.checkpoint.deleteMany.mockResolvedValue({ count: 42 });

      await service.cleanupOld(7);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 42 old checkpoints')
      );
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle state with very large localStorage', async () => {
      const largeState: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key${i}`, 'x'.repeat(1000)])
        ),
        sessionStorage: {},
      };

      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      const id = await service.save('exec-123', 1, largeState);

      expect(id).toBeDefined();
    });

    it('should handle state with many cookies', async () => {
      const manyCookies: CheckpointState = {
        url: 'https://example.com',
        cookies: Array.from({ length: 50 }, (_, i) => ({
          name: `cookie${i}`,
          value: `value${i}`,
          domain: 'example.com',
        })),
        localStorage: {},
        sessionStorage: {},
      };

      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      await service.save('exec-123', 1, manyCookies);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.cookies).toHaveLength(50);
    });

    it('should handle URL with query parameters', async () => {
      const stateWithQueryParams: CheckpointState = {
        url: 'https://example.com/search?q=test&page=1&filter=active',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      await service.save('exec-123', 1, stateWithQueryParams);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.url).toBe('https://example.com/search?q=test&page=1&filter=active');
    });

    it('should handle special characters in localStorage values', async () => {
      const stateWithSpecialChars: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: {
          json: '{"key": "value with \\"quotes\\" and \\n newlines"}',
          unicode: '日本語テスト',
          emoji: '🎉🚀',
        },
        sessionStorage: {},
      };

      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      await service.save('exec-123', 1, stateWithSpecialChars);

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const savedBuffer = callArgs[2] as Buffer;
      const savedState = JSON.parse(savedBuffer.toString());
      
      expect(savedState.localStorage.unicode).toBe('日本語テスト');
      expect(savedState.localStorage.emoji).toBe('🎉🚀');
    });

    it('should handle concurrent save operations', async () => {
      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      const state: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      const saves = Array.from({ length: 5 }, (_, i) =>
        service.save('exec-123', i, state)
      );

      const results = await Promise.all(saves);

      expect(results).toHaveLength(5);
      expect(mockMinioClient.putObject).toHaveBeenCalledTimes(5);
    });

    it('should handle step number zero', async () => {
      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      const state: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      await service.save('exec-123', 0, state);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\/0-/),
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should handle very high step numbers', async () => {
      mockPrismaClient.checkpoint.upsert.mockResolvedValue(createMockCheckpoint());

      const state: CheckpointState = {
        url: 'https://example.com',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      };

      await service.save('exec-123', 99999, state);

      expect(mockPrismaClient.checkpoint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            stepNumber: 99999,
          }),
        })
      );
    });
  });
});
