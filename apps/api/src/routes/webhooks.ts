// VisionTest.ai - Webhook Routes

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { safeFetch } from '../utils/urlValidator';
import crypto from 'crypto';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const WEBHOOK_EVENTS = [
  'TEST_PASSED',
  'TEST_FAILED',
  'BASELINE_UPDATED',
  'SCHEDULE_COMPLETED',
  'FLAKY_DETECTED',
] as const;

const createWebhookSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  secret: z.string().min(8).max(256).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  secret: z.string().min(8).max(256).optional().nullable(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: {
        include: {
          users: { where: { userId } },
        },
      },
    },
  });

  if (!project) {
    throw NotFoundError('Project');
  }

  if (project.org.users.length === 0) {
    throw ForbiddenError('No access to this project');
  }

  return { project, role: project.org.users[0].role };
}

async function checkWebhookAccess(userId: string, webhookId: string) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    include: {
      project: {
        include: {
          org: {
            include: {
              users: { where: { userId } },
            },
          },
        },
      },
    },
  });

  if (!webhook) {
    throw NotFoundError('Webhook');
  }

  if (webhook.project.org.users.length === 0) {
    throw ForbiddenError('No access to this webhook');
  }

  return { webhook, role: webhook.project.org.users[0].role };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /webhooks
 * List webhooks for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      throw BadRequestError('projectId is required');
    }

    await checkProjectAccess(req.user!.id, projectId as string);

    const webhooks = await prisma.webhook.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: webhooks.map(({ secret, ...rest }) => ({ ...rest, hasSecret: !!secret })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks
 * Create a new webhook
 */
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWebhookSchema.parse(req.body);

    const { role } = await checkProjectAccess(req.user!.id, input.projectId);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required to create webhooks');
    }

    // Generate a secret if not provided
    const secret = input.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret,
        isActive: true,
      },
    });

    logger.info(`Webhook created: ${webhook.id} for project ${input.projectId}`);

    const { secret: _secret, ...safeWebhook } = webhook;
    res.status(201).json({
      success: true,
      data: { ...safeWebhook, hasSecret: !!webhook.secret },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /webhooks/:id
 * Get webhook with recent deliveries
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhook } = await checkWebhookAccess(req.user!.id, req.params.id);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: webhook.id },
      orderBy: { deliveredAt: 'desc' },
      take: 20,
    });

    const { secret, ...safeWebhook } = webhook;
    res.json({
      success: true,
      data: {
        ...safeWebhook,
        hasSecret: !!secret,
        deliveries,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /webhooks/:id
 * Update webhook
 */
router.put('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhook, role } = await checkWebhookAccess(req.user!.id, req.params.id);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required');
    }

    const updates = updateWebhookSchema.parse(req.body);

    const updated = await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        name: updates.name,
        url: updates.url,
        events: updates.events,
        secret: updates.secret !== undefined ? updates.secret : undefined,
        isActive: updates.isActive,
      },
    });

    const { secret: _updatedSecret, ...safeUpdated } = updated;
    res.json({
      success: true,
      data: { ...safeUpdated, hasSecret: !!updated.secret },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /webhooks/:id
 * Delete webhook
 */
router.delete('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhook, role } = await checkWebhookAccess(req.user!.id, req.params.id);

    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw ForbiddenError('Admin access required');
    }

    await prisma.webhook.delete({
      where: { id: webhook.id },
    });

    logger.info(`Webhook deleted: ${webhook.id}`);

    res.json({
      success: true,
      data: { message: 'Webhook deleted' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks/:id/test
 * Send a test webhook delivery
 */
router.post('/:id/test', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhook } = await checkWebhookAccess(req.user!.id, req.params.id);

    const testPayload = {
      event: 'TEST_PASSED',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        projectId: webhook.projectId,
        webhookId: webhook.id,
        triggeredBy: req.user!.id,
      },
    };

    let statusCode: number | null = null;
    let responseBody: any = null;
    let success = false;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-VisionTest-Event': 'test',
        'X-VisionTest-Delivery': crypto.randomUUID(),
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(testPayload))
          .digest('hex');
        headers['X-VisionTest-Signature'] = `sha256=${signature}`;
      }

      let response: globalThis.Response;
      try {
        response = await safeFetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(10000),
        });
      } catch (ssrfErr: any) {
        if (ssrfErr.message?.includes('blocked') || ssrfErr.message?.includes('not allowed') || ssrfErr.message?.includes('Cannot resolve')) {
          return res.status(400).json({ success: false, error: ssrfErr.message });
        }
        throw ssrfErr;
      }

      statusCode = response.status;
      try {
        responseBody = await response.text();
      } catch {
        responseBody = null;
      }
      success = response.ok;
    } catch (err: any) {
      responseBody = { error: err.message };
      success = false;
    }

    // Record delivery
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: 'TEST',
        payload: testPayload as Prisma.InputJsonValue,
        response: responseBody ? (typeof responseBody === 'string' ? { body: responseBody } : responseBody) as Prisma.InputJsonValue : undefined,
        statusCode,
        success,
      },
    });

    logger.info(`Test webhook sent for ${webhook.id}: ${success ? 'success' : 'failed'}`);

    return res.json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
