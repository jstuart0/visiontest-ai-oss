// VisionTest AI - API Testing Routes
// CRUD for API test definitions, assertions, environments, auth, suites, services, executions

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@visiontest/database';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// BullMQ queue for API test execution
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const executionQueue = new Queue('test-execution', { connection: redisConnection });

// =============================================================================
// HELPERS
// =============================================================================

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { users: { where: { userId } } } } },
  });
  if (!project || project.org.users.length === 0) throw ForbiddenError('No access');
  return project;
}

async function getUserOrgIds(userId: string): Promise<string[]> {
  const m = await prisma.organizationUser.findMany({ where: { userId }, select: { orgId: true } });
  return m.map(x => x.orgId);
}

// =============================================================================
// API TEST DEFINITIONS
// =============================================================================

const createTestSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  protocol: z.enum(['REST', 'GRAPHQL']).optional(),
  method: z.string().optional(),
  urlTemplate: z.string().min(1),
  headersTemplate: z.record(z.string()).optional(),
  queryTemplate: z.record(z.string()).optional(),
  bodyTemplate: z.string().optional(),
  variablesTemplate: z.record(z.string()).optional(),
  graphqlQuery: z.string().optional(),
  graphqlVariables: z.record(z.unknown()).optional(),
  graphqlOperationName: z.string().optional(),
  authBindingId: z.string().cuid().optional(),
  environmentBindingId: z.string().cuid().optional(),
  serviceBindingId: z.string().cuid().optional(),
  tags: z.array(z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  retries: z.number().int().min(0).max(5).optional(),
  assertions: z.array(z.object({
    type: z.enum(['STATUS_CODE', 'HEADER', 'JSON_PATH', 'SCHEMA', 'GRAPHQL_ERROR_ABSENT', 'LATENCY', 'BODY_CONTAINS', 'BODY_REGEX', 'RESPONSE_TIME']),
    operator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS', 'NOT_CONTAINS', 'MATCHES_REGEX', 'EXISTS', 'NOT_EXISTS', 'IS_TYPE', 'SCHEMA_VALID']).optional(),
    target: z.string().optional(),
    expectedValue: z.string().optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    description: z.string().optional(),
  })).optional(),
});

/**
 * GET /api-tests
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, protocol, status, tags, page = '1', limit = '20' } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const where: any = { projectId: projectId as string };
    if (protocol) where.protocol = protocol as string;
    if (status) where.status = status as string;
    if (tags) where.tags = { hasSome: (tags as string).split(',') };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [tests, total] = await Promise.all([
      prisma.apiTestDefinition.findMany({
        where, skip, take,
        orderBy: { updatedAt: 'desc' },
        include: {
          assertions: { where: { isActive: true }, orderBy: { order: 'asc' } },
          _count: { select: { assertions: true, executions: true } },
        },
      }),
      prisma.apiTestDefinition.count({ where }),
    ]);

    // Attach last execution status
    const testsWithLastExec = await Promise.all(tests.map(async (t) => {
      const lastExec = await prisma.apiExecution.findFirst({
        where: { apiTestId: t.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, durationMs: true, createdAt: true, passedAssertions: true, failedAssertions: true },
      });
      return { ...t, lastExecution: lastExec };
    }));

    res.json({ success: true, data: testsWithLastExec, meta: { page: parseInt(page as string), limit: take, total, hasMore: skip + take < total } });
  } catch (error) { next(error); }
});

/**
 * GET /api-tests/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.apiTestDefinition.findUnique({
      where: { id: req.params.id },
      include: {
        assertions: { where: { isActive: true }, orderBy: { order: 'asc' } },
        authBinding: true,
        environmentBinding: true,
        serviceBinding: true,
        executions: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, durationMs: true, passedAssertions: true, failedAssertions: true, totalAssertions: true, createdAt: true } },
      },
    });
    if (!test) throw NotFoundError('API test');
    await verifyProjectAccess(test.projectId, req.user!.id);
    res.json({ success: true, data: test });
  } catch (error) { next(error); }
});

/**
 * POST /api-tests
 */
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTestSchema.parse(req.body);
    await verifyProjectAccess(input.projectId, req.user!.id);

    const { assertions, ...testData } = input;
    const test = await prisma.apiTestDefinition.create({
      data: {
        ...testData,
        protocol: input.protocol || 'REST',
        method: input.method || 'GET',
        headersTemplate: input.headersTemplate || undefined,
        queryTemplate: input.queryTemplate || undefined,
        variablesTemplate: input.variablesTemplate || undefined,
        graphqlVariables: input.graphqlVariables as any || undefined,
        tags: input.tags || [],
      },
    });

    // Create assertions if provided
    if (assertions && assertions.length > 0) {
      await prisma.apiAssertion.createMany({
        data: assertions.map((a, i) => ({
          apiTestId: test.id,
          type: a.type,
          operator: a.operator || 'EQUALS',
          target: a.target,
          expectedValue: a.expectedValue,
          severity: a.severity || 'MEDIUM',
          order: i,
          description: a.description,
        })),
      });
    }

    const full = await prisma.apiTestDefinition.findUnique({
      where: { id: test.id },
      include: { assertions: { orderBy: { order: 'asc' } } },
    });

    logger.info(`API test created: ${test.id}`);
    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
});

const updateApiTestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  method: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
}).strict();

/**
 * PATCH /api-tests/:id
 */
router.patch('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateApiTestSchema.parse(req.body);

    const test = await prisma.apiTestDefinition.findUnique({ where: { id: req.params.id } });
    if (!test) throw NotFoundError('API test');
    await verifyProjectAccess(test.projectId, req.user!.id);

    const updated = await prisma.apiTestDefinition.update({
      where: { id: test.id },
      data: input,
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

/**
 * DELETE /api-tests/:id
 */
router.delete('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.apiTestDefinition.findUnique({ where: { id: req.params.id } });
    if (!test) throw NotFoundError('API test');
    await verifyProjectAccess(test.projectId, req.user!.id);
    await prisma.apiTestDefinition.delete({ where: { id: test.id } });
    res.json({ success: true, data: { message: 'API test deleted' } });
  } catch (error) { next(error); }
});

// =============================================================================
// ASSERTIONS (nested under tests)
// =============================================================================

/**
 * POST /api-tests/:id/assertions
 */
router.post('/:id/assertions', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.apiTestDefinition.findUnique({ where: { id: req.params.id } });
    if (!test) throw NotFoundError('API test');
    await verifyProjectAccess(test.projectId, req.user!.id);

    const input = z.object({
      type: z.enum(['STATUS_CODE', 'HEADER', 'JSON_PATH', 'SCHEMA', 'GRAPHQL_ERROR_ABSENT', 'LATENCY', 'BODY_CONTAINS', 'BODY_REGEX', 'RESPONSE_TIME']),
      operator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS', 'NOT_CONTAINS', 'MATCHES_REGEX', 'EXISTS', 'NOT_EXISTS', 'IS_TYPE', 'SCHEMA_VALID']).optional(),
      target: z.string().optional(),
      expectedValue: z.string().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      description: z.string().optional(),
    }).parse(req.body);

    const maxOrder = await prisma.apiAssertion.findFirst({ where: { apiTestId: test.id }, orderBy: { order: 'desc' }, select: { order: true } });
    const assertion = await prisma.apiAssertion.create({
      data: {
        apiTestId: test.id,
        type: input.type,
        operator: input.operator || 'EQUALS',
        target: input.target,
        expectedValue: input.expectedValue,
        severity: input.severity || 'MEDIUM',
        order: (maxOrder?.order ?? -1) + 1,
        description: input.description,
      },
    });
    res.status(201).json({ success: true, data: assertion });
  } catch (error) { next(error); }
});

/**
 * DELETE /api-tests/:testId/assertions/:assertionId
 */
