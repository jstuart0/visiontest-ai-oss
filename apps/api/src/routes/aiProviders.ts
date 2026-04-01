// VisionTest.ai - AI Provider Configuration Routes
// Manage LLM providers (Anthropic, OpenAI, OpenRouter, Local) with dynamic model listing

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, encrypt, decryptApiKey } from '@visiontest/database';
import { authenticate } from '../middleware/auth';
import { mutationLimiter } from '../middleware/rateLimit';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';
import { safeFetch } from '../utils/urlValidator';

const router = Router();

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { users: { where: { userId } } } } },
  });
  if (!project || project.org.users.length === 0) throw ForbiddenError('No access');
  return project;
}

// =============================================================================
// STATIC PROVIDER DEFAULTS (prefilled for cloud providers)
// =============================================================================

const PROVIDER_DEFAULTS: Record<string, any> = {
  ANTHROPIC: {
    provider: 'ANTHROPIC',
    displayName: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    requiresApiKey: true,
    supportsModelListing: true,
    staticModels: [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable model for complex analysis and code generation', contextWindow: 200000, maxOutputTokens: 32000, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 15, outputPerMToken: 75 } },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance of speed, cost, and capability', contextWindow: 200000, maxOutputTokens: 16000, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 3, outputPerMToken: 15 } },
      { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4', description: 'Fast and affordable for simple tasks', contextWindow: 200000, maxOutputTokens: 8000, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 0.80, outputPerMToken: 4 } },
    ],
  },
  OPENAI: {
    provider: 'OPENAI',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    requiresApiKey: true,
    supportsModelListing: true,
    staticModels: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable OpenAI model, multimodal', contextWindow: 128000, maxOutputTokens: 16384, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 2.5, outputPerMToken: 10 } },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', contextWindow: 128000, maxOutputTokens: 16384, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 0.15, outputPerMToken: 0.6 } },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship', contextWindow: 128000, maxOutputTokens: 4096, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 10, outputPerMToken: 30 } },
      { id: 'o3-mini', name: 'o3-mini', description: 'Reasoning model, cost-effective', contextWindow: 200000, maxOutputTokens: 100000, supportsImages: false, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 1.1, outputPerMToken: 4.4 } },
    ],
  },
  OPENROUTER: {
    provider: 'OPENROUTER',
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    requiresApiKey: true,
    supportsModelListing: true,
    staticModels: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OpenRouter)', contextWindow: 200000, supportsImages: true, supportsStreaming: true },
      { id: 'anthropic/claude-haiku-4', name: 'Claude Haiku 4 (via OpenRouter)', contextWindow: 200000, supportsImages: true, supportsStreaming: true },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)', contextWindow: 128000, supportsImages: true, supportsStreaming: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (via OpenRouter)', contextWindow: 128000, supportsImages: true, supportsStreaming: true },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', contextWindow: 131072, supportsImages: false, supportsStreaming: true },
      { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', contextWindow: 1000000, supportsImages: true, supportsStreaming: true },
    ],
  },
  GEMINI: {
    provider: 'GEMINI',
    displayName: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-pro',
    requiresApiKey: true,
    supportsModelListing: true,
    staticModels: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini model with thinking', contextWindow: 1048576, maxOutputTokens: 65536, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 1.25, outputPerMToken: 10 } },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and cost-effective with thinking', contextWindow: 1048576, maxOutputTokens: 65536, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 0.15, outputPerMToken: 0.6 } },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-gen fast model', contextWindow: 1048576, maxOutputTokens: 8192, supportsImages: true, supportsStreaming: true, supportsFunctions: true, pricing: { inputPerMToken: 0.1, outputPerMToken: 0.4 } },
    ],
  },
  LOCAL: {
    provider: 'LOCAL',
    displayName: 'Local LLM',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    requiresApiKey: false,
    supportsModelListing: true,
    staticModels: [
      { id: 'llama3', name: 'Llama 3 8B', description: 'Good general-purpose local model', contextWindow: 8192, supportsImages: false, supportsStreaming: true },
      { id: 'llama3:70b', name: 'Llama 3 70B', description: 'More capable, needs more RAM', contextWindow: 8192, supportsImages: false, supportsStreaming: true },
      { id: 'codellama', name: 'Code Llama', description: 'Optimized for code tasks', contextWindow: 16384, supportsImages: false, supportsStreaming: true },
      { id: 'mistral', name: 'Mistral 7B', description: 'Fast and efficient', contextWindow: 32768, supportsImages: false, supportsStreaming: true },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', description: 'Strong at code analysis', contextWindow: 128000, supportsImages: false, supportsStreaming: true },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', description: 'Good code understanding', contextWindow: 32768, supportsImages: false, supportsStreaming: true },
    ],
  },
};

