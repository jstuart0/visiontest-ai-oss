// VisionTest AI - Smart Select Service Tests
// Hospital-Grade: Smart test selection testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartSelectService, findAffectedTests, getChangedFiles } from './smartSelect.service';
import { prisma } from '@visiontest/database';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Mock dependencies
vi.mock('@visiontest/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    impactMapping: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    execution: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('findAffectedTests', () => {
  it('should find tests via impact mappings', () => {
    const changedFiles = ['src/components/Button.tsx'];
    const impactMappings = [
      { filePath: 'src/components/Button.tsx', components: [], tests: ['test-1', 'test-2'] },
    ];
    const allTests = [
      { id: 'test-1', coveredFiles: [] },
      { id: 'test-2', coveredFiles: [] },
      { id: 'test-3', coveredFiles: [] },
    ];

    const result = findAffectedTests(changedFiles, impactMappings, allTests);

    expect(result.has('test-1')).toBe(true);
    expect(result.has('test-2')).toBe(true);
    expect(result.has('test-3')).toBe(false);
  });

  it('should find tests via coveredFiles', () => {
    const changedFiles = ['src/pages/home.tsx'];
    const impactMappings: any[] = [];
    const allTests = [
      { id: 'test-1', coveredFiles: ['src/pages/home.tsx'] },
      { id: 'test-2', coveredFiles: ['src/pages/about.tsx'] },
    ];

    const result = findAffectedTests(changedFiles, impactMappings, allTests);

    expect(result.has('test-1')).toBe(true);
    expect(result.has('test-2')).toBe(false);
  });

  it('should handle partial path matches', () => {
    const changedFiles = ['src/components/Button/index.tsx'];
    const impactMappings: any[] = [];
    const allTests = [
      { id: 'test-1', coveredFiles: ['Button'] },
    ];

    const result = findAffectedTests(changedFiles, impactMappings, allTests);

    expect(result.has('test-1')).toBe(true);
  });

  it('should return empty set for no matches', () => {
    const changedFiles = ['README.md'];
    const impactMappings: any[] = [];
    const allTests = [
      { id: 'test-1', coveredFiles: ['src/app.tsx'] },
    ];

    const result = findAffectedTests(changedFiles, impactMappings, allTests);

    expect(result.size).toBe(0);
  });

  it('should combine mappings and coveredFiles', () => {
    const changedFiles = ['src/utils.ts', 'src/api.ts'];
    const impactMappings = [
      { filePath: 'src/utils.ts', components: [], tests: ['test-1'] },
    ];
    const allTests = [
      { id: 'test-1', coveredFiles: [] },
      { id: 'test-2', coveredFiles: ['src/api.ts'] },
    ];

    const result = findAffectedTests(changedFiles, impactMappings, allTests);

    expect(result.has('test-1')).toBe(true);
    expect(result.has('test-2')).toBe(true);
  });
});

describe('getChangedFiles', () => {
  it('should parse git diff output', () => {
    vi.mocked(execSync).mockReturnValue('src/file1.ts\nsrc/file2.ts\n');

    const result = getChangedFiles('/repo', 'main', 'feature');

    expect(result).toEqual(['src/file1.ts', 'src/file2.ts']);
  });

  it('should handle empty diff', () => {
    vi.mocked(execSync).mockReturnValue('\n');

    const result = getChangedFiles('/repo', 'main', 'main');

    expect(result).toEqual([]);
  });

  it('should return empty array on error', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('git error');
    });

    const result = getChangedFiles('/repo', 'main', 'feature');

    expect(result).toEqual([]);
  });
});

// =============================================================================
// SERVICE METHOD TESTS
// =============================================================================