router.delete('/:testId/assertions/:assertionId', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assertion = await prisma.apiAssertion.findUnique({ where: { id: req.params.assertionId } });
    if (!assertion || assertion.apiTestId !== req.params.testId) throw NotFoundError('Assertion');
    const test = await prisma.apiTestDefinition.findUnique({ where: { id: assertion.apiTestId } });
    if (!test) throw NotFoundError('API test');
    await verifyProjectAccess(test.projectId, req.user!.id);
    await prisma.apiAssertion.delete({ where: { id: assertion.id } });
    res.json({ success: true, data: { message: 'Assertion deleted' } });
  } catch (error) { next(error); }
});

// =============================================================================
// EXECUTE
// =============================================================================

/**
 * POST /api-tests/:id/run
 */
router.post('/:id/run', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.apiTestDefinition.findUnique({ where: { id: req.params.id } });
    if (!test) throw NotFoundError('API test');
    await verifyProjectAccess(test.projectId, req.user!.id);

    const { environmentName, branch, variableOverrides } = z.object({
      environmentName: z.string().optional(),
      branch: z.string().optional(),
      variableOverrides: z.record(z.string()).optional(),
    }).parse(req.body || {});

    const execution = await prisma.apiExecution.create({
      data: {
        projectId: test.projectId,
        apiTestId: test.id,
        status: 'PENDING',
        trigger: 'MANUAL',
        triggeredBy: req.user!.id,
        environmentName,
        branch,
      },
    });

    // Queue for worker
    await executionQueue.add('api-test-execution', {
      apiExecutionId: execution.id,
      apiTestId: test.id,
      environmentName,
      variableOverrides,
    });

    logger.info(`API test execution queued: ${execution.id}`);
    res.status(201).json({ success: true, data: execution });
  } catch (error) { next(error); }
});

// =============================================================================
// EXECUTIONS
// =============================================================================

/**
 * GET /api-tests/executions
 */
router.get('/executions/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, apiTestId, status, page = '1', limit = '20' } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const where: any = { projectId: projectId as string };
    if (apiTestId) where.apiTestId = apiTestId as string;
    if (status) where.status = status as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [executions, total] = await Promise.all([
      prisma.apiExecution.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          apiTest: { select: { id: true, name: true, protocol: true } },
          suite: { select: { id: true, name: true } },
        },
      }),
      prisma.apiExecution.count({ where }),
    ]);

    res.json({ success: true, data: executions, meta: { page: parseInt(page as string), limit: take, total, hasMore: skip + take < total } });
  } catch (error) { next(error); }
});

/**
 * GET /api-tests/executions/:id
 */
router.get('/executions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exec = await prisma.apiExecution.findUnique({
      where: { id: req.params.id },
      include: {
        apiTest: { select: { id: true, name: true, protocol: true, method: true, urlTemplate: true } },
        suite: { select: { id: true, name: true } },
        artifacts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!exec) throw NotFoundError('API execution');
    await verifyProjectAccess(exec.projectId, req.user!.id);
    res.json({ success: true, data: exec });
  } catch (error) { next(error); }
});

// =============================================================================
// ENVIRONMENTS
// =============================================================================

/**
 * GET /api-tests/environments
 */
router.get('/environments/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);
    const envs = await prisma.apiEnvironmentBinding.findMany({ where: { projectId: projectId as string }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
    res.json({ success: true, data: envs });
  } catch (error) { next(error); }
});

/**
 * POST /api-tests/environments
 */
router.post('/environments', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      projectId: z.string().cuid(),
      name: z.string().min(1).max(50),
      baseUrl: z.string().url(),
      defaultHeaders: z.record(z.string()).optional(),
      defaultVariables: z.record(z.string()).optional(),
      authBindingId: z.string().cuid().optional(),
      isDefault: z.boolean().optional(),
    }).parse(req.body);

    await verifyProjectAccess(input.projectId, req.user!.id);

    if (input.isDefault) {
      await prisma.apiEnvironmentBinding.updateMany({ where: { projectId: input.projectId, isDefault: true }, data: { isDefault: false } });
    }

    const env = await prisma.apiEnvironmentBinding.create({ data: input });
    res.status(201).json({ success: true, data: env });
  } catch (error) { next(error); }
});

/**
 * DELETE /api-tests/environments/:id
 */
