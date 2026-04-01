// VisionTest.ai - Organization Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Role, Prisma } from '@visiontest/database';
import { authenticate, requireRole } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logo: z.string().url().optional(),
  settings: z.record(z.unknown()).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /organizations
 * List user's organizations
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.organizationUser.findMany({
      where: { userId: req.user!.id },
      include: {
        org: {
          include: {
            _count: {
              select: {
                users: true,
                projects: true,
              },
            },
          },
        },
      },
    });

    const orgs = memberships.map((m) => ({
      ...m.org,
      role: m.role,
      userCount: m.org._count.users,
      projectCount: m.org._count.projects,
    }));

    res.json({
      success: true,
      data: orgs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations
 * Create a new organization
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug } = createOrgSchema.parse(req.body);
    
    // Generate slug if not provided
    let orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check if slug is unique
    const existing = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existing) {
      throw BadRequestError('Organization slug already exists');
    }

    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name,
          slug: orgSlug,
        },
      });

      // Add creator as owner
      await tx.organizationUser.create({
        data: {
          userId: req.user!.id,
          orgId: newOrg.id,
          role: Role.OWNER,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          orgId: newOrg.id,
          userId: req.user!.id,
          action: 'organization.created',
          resource: 'organization',
          resourceId: newOrg.id,
        },
      });

      return newOrg;
    });

    res.status(201).json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /organizations/:orgId
 * Get organization details
 */
router.get('/:orgId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;

    // Check membership
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user!.id,
          orgId,
        },
      },
    });

    if (!membership) {
      throw ForbiddenError('Not a member of this organization');
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
          },
        },
      },
    });

    if (!org) {
      throw NotFoundError('Organization');
    }

    res.json({
      success: true,
      data: {
        ...org,
        role: membership.role,
        userCount: org._count.users,
        projectCount: org._count.projects,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /organizations/:orgId
 * Update organization
 */
router.patch('/:orgId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const updates = updateOrgSchema.parse(req.body);

    // Check admin access
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user!.id,
          orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ForbiddenError('Admin access required');
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: updates.name,
        logo: updates.logo,
        settings: updates.settings as Prisma.InputJsonValue | undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId,
        userId: req.user!.id,
        action: 'organization.updated',
        resource: 'organization',
        resourceId: orgId,
        details: { name: updates.name, logo: updates.logo, settings: updates.settings } as Prisma.InputJsonValue,
      },
    });

    res.json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /organizations/:orgId/members
 * List organization members
 */
router.get('/:orgId/members', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;

    // Check membership
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user!.id,
          orgId,
        },
      },
    });

    if (!membership) {
      throw ForbiddenError('Not a member of this organization');
    }

    const members = await prisma.organizationUser.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations/:orgId/members
 * Invite member (placeholder - would need email service)
 */
router.post('/:orgId/members', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const { email, role } = inviteMemberSchema.parse(req.body);

    // Check admin access
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user!.id,
          orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ForbiddenError('Admin access required');
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // In production, send invite email
      throw BadRequestError('User not found. Invite emails not yet implemented.');
    }

    // Check if already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId,
        },
      },
    });

    if (existingMembership) {
      throw BadRequestError('User is already a member');
    }

    // Add member
    const newMembership = await prisma.organizationUser.create({
      data: {
        userId: user.id,
        orgId,
        role: role as Role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId,
        userId: req.user!.id,
        action: 'member.added',
        resource: 'organizationUser',
        resourceId: newMembership.id,
        details: { email, role },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: newMembership.id,
        role: newMembership.role,
        user: newMembership.user,
        createdAt: newMembership.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /organizations/:orgId/members/:memberId
 * Remove member
 */
router.delete('/:orgId/members/:memberId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, memberId } = req.params;

    // Check admin access
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: {
          userId: req.user!.id,
          orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ForbiddenError('Admin access required');
    }

    // Find the membership to delete
    const targetMembership = await prisma.organizationUser.findUnique({
      where: { id: memberId },
    });

    if (!targetMembership || targetMembership.orgId !== orgId) {
      throw NotFoundError('Member');
    }

    // Can't remove owner
    if (targetMembership.role === 'OWNER') {
      throw BadRequestError('Cannot remove organization owner');
    }

    // Can't remove yourself
    if (targetMembership.userId === req.user!.id) {
      throw BadRequestError('Cannot remove yourself');
    }

    await prisma.organizationUser.delete({
      where: { id: memberId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId,
        userId: req.user!.id,
        action: 'member.removed',
        resource: 'organizationUser',
        resourceId: memberId,
      },
    });

    res.json({
      success: true,
      data: { message: 'Member removed' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /organizations/:orgId/audit-log
 * Get audit log entries for the organization
 */
router.get('/:orgId/audit-log', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const membership = await prisma.organizationUser.findUnique({
      where: { userId_orgId: { userId: req.user!.id, orgId } },
    });

    if (!membership) {
      throw ForbiddenError('No access to this organization');
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where: { orgId } }),
    ]);

    return res.json({
      success: true,
      data: logs,
      meta: {
        page: parseInt(page as string),
        limit: take,
        total,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