describe('SmartSelectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('select', () => {
    it('should select affected tests', async () => {
      const mockProject = {
        id: 'project-1',
        repoUrl: null,
        org: { users: [{ userId: 'user-1' }] },
        tests: [
          { id: 'test-1', name: 'Test 1', tags: [], coveredFiles: ['src/app.tsx'], suiteId: null },
          { id: 'test-2', name: 'Test 2', tags: [], coveredFiles: ['src/home.tsx'], suiteId: null },
          { id: 'test-3', name: 'Test 3', tags: ['smoke'], coveredFiles: [], suiteId: null },
        ],
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.impactMapping.findMany).mockResolvedValue([]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('src/app.tsx\n');

      const result = await smartSelectService.select('user-1', {
        projectId: 'project-1',
        baseRef: 'main',
        headRef: 'feature',
        repoPath: '/repo',
      });

      expect(result.changedFiles).toEqual(['src/app.tsx']);
      expect(result.affectedTests).toHaveLength(2); // test-1 (affected) + test-3 (smoke)
      expect(result.stats.totalTests).toBe(3);
      expect(result.stats.selectedTests).toBe(2);
    });

    it('should always include smoke and critical tags', async () => {
      const mockProject = {
        id: 'project-1',
        repoUrl: null,
        org: { users: [{ userId: 'user-1' }] },
        tests: [
          { id: 'test-1', name: 'Test 1', tags: ['smoke'], coveredFiles: [], suiteId: null },
          { id: 'test-2', name: 'Test 2', tags: ['critical'], coveredFiles: [], suiteId: null },
          { id: 'test-3', name: 'Test 3', tags: [], coveredFiles: [], suiteId: null },
        ],
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.impactMapping.findMany).mockResolvedValue([]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await smartSelectService.select('user-1', {
        projectId: 'project-1',
        baseRef: 'main',
        headRef: 'feature',
        repoPath: '/repo',
      });

      expect(result.affectedTests).toHaveLength(2);
      expect(result.affectedTests.map((t) => t.id)).toContain('test-1');
      expect(result.affectedTests.map((t) => t.id)).toContain('test-2');
    });

    it('should respect custom alwaysInclude tags', async () => {
      const mockProject = {
        id: 'project-1',
        repoUrl: null,
        org: { users: [{ userId: 'user-1' }] },
        tests: [
          { id: 'test-1', name: 'Test 1', tags: ['p1'], coveredFiles: [], suiteId: null },
          { id: 'test-2', name: 'Test 2', tags: ['smoke'], coveredFiles: [], suiteId: null },
        ],
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.impactMapping.findMany).mockResolvedValue([]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await smartSelectService.select('user-1', {
        projectId: 'project-1',
        baseRef: 'main',
        headRef: 'feature',
        repoPath: '/repo',
        alwaysInclude: ['p1'], // Custom tags
      });

      expect(result.affectedTests.map((t) => t.id)).toContain('test-1');
      expect(result.affectedTests.map((t) => t.id)).not.toContain('test-2');
    });

    it('should calculate reduction percentage', async () => {
      const mockProject = {
        id: 'project-1',
        repoUrl: null,
        org: { users: [{ userId: 'user-1' }] },
        tests: Array(10).fill(null).map((_, i) => ({
          id: `test-${i}`,
          name: `Test ${i}`,
          tags: [],
          coveredFiles: i === 0 ? ['src/app.tsx'] : [],
          suiteId: null,
        })),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.impactMapping.findMany).mockResolvedValue([]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('src/app.tsx\n');

      const result = await smartSelectService.select('user-1', {
        projectId: 'project-1',
        baseRef: 'main',
        headRef: 'feature',
        repoPath: '/repo',
        alwaysInclude: [], // Override defaults
      });

      expect(result.stats.totalTests).toBe(10);
      expect(result.stats.selectedTests).toBe(1);
      expect(result.stats.reduction).toBe(90);
    });

    it('should throw ForbiddenError when no access', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(
        smartSelectService.select('user-1', {
          projectId: 'project-1',
          baseRef: 'main',
          headRef: 'feature',
        })
      ).rejects.toThrow('No access');
    });
  });

  describe('getMapping', () => {
    it('should get impact mappings', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockMappings = [
        { filePath: 'src/app.tsx', components: ['App'], tests: ['test-1'] },
        { filePath: 'src/utils.ts', components: ['Utils'], tests: ['test-2'] },
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.impactMapping.findMany).mockResolvedValue(mockMappings as any);

      const result = await smartSelectService.getMapping('user-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result[0].tests).toContain('test-1');
    });
  });

  describe('rebuildMapping', () => {
    it('should rebuild impact mappings from tests', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1' }] },
        tests: [
          { id: 'test-1', name: 'Test 1', coveredFiles: ['src/app.tsx', 'src/utils.ts'] },
          { id: 'test-2', name: 'Test 2', coveredFiles: ['src/app.tsx'] },
        ],
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.impactMapping.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.impactMapping.createMany).mockResolvedValue({ count: 2 });

      const result = await smartSelectService.rebuildMapping('user-1', 'project-1', '/repo');

      expect(result.mappingsCreated).toBe(2);
      expect(prisma.impactMapping.deleteMany).toHaveBeenCalled();
      expect(prisma.impactMapping.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              filePath: 'src/app.tsx',
              tests: expect.arrayContaining(['test-1', 'test-2']),
            }),
          ]),
        })
      );
    });
  });

  describe('getStats', () => {
    it('should calculate smart selection statistics', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };
      const mockExecutions = [
        { metadata: { smartSelect: true, fullSuiteEstimate: 600000 }, duration: 300000 },
        { metadata: { smartSelect: true, fullSuiteEstimate: 600000 }, duration: 200000 },
        { metadata: {}, duration: 500000 }, // Not smart select
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.execution.findMany).mockResolvedValue(mockExecutions as any);

      const result = await smartSelectService.getStats('user-1', 'project-1');

      expect(result.smartSelectRuns).toBe(2);
      expect(result.timeSavedMs).toBe(700000); // 1200000 - 500000
      expect(result.avgReduction).toBe(58); // 1 - 500000/1200000
    });

    it('should return zeros when no smart select runs', async () => {
      const mockProject = { id: 'project-1', org: { users: [{ userId: 'user-1' }] } };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      const result = await smartSelectService.getStats('user-1', 'project-1');

      expect(result.smartSelectRuns).toBe(0);
      expect(result.timeSavedMs).toBe(0);
      expect(result.avgReduction).toBe(0);
    });
  });
});