router.delete('/environments/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = await prisma.apiEnvironmentBinding.findUnique({ where: { id: req.params.id } });
    if (!env) throw NotFoundError('Environment');
    await verifyProjectAccess(env.projectId, req.user!.id);
    await prisma.apiEnvironmentBinding.delete({ where: { id: env.id } });
    res.json({ success: true, data: { message: 'Environment deleted' } });
  } catch (error) { next(error); }
});

// =============================================================================
// AUTH BINDINGS
// =============================================================================

/**
 * GET /api-tests/auth-bindings
 */
router.get('/auth-bindings/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);
    const bindings = await prisma.apiAuthBinding.findMany({ where: { projectId: projectId as string }, orderBy: { name: 'asc' } });
    // Redact secrets
    const safe = bindings.map(b => ({ ...b, secretRef: b.secretRef ? '***' : null }));
    res.json({ success: true, data: safe });
  } catch (error) { next(error); }
});

/**
 * POST /api-tests/auth-bindings
 */
router.post('/auth-bindings', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      projectId: z.string().cuid(),
      name: z.string().min(1).max(100),
      authType: z.enum(['NONE', 'API_KEY', 'BEARER', 'BASIC', 'OAUTH_CLIENT_CREDENTIALS', 'CUSTOM']),
      headerName: z.string().optional(),
      tokenPrefix: z.string().optional(),
      secretRef: z.string().optional(),
      oauthConfig: z.record(z.unknown()).optional(),
      customConfig: z.record(z.unknown()).optional(),
      redactionPolicy: z.string().optional(),
    }).parse(req.body);

    await verifyProjectAccess(input.projectId, req.user!.id);
    const binding = await prisma.apiAuthBinding.create({ data: input as any });
    res.status(201).json({ success: true, data: { ...binding, secretRef: binding.secretRef ? '***' : null } });
  } catch (error) { next(error); }
});

/**
 * DELETE /api-tests/auth-bindings/:id
 */
router.delete('/auth-bindings/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const binding = await prisma.apiAuthBinding.findUnique({ where: { id: req.params.id } });
    if (!binding) throw NotFoundError('Auth binding');
    await verifyProjectAccess(binding.projectId, req.user!.id);
    await prisma.apiAuthBinding.delete({ where: { id: binding.id } });
    res.json({ success: true, data: { message: 'Auth binding deleted' } });
  } catch (error) { next(error); }
});

// =============================================================================
// SUITES
// =============================================================================

/**
 * GET /api-tests/suites
 */
router.get('/suites/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);
    const suites = await prisma.apiSuiteDefinition.findMany({
      where: { projectId: projectId as string },
      orderBy: { name: 'asc' },
      include: { members: { include: { apiTest: { select: { id: true, name: true } } }, orderBy: { order: 'asc' } }, _count: { select: { members: true, executions: true } } },
    });
    res.json({ success: true, data: suites });
  } catch (error) { next(error); }
});

/**
 * POST /api-tests/suites
 */
router.post('/suites', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      projectId: z.string().cuid(),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      executionMode: z.enum(['API_ONLY', 'MIXED']).optional(),
      orderingMode: z.enum(['PARALLEL', 'SEQUENTIAL', 'STAGED']).optional(),
      failurePolicy: z.string().optional(),
      tags: z.array(z.string()).optional(),
      memberIds: z.array(z.string().cuid()).optional(),
    }).parse(req.body);

    await verifyProjectAccess(input.projectId, req.user!.id);
    const { memberIds, ...suiteData } = input;
    const suite = await prisma.apiSuiteDefinition.create({ data: { ...suiteData, tags: input.tags || [] } });

    if (memberIds && memberIds.length > 0) {
      await prisma.apiSuiteMember.createMany({
        data: memberIds.map((id, i) => ({ suiteId: suite.id, apiTestId: id, order: i })),
      });
    }

    const full = await prisma.apiSuiteDefinition.findUnique({ where: { id: suite.id }, include: { members: { include: { apiTest: { select: { id: true, name: true } } } } } });
    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
});

/**
 * POST /api-tests/suites/:id/run
 */
