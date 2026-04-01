// VisionTest AI - Projects Service Tests
// Hospital-Grade: Complete CRUD testing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectsService } from './projects.service';
import { prisma } from '@visiontest/database';

// Mock Prisma
vi.mock('@visiontest/database', () => ({
  prisma: {
    organizationUser: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    test: {
      count: vi.fn(),
    },
    testSuite: {
      count: vi.fn(),
    },
    baseline: {
      count: vi.fn(),
    },
    flakyTest: {
      count: vi.fn(),
    },
    execution: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  Role: {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
    VIEWER: 'VIEWER',
  },
}));

describe('ProjectsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list projects user has access to', async () => {
      const mockMemberships = [
        { orgId: 'org-1' },
        { orgId: 'org-2' },
      ];
      const mockProjects = [
        {
          id: 'project-1',
          orgId: 'org-1',
          name: 'Project 1',
          slug: 'project-1',
          description: null,
          repoUrl: null,
          settings: { defaultBrowser: 'chromium' },
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            tests: 10,
            suites: 2,
            baselines: 5,
            executions: 3,
          },
        },
      ];

      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue(mockMemberships as any);
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await projectsService.list('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Project 1');
      expect(result[0].testCount).toBe(10);
      expect(result[0].suiteCount).toBe(2);
    });

    it('should return empty array when user has no memberships', async () => {
      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue([]);

      const result = await projectsService.list('user-1');

      expect(result).toEqual([]);
      expect(prisma.project.findMany).not.toHaveBeenCalled();
    });

    it('should filter by orgId when provided', async () => {
      vi.mocked(prisma.organizationUser.findMany).mockResolvedValue([{ orgId: 'org-1' }] as any);
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await projectsService.list('user-1', 'org-1');

      expect(prisma.organizationUser.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', orgId: 'org-1' },
        select: { orgId: true },
      });
    });
  });

  describe('create', () => {
    it('should create a project with valid input', async () => {
      const mockMembership = { userId: 'user-1', orgId: 'org-1', role: 'ADMIN' };
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        name: 'New Project',
        slug: 'new-project',
        description: 'A test project',
        repoUrl: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.organizationUser.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null); // Slug doesn't exist
      vi.mocked(prisma.project.create).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await projectsService.create('user-1', {
        orgId: 'org-1',
        name: 'New Project',
        description: 'A test project',
      });

      expect(result.name).toBe('New Project');
      expect(prisma.project.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should use provided slug when given', async () => {
      const mockMembership = { userId: 'user-1', orgId: 'org-1' };
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        name: 'New Project',
        slug: 'custom-slug',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.organizationUser.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.create).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await projectsService.create('user-1', {
        orgId: 'org-1',
        name: 'New Project',
        slug: 'custom-slug',
      });

      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'custom-slug',
          }),
        })
      );
    });

    it('should throw ForbiddenError when not a member', async () => {
      vi.mocked(prisma.organizationUser.findUnique).mockResolvedValue(null);

      await expect(
        projectsService.create('user-1', {
          orgId: 'org-1',
          name: 'New Project',
        })
      ).rejects.toThrow('Not a member');
    });

    it('should throw BadRequestError for duplicate slug', async () => {
      const mockMembership = { userId: 'user-1', orgId: 'org-1' };
      const existingProject = { id: 'existing-1', slug: 'new-project' };

      vi.mocked(prisma.organizationUser.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue(existingProject as any);

      await expect(
        projectsService.create('user-1', {
          orgId: 'org-1',
          name: 'New Project',
        })
      ).rejects.toThrow('slug already exists');
    });

    it('should generate slug from name correctly', async () => {
      const mockMembership = { userId: 'user-1', orgId: 'org-1' };
      const mockProject = {
        id: 'project-1',
        name: 'My Test Project',
        slug: 'my-test-project',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.organizationUser.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.create).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await projectsService.create('user-1', {
        orgId: 'org-1',
        name: 'My Test Project!!!',
      });

      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'my-test-project',
          }),
        })
      );
    });
  });

  describe('getById', () => {
    it('should return project details with stats', async () => {
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        name: 'Project 1',
        slug: 'project-1',
        description: null,
        repoUrl: null,
        settings: { defaultBrowser: 'chromium' },
        createdAt: new Date(),
        updatedAt: new Date(),
        org: {
          users: [{ userId: 'user-1', role: 'ADMIN' }],
        },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.count).mockResolvedValue(10);
      vi.mocked(prisma.testSuite.count).mockResolvedValue(2);
      vi.mocked(prisma.baseline.count).mockResolvedValue(5);
      vi.mocked(prisma.flakyTest.count).mockResolvedValue(1);
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      const result = await projectsService.getById('user-1', 'project-1');

      expect(result.name).toBe('Project 1');
      expect(result.role).toBe('ADMIN');
      expect(result.stats.testCount).toBe(10);
      expect(result.stats.flakyCount).toBe(1);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(projectsService.getById('user-1', 'project-1')).rejects.toThrow('not found');
    });

    it('should throw ForbiddenError when user has no access', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(projectsService.getById('user-1', 'project-1')).rejects.toThrow('No access');
    });
  });

  describe('update', () => {
    it('should update project when user is admin', async () => {
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        name: 'Old Name',
        settings: { defaultBrowser: 'chromium' },
        org: { users: [{ userId: 'user-1', role: 'ADMIN' }] },
      };
      const updatedProject = {
        ...mockProject,
        name: 'New Name',
        _count: { tests: 5, suites: 1, baselines: 2 },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.project.update).mockResolvedValue(updatedProject as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await projectsService.update('user-1', 'project-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should update project when user is owner', async () => {
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        settings: {},
        org: { users: [{ userId: 'user-1', role: 'OWNER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.project.update).mockResolvedValue({
        ...mockProject,
        name: 'Updated',
        _count: { tests: 0, suites: 0, baselines: 0 },
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await expect(
        projectsService.update('user-1', 'project-1', { name: 'Updated' })
      ).resolves.toBeDefined();
    });

    it('should throw ForbiddenError for non-admin users', async () => {
      const mockProject = {
        id: 'project-1',
        settings: {},
        org: { users: [{ userId: 'user-1', role: 'MEMBER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        projectsService.update('user-1', 'project-1', { name: 'New Name' })
      ).rejects.toThrow('Admin access required');
    });

    it('should throw ForbiddenError for viewer users', async () => {
      const mockProject = {
        id: 'project-1',
        settings: {},
        org: { users: [{ userId: 'user-1', role: 'VIEWER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(
        projectsService.update('user-1', 'project-1', { name: 'New Name' })
      ).rejects.toThrow('Admin access required');
    });

    it('should merge settings correctly', async () => {
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        settings: { defaultBrowser: 'chromium', flakyThreshold: 35 },
        org: { users: [{ userId: 'user-1', role: 'ADMIN' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.project.update).mockImplementation(async (args: any) => ({
        ...mockProject,
        settings: args.data.settings,
        _count: { tests: 0, suites: 0, baselines: 0 },
      }));
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await projectsService.update('user-1', 'project-1', {
        settings: { flakyThreshold: 50 },
      });

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            settings: { defaultBrowser: 'chromium', flakyThreshold: 50 },
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete project when user is owner', async () => {
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        org: { users: [{ userId: 'user-1', role: 'OWNER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.project.delete).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await projectsService.delete('user-1', 'project-1');

      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenError for admin users', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1', role: 'ADMIN' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(projectsService.delete('user-1', 'project-1')).rejects.toThrow('Owner access required');
    });

    it('should throw ForbiddenError for member users', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1', role: 'MEMBER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

      await expect(projectsService.delete('user-1', 'project-1')).rejects.toThrow('Owner access required');
    });
  });

  describe('getStats', () => {
    it('should return project statistics', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1', role: 'MEMBER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.count)
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(95)   // active
        .mockResolvedValueOnce(5);   // quarantined
      vi.mocked(prisma.execution.count)
        .mockResolvedValueOnce(500)  // total
        .mockResolvedValueOnce(450)  // passed
        .mockResolvedValueOnce(50)   // failed
        .mockResolvedValueOnce(20)   // today
        .mockResolvedValueOnce(100); // week
      vi.mocked(prisma.execution.aggregate).mockResolvedValue({
        _avg: { duration: 5000 },
      } as any);

      const result = await projectsService.getStats('user-1', 'project-1');

      expect(result.tests.total).toBe(100);
      expect(result.tests.active).toBe(95);
      expect(result.tests.quarantined).toBe(5);
      expect(result.executions.total).toBe(500);
      expect(result.executions.passRate).toBe(90);
      expect(result.executions.today).toBe(20);
      expect(result.executions.avgDuration).toBe(5000);
    });

    it('should return 0 pass rate when no executions', async () => {
      const mockProject = {
        id: 'project-1',
        org: { users: [{ userId: 'user-1', role: 'MEMBER' }] },
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.test.count).mockResolvedValue(0);
      vi.mocked(prisma.execution.count).mockResolvedValue(0);
      vi.mocked(prisma.execution.aggregate).mockResolvedValue({
        _avg: { duration: null },
      } as any);

      const result = await projectsService.getStats('user-1', 'project-1');

      expect(result.executions.passRate).toBe(0);
      expect(result.executions.avgDuration).toBeNull();
    });
  });
});
