// VisionTest AI - Team Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createTeamSchema = z.object({
  orgId: z.string().cuid(),
  name: z.string().min(1).max(100),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkOrgAccess(userId: string, orgId: string) {
  const membership = await prisma.organizationUser.findUnique({
    where: {
      userId_orgId: { userId, orgId },
    },
  });

  if (!membership) {
    throw ForbiddenError('Not a member of this organization');
  }

  return membership;
}

async function checkTeamAccess(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      org: {
        include: {
          users: { where: { userId } },
        },
      },
    },
  });

  if (!team) {
    throw NotFoundError('Team');
  }

  if (team.org.users.length === 0) {
    throw ForbiddenError('No access to this team');
  }

  return { team, orgRole: team.org.users[0].role };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /teams
 * List teams for an organization
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      throw BadRequestError('orgId is required');
    }

    await checkOrgAccess(req.user!.id, orgId as string);

    const teams = await prisma.team.findMany({
      where: { orgId: orgId as string },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: teams.map((t) => ({
        ...t,
        memberCount: t._count.members,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /teams
 * Create a new team
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, name } = createTeamSchema.parse(req.body);

    const membership = await checkOrgAccess(req.user!.id, orgId);

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ForbiddenError('Admin access required to create teams');
    }

    const team = await prisma.team.create({
      data: {
        orgId,
        name,
        members: {
          create: {
            userId: req.user!.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    logger.info(`Team created: ${team.id} in org ${orgId}`);

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /teams/:id
 * Get team with members
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team } = await checkTeamAccess(req.user!.id, req.params.id);

    const fullTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({
      success: true,
      data: fullTeam,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /teams/:id
 * Update team
 */
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team, orgRole } = await checkTeamAccess(req.user!.id, req.params.id);

    if (!['OWNER', 'ADMIN'].includes(orgRole)) {
      throw ForbiddenError('Admin access required');
    }

    const updates = updateTeamSchema.parse(req.body);

    const updated = await prisma.team.update({
      where: { id: team.id },
      data: { name: updates.name },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /teams/:id
 * Delete team
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team, orgRole } = await checkTeamAccess(req.user!.id, req.params.id);

    if (orgRole !== 'OWNER') {
      throw ForbiddenError('Owner access required to delete teams');
    }

    await prisma.team.delete({
      where: { id: team.id },
    });

    logger.info(`Team deleted: ${team.id}`);

    res.json({
      success: true,
      data: { message: 'Team deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /teams/:id/members
 * Add member to team
 */
router.post('/:id/members', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team } = await checkTeamAccess(req.user!.id, req.params.id);

    const { userId, role } = addMemberSchema.parse(req.body);

    // Verify target user is in the same org
    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_orgId: { userId, orgId: team.orgId },
      },
    });

    if (!targetMembership) {
      throw BadRequestError('User is not a member of this organization');
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: team.id, userId },
      },
    });

    if (existing) {
      throw BadRequestError('User is already a member of this team');
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        role: role || 'MEMBER',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info(`Member ${userId} added to team ${team.id}`);

    res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /teams/:id/members/:userId
 * Remove member from team
 */
router.delete('/:id/members/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team, orgRole } = await checkTeamAccess(req.user!.id, req.params.id);

    const targetUserId = req.params.userId;

    // Allow self-removal or admin removal
    if (req.user!.id !== targetUserId && !['OWNER', 'ADMIN'].includes(orgRole)) {
      throw ForbiddenError('Admin access required to remove other members');
    }

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: team.id, userId: targetUserId },
      },
    });

    if (!member) {
      throw NotFoundError('Team member');
    }

    await prisma.teamMember.delete({
      where: { id: member.id },
    });

    logger.info(`Member ${targetUserId} removed from team ${team.id}`);

    res.json({
      success: true,
      data: { message: 'Member removed' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /teams/:id/members/:userId
 * Update member role
 */
router.patch('/:id/members/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team, orgRole } = await checkTeamAccess(req.user!.id, req.params.id);

    if (!['OWNER', 'ADMIN'].includes(orgRole)) {
      throw ForbiddenError('Admin access required to update roles');
    }

    const { role } = updateMemberRoleSchema.parse(req.body);
    const targetUserId = req.params.userId;

    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: team.id, userId: targetUserId },
      },
    });

    if (!member) {
      throw NotFoundError('Team member');
    }

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info(`Member ${targetUserId} role updated to ${role} in team ${team.id}`);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