// =============================================================================
// VALIDATION
// =============================================================================

const createConfigSchema = z.object({
  projectId: z.string().cuid(),
  provider: z.enum(['ANTHROPIC', 'OPENAI', 'OPENROUTER', 'GEMINI', 'LOCAL']),
  name: z.string().min(1).max(100),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  organizationId: z.string().optional(),
  model: z.string().min(1),
  maxTokens: z.number().int().min(256).max(200000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxRequestsPerMin: z.number().int().min(1).optional(),
  maxCostPerSession: z.number().min(0).optional(),
  maxRuntimeSeconds: z.number().int().min(10).max(600).optional(),
  supportsStreaming: z.boolean().optional(),
  supportsImages: z.boolean().optional(),
  supportsFunctions: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const updateConfigSchema = createConfigSchema.partial().omit({ projectId: true, provider: true });

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /ai-providers/defaults
 * Get static defaults and models for all providers (no auth needed for prefill)
 */
router.get('/defaults', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: PROVIDER_DEFAULTS });
  } catch (error) { next(error); }
});

/**
 * GET /ai-providers/models
 * Dynamically list available models for a provider
 */
router.get('/models', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, baseUrl } = req.query;
    if (!provider) throw BadRequestError('provider required');

    const providerStr = (provider as string).toUpperCase();
    const defaults = PROVIDER_DEFAULTS[providerStr];
    if (!defaults) throw BadRequestError(`Unknown provider: ${provider}`);

    // Try dynamic model listing if API key provided
    const key = apiKey as string;
    const url = (baseUrl as string) || defaults.baseUrl;

    let models = defaults.staticModels;

    if (key && providerStr === 'OPENAI') {
      try {
        const resp = await safeFetch(`${url}/models`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const gptModels = (data.data || [])
            .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
            .map((m: any) => ({
              id: m.id,
              name: m.id,
              description: `OpenAI model (owned by ${m.owned_by || 'openai'})`,
              supportsStreaming: true,
            }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));
          if (gptModels.length > 0) models = gptModels;
        }
      } catch (e) {
        logger.warn('Failed to fetch OpenAI models dynamically, using static list');
      }
    }

    if (key && providerStr === 'OPENROUTER') {
      try {
        const resp = await safeFetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const orModels = (data.data || [])
            .slice(0, 100) // limit to top 100
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.id,
              description: m.description,
              contextWindow: m.context_length,
              pricing: m.pricing ? {
                inputPerMToken: parseFloat(m.pricing.prompt) * 1000000,
                outputPerMToken: parseFloat(m.pricing.completion) * 1000000,
              } : undefined,
              supportsImages: m.architecture?.modality?.includes('image'),
              supportsStreaming: true,
            }));
          if (orModels.length > 0) models = orModels;
        }
      } catch (e) {
        logger.warn('Failed to fetch OpenRouter models dynamically, using static list');
      }
    }

    if (key && providerStr === 'GEMINI') {
      try {
        const resp = await safeFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const geminiModels = (data.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => ({
              id: m.name?.replace('models/', '') || m.name,
              name: m.displayName || m.name,
              description: m.description,
              contextWindow: m.inputTokenLimit,
              maxOutputTokens: m.outputTokenLimit,
              supportsImages: m.supportedGenerationMethods?.includes('generateContent'),
              supportsStreaming: true,
            }));
          if (geminiModels.length > 0) models = geminiModels;
        }
      } catch (e) {
        logger.warn('Failed to fetch Gemini models dynamically, using static list');
      }
    }

    if (providerStr === 'LOCAL') {
      const localUrl = (url || 'http://localhost:11434').replace(/\/v1\/?$/, '');
      try {
        // Try Ollama API
        const resp = await safeFetch(`${localUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const localModels = (data.models || []).map((m: any) => ({
            id: m.name || m.model,
            name: m.name || m.model,
            description: `${m.details?.family || 'Local'} - ${m.details?.parameter_size || 'unknown size'}`,
            contextWindow: m.details?.context_length,
            supportsImages: m.details?.families?.includes('clip'),
            supportsStreaming: true,
          }));
          if (localModels.length > 0) models = localModels;
        }
      } catch (e) {
        // Also try OpenAI-compatible /models endpoint
        try {
          const resp = await safeFetch(`${url || localUrl + '/v1'}/models`, {
            signal: AbortSignal.timeout(5000),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const localModels = (data.data || []).map((m: any) => ({
              id: m.id,
              name: m.id,
              description: 'Local model',
              supportsStreaming: true,
            }));
            if (localModels.length > 0) models = localModels;
          }
        } catch {
          logger.warn('Failed to fetch local models, using static list');
        }
      }
    }

    if (key && providerStr === 'ANTHROPIC') {
      // Anthropic doesn't have a models endpoint — use static list but we can validate the key
      try {
        const resp = await safeFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'claude-haiku-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok || resp.status === 200) {
          // Key is valid, return models with a "verified" flag
          models = defaults.staticModels.map((m: any) => ({ ...m, verified: true }));
        } else if (resp.status === 401) {
          models = defaults.staticModels.map((m: any) => ({ ...m, verified: false, error: 'Invalid API key' }));
        }
      } catch {
        // Keep static models
      }
    }

    res.json({ success: true, data: { provider: providerStr, models } });
  } catch (error) { next(error); }
});

/**
 * GET /ai-providers
 * List AI provider configs for a project
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) throw BadRequestError('projectId required');
    await verifyProjectAccess(projectId as string, req.user!.id);

    const configs = await prisma.aIProviderConfig.findMany({
      where: { projectId: projectId as string },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    // Redact API keys
    const safe = configs.map(c => ({
      ...c,
      apiKey: undefined,
      hasApiKey: !!c.apiKey,
    }));

    res.json({ success: true, data: safe });
  } catch (error) { next(error); }
});

/**
 * POST /ai-providers
 * Create AI provider config
 */
router.post('/', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createConfigSchema.parse(req.body);
    await verifyProjectAccess(input.projectId, req.user!.id);

    // If setting as default, unset others
    if (input.isDefault) {
      await prisma.aIProviderConfig.updateMany({
        where: { projectId: input.projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Prefill baseUrl from defaults if not provided
    const defaults = PROVIDER_DEFAULTS[input.provider];
    const baseUrl = input.baseUrl || defaults?.baseUrl || null;

    // Encrypt API key if ENCRYPTION_KEY is set
    let storedApiKey = input.apiKey || null;
    if (storedApiKey) {
      try {
        storedApiKey = encrypt(storedApiKey);
      } catch {
        // ENCRYPTION_KEY not set — store plaintext (dev mode)
      }
    }

    const config = await prisma.aIProviderConfig.create({
      data: {
        projectId: input.projectId,
        provider: input.provider,
        name: input.name,
        apiKey: storedApiKey,
        baseUrl,
        organizationId: input.organizationId || null,
        model: input.model,
        maxTokens: input.maxTokens || 4096,
        temperature: input.temperature ?? 0.2,
        maxRequestsPerMin: input.maxRequestsPerMin || null,
        maxCostPerSession: input.maxCostPerSession || null,
        maxRuntimeSeconds: input.maxRuntimeSeconds || 120,
        supportsStreaming: input.supportsStreaming ?? true,
        supportsImages: input.supportsImages ?? false,
        supportsFunctions: input.supportsFunctions ?? false,
        isDefault: input.isDefault ?? false,
      },
    });

    logger.info(`AI provider config created: ${config.id} (${input.provider}/${input.model})`);
    res.status(201).json({ success: true, data: { ...config, apiKey: undefined, hasApiKey: !!config.apiKey } });
  } catch (error) { next(error); }
});

/**
 * PATCH /ai-providers/:id
 * Update AI provider config
 */
router.patch('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateConfigSchema.parse(req.body);
    const existing = await prisma.aIProviderConfig.findUnique({ where: { id: req.params.id } });
    if (!existing) throw NotFoundError('AI provider config');
    await verifyProjectAccess(existing.projectId, req.user!.id);

    if (input.isDefault) {
      await prisma.aIProviderConfig.updateMany({
        where: { projectId: existing.projectId, isDefault: true, id: { not: existing.id } },
        data: { isDefault: false },
      });
    }

    // Encrypt API key if being updated and ENCRYPTION_KEY is set
    const updateData = { ...input } as any;
    if (updateData.apiKey) {
      try {
        updateData.apiKey = encrypt(updateData.apiKey);
      } catch {
        // ENCRYPTION_KEY not set — store plaintext (dev mode)
      }
    }

    const updated = await prisma.aIProviderConfig.update({
      where: { id: existing.id },
      data: updateData,
    });

    res.json({ success: true, data: { ...updated, apiKey: undefined, hasApiKey: !!updated.apiKey } });
  } catch (error) { next(error); }
});

/**
 * DELETE /ai-providers/:id
 */
router.delete('/:id', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.aIProviderConfig.findUnique({ where: { id: req.params.id } });
    if (!existing) throw NotFoundError('AI provider config');
    await verifyProjectAccess(existing.projectId, req.user!.id);
    await prisma.aIProviderConfig.delete({ where: { id: existing.id } });
    logger.info(`AI provider config deleted: ${existing.id}`);
    res.json({ success: true, data: { message: 'AI provider config deleted' } });
  } catch (error) { next(error); }
});

/**
 * POST /ai-providers/:id/test
 * Test connection to AI provider
 */
router.post('/:id/test', authenticate, mutationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.aIProviderConfig.findUnique({ where: { id: req.params.id } });
    if (!config) throw NotFoundError('AI provider config');
    await verifyProjectAccess(config.projectId, req.user!.id);

    // Decrypt API key for use in test requests
    const apiKey = decryptApiKey(config.apiKey) || '';

    let result: { success: boolean; message: string; latencyMs: number } = { success: false, message: 'Unknown error', latencyMs: 0 };
    const start = Date.now();

    try {
      if (config.provider === 'ANTHROPIC') {
        const resp = await safeFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        result.latencyMs = Date.now() - start;
        if (resp.ok) {
          result.success = true;
          result.message = `Connected to Anthropic (${config.model}) in ${result.latencyMs}ms`;
        } else {
          const err = await resp.json().catch(() => ({}));
          result.message = `Anthropic error ${resp.status}: ${(err as any).error?.message || resp.statusText}`;
        }
      } else if (config.provider === 'OPENAI' || config.provider === 'OPENROUTER') {
        const baseUrl = config.baseUrl || (config.provider === 'OPENROUTER' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        if (config.provider === 'OPENROUTER') {
          headers['HTTP-Referer'] = 'https://github.com/visiontest-ai/visiontest-ai';
          headers['X-Title'] = 'VisionTest.ai';
        }
        const resp = await safeFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        result.latencyMs = Date.now() - start;
        if (resp.ok) {
          result.success = true;
          result.message = `Connected to ${config.provider} (${config.model}) in ${result.latencyMs}ms`;
        } else {
          const err = await resp.json().catch(() => ({}));
          result.message = `${config.provider} error ${resp.status}: ${(err as any).error?.message || resp.statusText}`;
        }
      } else if (config.provider === 'GEMINI') {
        const resp = await safeFetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say "ok" and nothing else.' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
          signal: AbortSignal.timeout(15000),
        });
        result.latencyMs = Date.now() - start;
        if (resp.ok) {
          result.success = true;
          result.message = `Connected to Gemini (${config.model}) in ${result.latencyMs}ms`;
        } else {
          const err = await resp.json().catch(() => ({}));
          result.message = `Gemini error ${resp.status}: ${(err as any).error?.message || resp.statusText}`;
        }
      } else if (config.provider === 'LOCAL') {
        const baseUrl = config.baseUrl || 'http://localhost:11434/v1';
        const resp = await safeFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          }),
          signal: AbortSignal.timeout(30000),
        });
        result.latencyMs = Date.now() - start;
        if (resp.ok) {
          result.success = true;
          result.message = `Connected to local LLM (${config.model}) in ${result.latencyMs}ms`;
        } else {
          result.message = `Local LLM error ${resp.status}: ${resp.statusText}`;
        }
      }
    } catch (e: any) {
      if (e.message?.includes('blocked') || e.message?.includes('not allowed') || e.message?.includes('Cannot resolve')) {
        return res.status(400).json({ success: false, error: e.message });
      }
      result.latencyMs = Date.now() - start;
      result.message = `Connection failed: ${e instanceof Error ? e.message : 'timeout or network error'}`;
    }

    return res.json({ success: true, data: result });
  } catch (error) { return next(error); }
});

export default router;
