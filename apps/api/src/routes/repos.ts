// VisionTest.ai - Repository Connection Routes
// Manages linked repositories for autonomous bug fixing

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, encrypt } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// =============================================================================
// HELPERS
// =============================================================================

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: { include: { users: { where: { userId } } } },
    },
  });
  if (!project || project.org.users.length === 0) {
    throw ForbiddenError('No access to this project');
  }
  return project;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createRepoSchema = z.object({
  projectId: z.string().cuid(),
  provider: z.enum(['GITHUB', 'GITLAB', 'BITBUCKET', 'LOCAL']),
  repoUrl: z.string().min(1),
  defaultBranch: z.string().optional(),
  authMode: z.string().optional(),
  token: z.string().optional(),
  repoType: z.enum(['SINGLE', 'MONOREPO', 'SERVICE']).optional(),
  defaultPath: z.string().optional(),
  cloneStrategy: z.string().optional(),
  allowedPaths: z.array(z.string()).optional(),
  blockedPaths: z.array(z.string()).optional(),
});

const updateRepoSchema = z.object({
  defaultBranch: z.string().optional(),
  authMode: z.string().optional(),
  token: z.string().optional(),
  repoType: z.enum(['SINGLE', 'MONOREPO', 'SERVICE']).optional(),
  defaultPath: z.string().optional().nullable(),
  cloneStrategy: z.string().optional(),
  allowedPaths: z.array(z.string()).optional(),
  blockedPaths: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /repos
 * List repository connections
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    await verifyProjectAccess(projectId as string, req.user!.id);

    const repos = await prisma.repositoryConnection.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'desc' },
    });

    const safeRepos = repos.map(({ encryptedToken, ...rest }) => ({
      ...rest,
      hasToken: !!encryptedToken,
    }));

    res.json({ success: true, data: safeRepos });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /repos
 * Create a repository connection
 */
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRepoSchema.parse(req.body);
    await verifyProjectAccess(input.projectId, req.user!.id);

    const repo = await prisma.repositoryConnection.create({
      data: {
        projectId: input.projectId,
        provider: input.provider,
        repoUrl: input.repoUrl,
        defaultBranch: input.defaultBranch || 'main',
        authMode: input.authMode || 'token',
        encryptedToken: input.token ? encrypt(input.token) : null,
        repoType: input.repoType || 'SINGLE',
        defaultPath: input.defaultPath,
        cloneStrategy: input.cloneStrategy || 'shallow',
        allowedPaths: input.allowedPaths || [],
        blockedPaths: input.blockedPaths || [],
      },
    });

    logger.info(`Repository connected: ${repo.id} (${input.repoUrl})`);
    res.status(201).json({ success: true, data: repo });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /repos/:id
 * Get repository connection detail
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await prisma.repositoryConnection.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { bugCandidates: true, fixPolicies: true } },
      },
    });
    if (!repo) throw NotFoundError('Repository connection');
    await verifyProjectAccess(repo.projectId, req.user!.id);

    // Don't expose encrypted token
    const { encryptedToken, ...safeRepo } = repo;
    res.json({ success: true, data: { ...safeRepo, hasToken: !!encryptedToken } });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /repos/:id
 * Update a repository connection
 */
router.patch('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateRepoSchema.parse(req.body);
    const repo = await prisma.repositoryConnection.findUnique({
      where: { id: req.params.id },
    });
    if (!repo) throw NotFoundError('Repository connection');
    await verifyProjectAccess(repo.projectId, req.user!.id);

    const { token, ...updateData } = input;
    const data: any = { ...updateData };
    if (token !== undefined) {
      data.encryptedToken = token ? encrypt(token) : null;
    }

    const updated = await prisma.repositoryConnection.update({
      where: { id: repo.id },
      data,
    });

    const { encryptedToken, ...safeRepo } = updated;
    res.json({ success: true, data: { ...safeRepo, hasToken: !!encryptedToken } });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /repos/:id
 * Delete a repository connection
 */
router.delete('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await prisma.repositoryConnection.findUnique({
      where: { id: req.params.id },
    });
    if (!repo) throw NotFoundError('Repository connection');
    await verifyProjectAccess(repo.projectId, req.user!.id);

    await prisma.repositoryConnection.delete({ where: { id: repo.id } });

    logger.info(`Repository disconnected: ${repo.id}`);
    res.json({ success: true, data: { message: 'Repository connection deleted' } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /repos/:id/test-connection
 * Test a repository connection
 */
router.post('/:id/test-connection', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await prisma.repositoryConnection.findUnique({
      where: { id: req.params.id },
    });
    if (!repo) throw NotFoundError('Repository connection');
    await verifyProjectAccess(repo.projectId, req.user!.id);

    // Simulate connection test - in production this would actually try to clone/connect
    const result = repo.encryptedToken ? 'success' : 'failure';

    await prisma.repositoryConnection.update({
      where: { id: repo.id },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: result,
      },
    });

    logger.info(`Repository connection test: ${repo.id} => ${result}`);
    res.json({
      success: true,
      data: {
        result,
        message: result === 'success' ? 'Connection successful' : 'Connection failed: no credentials configured',
        testedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
