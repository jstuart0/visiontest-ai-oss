// VisionTest AI - Masks Service Tests
// Hospital-Grade: Ignore mask testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { masksService } from './masks.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    ignoreMask: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    comparison: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  MaskType: {
    RECTANGLE: 'RECTANGLE',
    SELECTOR: 'SELECTOR',
    XPATH: 'XPATH',
    REGEX: 'REGEX',
    AI_DETECTED: 'AI_DETECTED',
  },
}));

describe('MasksService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list masks for a project', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockMasks = [
        {
          id: 'mask-1',
          projectId: 'project-1',
          type: 'SELECTOR',
          value: '.timestamp',
          isActive: true,
          isGlobal: false,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.findMany).mockResolvedValue(mockMasks as any);

      const result = await masksService.list('user-1', 'project-1');

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('.timestamp');
    });

    it('should parse RECTANGLE values', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockMasks = [
        {
          id: 'mask-1',
          type: 'RECTANGLE',
          value: JSON.stringify({ x: 10, y: 20, width: 100, height: 50 }),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.findMany).mockResolvedValue(mockMasks as any);

      const result = await masksService.list('user-1', 'project-1');

      expect(result[0].value).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('should include global masks when requested', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.findMany).mockResolvedValue([]);

      await masksService.list('user-1', 'project-1', { includeGlobal: true });

      expect(prisma.ignoreMask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ isGlobal: true }]),
          }),
        })
      );
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(masksService.list('user-1', 'project-1')).rejects.toThrow('No access');
    });
  });

  describe('create', () => {
    it('should create a selector mask', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockMask = {
        id: 'mask-1',
        projectId: 'project-1',
        type: 'SELECTOR',
        value: '.timestamp',
        reason: 'Dynamic content',
        isActive: true,
        isGlobal: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.create).mockResolvedValue(mockMask as any);

      const result = await masksService.create('user-1', {
        projectId: 'project-1',
        type: 'SELECTOR',
        value: '.timestamp',
        reason: 'Dynamic content',
      });

      expect(result.type).toBe('SELECTOR');
      expect(result.value).toBe('.timestamp');
    });

    it('should serialize rectangle values', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockMask = {
        id: 'mask-1',
        projectId: 'project-1',
        type: 'RECTANGLE',
        value: JSON.stringify({ x: 10, y: 20, width: 100, height: 50 }),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.create).mockResolvedValue(mockMask as any);

      await masksService.create('user-1', {
        projectId: 'project-1',
        type: 'RECTANGLE',
        value: { x: 10, y: 20, width: 100, height: 50 },
      });

      expect(prisma.ignoreMask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            value: JSON.stringify({ x: 10, y: 20, width: 100, height: 50 }),
          }),
        })
      );
    });

    it('should create global mask', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockMask = {
        id: 'mask-1',
        type: 'SELECTOR',
        value: '.ad',
        isGlobal: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.create).mockResolvedValue(mockMask as any);

      const result = await masksService.create('user-1', {
        projectId: 'project-1',
        type: 'SELECTOR',
        value: '.ad',
        isGlobal: true,
      });

      expect(result.isGlobal).toBe(true);
    });
  });

  describe('getById', () => {
    it('should get mask by ID', async () => {
      const mockMask = {
        id: 'mask-1',
        type: 'SELECTOR',
        value: '.timestamp',
        isActive: true,
        project: { org: { users: [{ userId: 'user-1' }] } },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.ignoreMask.findUnique).mockResolvedValue(mockMask as any);

      const result = await masksService.getById('user-1', 'mask-1');

      expect(result.id).toBe('mask-1');
    });

    it('should throw NotFoundError for missing mask', async () => {
      vi.mocked(prisma.ignoreMask.findUnique).mockResolvedValue(null);

      await expect(masksService.getById('user-1', 'mask-1')).rejects.toThrow('not found');
    });

    it('should throw ForbiddenError when no access', async () => {
      const mockMask = {
        id: 'mask-1',
        project: { org: { users: [] } },
      };

      vi.mocked(prisma.ignoreMask.findUnique).mockResolvedValue(mockMask as any);

      await expect(masksService.getById('user-1', 'mask-1')).rejects.toThrow('No access');
    });
  });

  describe('update', () => {
    it('should update a mask', async () => {
      const mockMask = {
        id: 'mask-1',
        type: 'SELECTOR',
        value: '.old',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };
      const updatedMask = {
        ...mockMask,
        value: '.new',
        type: 'SELECTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.ignoreMask.findUnique).mockResolvedValue(mockMask as any);
      vi.mocked(prisma.ignoreMask.update).mockResolvedValue(updatedMask as any);

      const result = await masksService.update('user-1', 'mask-1', { value: '.new' });

      expect(result.value).toBe('.new');
    });

    it('should update isActive status', async () => {
      const mockMask = {
        id: 'mask-1',
        type: 'SELECTOR',
        value: '.timestamp',
        isActive: true,
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.ignoreMask.findUnique).mockResolvedValue(mockMask as any);
      vi.mocked(prisma.ignoreMask.update).mockResolvedValue({
        ...mockMask,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await masksService.update('user-1', 'mask-1', { isActive: false });

      expect(prisma.ignoreMask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a mask', async () => {
      const mockMask = {
        id: 'mask-1',
        project: { org: { users: [{ userId: 'user-1' }] } },
      };

      vi.mocked(prisma.ignoreMask.findUnique).mockResolvedValue(mockMask as any);
      vi.mocked(prisma.ignoreMask.delete).mockResolvedValue(mockMask as any);

      await masksService.delete('user-1', 'mask-1');

      expect(prisma.ignoreMask.delete).toHaveBeenCalledWith({ where: { id: 'mask-1' } });
    });
  });

  describe('aiDetect', () => {
    it('should return AI suggestions', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      const result = await masksService.aiDetect('user-1', 'project-1', 'https://example.com/screenshot.png');

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.screenshotUrl).toBe('https://example.com/screenshot.png');
      expect(result.analyzedAt).toBeDefined();
    });

    it('should include timestamp detection', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      const result = await masksService.aiDetect('user-1', 'project-1', 'https://example.com/screenshot.png');

      const timestampSuggestion = result.suggestions.find((s) => s.category === 'timestamp');
      expect(timestampSuggestion).toBeDefined();
      expect(timestampSuggestion!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('applyToComparison', () => {
    it('should apply masks to comparison', async () => {
      const mockComparison = {
        id: 'comparison-1',
        metadata: {},
        execution: {
          project: { org: { users: [{ userId: 'user-1' }] } },
        },
      };
      const mockMasks = [
        { id: 'mask-1' },
        { id: 'mask-2' },
      ];

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.ignoreMask.findMany).mockResolvedValue(mockMasks as any);
      vi.mocked(prisma.comparison.update).mockResolvedValue({} as any);

      const result = await masksService.applyToComparison('user-1', 'comparison-1', ['mask-1', 'mask-2']);

      expect(result.masksApplied).toBe(2);
    });

    it('should throw when comparison not found', async () => {
      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(null);

      await expect(
        masksService.applyToComparison('user-1', 'comparison-1', ['mask-1'])
      ).rejects.toThrow('not found');
    });

    it('should throw when some masks not found', async () => {
      const mockComparison = {
        id: 'comparison-1',
        execution: { project: { org: { users: [{ userId: 'user-1' }] } } },
      };

      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(mockComparison as any);
      vi.mocked(prisma.ignoreMask.findMany).mockResolvedValue([{ id: 'mask-1' }] as any);

      await expect(
        masksService.applyToComparison('user-1', 'comparison-1', ['mask-1', 'mask-2'])
      ).rejects.toThrow('Some masks not found');
    });
  });

  describe('bulkCreate', () => {
    it('should create multiple masks', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.createMany).mockResolvedValue({ count: 3 });

      const result = await masksService.bulkCreate('user-1', 'project-1', [
        { type: 'SELECTOR', value: '.timestamp' },
        { type: 'SELECTOR', value: '.ad' },
        { type: 'RECTANGLE', value: { x: 0, y: 0, width: 100, height: 50 } },
      ]);

      expect(result.count).toBe(3);
    });

    it('should serialize rectangle values in bulk', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.ignoreMask.createMany).mockResolvedValue({ count: 1 });

      await masksService.bulkCreate('user-1', 'project-1', [
        { type: 'RECTANGLE', value: { x: 10, y: 20, width: 100, height: 50 } },
      ]);

      expect(prisma.ignoreMask.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              value: JSON.stringify({ x: 10, y: 20, width: 100, height: 50 }),
            }),
          ]),
        })
      );
    });
  });
});