router.post('/suites/:id/run', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.apiSuiteDefinition.findUnique({
      where: { id: req.params.id },
      include: { members: { orderBy: { order: 'asc' } } },
    });
    if (!suite) throw NotFoundError('API suite');
    await verifyProjectAccess(suite.projectId, req.user!.id);

    const { environmentName } = z.object({ environmentName: z.string().optional() }).parse(req.body || {});

    // Create executions for each member
    const executions = [];
    for (const member of suite.members) {
      const exec = await prisma.apiExecution.create({
        data: {
          projectId: suite.projectId,
          apiTestId: member.apiTestId,
          suiteId: suite.id,
          status: 'PENDING',
          trigger: 'SUITE',
          triggeredBy: req.user!.id,
          environmentName,
        },
      });
      await executionQueue.add('api-test-execution', {
        apiExecutionId: exec.id,
        apiTestId: member.apiTestId,
        environmentName,
      });
      executions.push(exec);
    }

    logger.info(`API suite run started: ${suite.id} with ${executions.length} tests`);
    res.status(201).json({ success: true, data: { suiteId: suite.id, executions } });
  } catch (error) { next(error); }
});

/**
 * DELETE /api-tests/suites/:id
 */
router.delete('/suites/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suite = await prisma.apiSuiteDefinition.findUnique({ where: { id: req.params.id } });
    if (!suite) throw NotFoundError('API suite');
    await verifyProjectAccess(suite.projectId, req.user!.id);
    await prisma.apiSuiteDefinition.delete({ where: { id: suite.id } });
    res.json({ success: true, data: { message: 'API suite deleted' } });
  } catch (error) { next(error); }
});

// =============================================================================
// SERVICE BINDINGS
// =============================================================================

/**
 * GET /api-tests/services
 */
router.get('/services/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);
    const services = await prisma.apiServiceBinding.findMany({ where: { projectId: projectId as string }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: services });
  } catch (error) { next(error); }
});

/**
 * POST /api-tests/services
 */
router.post('/services', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      projectId: z.string().cuid(),
      name: z.string().min(1).max(100),
      serviceName: z.string().min(1),
      repoId: z.string().optional(),
      repoPath: z.string().optional(),
      ownerTeamId: z.string().optional(),
      routePatterns: z.array(z.string()).optional(),
      contractSource: z.string().optional(),
      environmentMappings: z.record(z.string()).optional(),
    }).parse(req.body);

    await verifyProjectAccess(input.projectId, req.user!.id);
    const service = await prisma.apiServiceBinding.create({ data: { ...input, routePatterns: input.routePatterns || [] } });
    res.status(201).json({ success: true, data: service });
  } catch (error) { next(error); }
});

/**
 * DELETE /api-tests/services/:id
 */
router.delete('/services/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await prisma.apiServiceBinding.findUnique({ where: { id: req.params.id } });
    if (!service) throw NotFoundError('Service binding');
    await verifyProjectAccess(service.projectId, req.user!.id);
    await prisma.apiServiceBinding.delete({ where: { id: service.id } });
    res.json({ success: true, data: { message: 'Service binding deleted' } });
  } catch (error) { next(error); }
});

// =============================================================================
// STATS
// =============================================================================

/**
 * GET /api-tests/stats
 */
router.get('/stats/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const [totalApiTests, activeApiTests, recentPassed, recentTotal] = await Promise.all([
      prisma.apiTestDefinition.count({ where: { projectId: projectId as string } }),
      prisma.apiTestDefinition.count({ where: { projectId: projectId as string, status: 'ACTIVE' } }),
      prisma.apiExecution.count({ where: { projectId: projectId as string, status: 'PASSED', createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.apiExecution.count({ where: { projectId: projectId as string, status: { in: ['PASSED', 'FAILED'] }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const apiPassRate = recentTotal > 0 ? Math.round((recentPassed / recentTotal) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalApiTests,
        activeApiTests,
        apiPassRate,
        recentExecutions: recentTotal,
        failedByService: [],
        slowestTests: [],
      },
    });
  } catch (error) { next(error); }
});

export default router;
