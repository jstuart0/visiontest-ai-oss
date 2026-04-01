// VisionTest AI - Unified AI Service
// Abstracts Anthropic, OpenAI, Gemini, OpenRouter, and Local LLM providers

import { prisma, decryptApiKey } from '@visiontest/database';
import { logger } from '../utils/logger';

interface AIConfig {
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRuntimeSeconds: number;
  supportsImages: boolean;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  durationMs: number;
}

export class AIService {
  private config: AIConfig | null = null;
  private configLoaded = false;

  /**
   * Load the default AI provider config for a project
   */
  async loadConfig(projectId: string): Promise<boolean> {
    try {
      const config = await prisma.aIProviderConfig.findFirst({
        where: { projectId, isActive: true, isDefault: true },
      });

      if (!config) {
        // Fall back to any active config
        const anyConfig = await prisma.aIProviderConfig.findFirst({
          where: { projectId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });
        if (!anyConfig) {
          this.config = null;
          this.configLoaded = true;
          return false;
        }
        this.config = {
          provider: anyConfig.provider,
          apiKey: decryptApiKey(anyConfig.apiKey) || anyConfig.apiKey,
          baseUrl: anyConfig.baseUrl,
          model: anyConfig.model,
          maxTokens: anyConfig.maxTokens,
          temperature: anyConfig.temperature,
          maxRuntimeSeconds: anyConfig.maxRuntimeSeconds,
          supportsImages: anyConfig.supportsImages,
        };
      } else {
        this.config = {
          provider: config.provider,
          apiKey: decryptApiKey(config.apiKey) || config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          maxRuntimeSeconds: config.maxRuntimeSeconds,
          supportsImages: config.supportsImages,
        };
      }

      this.configLoaded = true;
      logger.info(`AI service loaded: ${this.config.provider}/${this.config.model}`);
      return true;
    } catch (error) {
      logger.error('Failed to load AI config:', error);
      this.configLoaded = true;
      return false;
    }
  }

  /**
   * Check if AI is available (configured and loaded)
   */
  isAvailable(): boolean {
    return this.configLoaded && this.config !== null;
  }

  /**
   * Get the current provider/model info
   */
  getInfo(): { provider: string; model: string } | null {
    if (!this.config) return null;
    return { provider: this.config.provider, model: this.config.model };
  }

  /**
   * Send a completion request to the configured provider
   */
  async complete(messages: AIMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<AIResponse> {
    if (!this.config) {
      throw new Error('AI service not configured. Add an AI provider in Settings > Automation > AI Providers.');
    }

    const maxTokens = options?.maxTokens || this.config.maxTokens;
    const temperature = options?.temperature ?? this.config.temperature;
    const start = Date.now();

    try {
      switch (this.config.provider) {
        case 'ANTHROPIC':
          return await this.completeAnthropic(messages, maxTokens, temperature, start);
        case 'OPENAI':
          return await this.completeOpenAI(messages, maxTokens, temperature, start);
        case 'OPENROUTER':
          return await this.completeOpenRouter(messages, maxTokens, temperature, start);
        case 'GEMINI':
          return await this.completeGemini(messages, maxTokens, temperature, start);
        case 'LOCAL':
          return await this.completeLocal(messages, maxTokens, temperature, start);
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      const durationMs = Date.now() - start;
      logger.error(`AI completion failed (${this.config.provider}/${this.config.model}, ${durationMs}ms):`, error);
      throw error;
    }
  }

  // =========================================================================
  // ANTHROPIC
  // =========================================================================

  private async completeAnthropic(messages: AIMessage[], maxTokens: number, temperature: number, start: number): Promise<AIResponse> {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');

    const body: any = {
      model: this.config!.model,
      max_tokens: maxTokens,
      temperature,
      messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config!.apiKey || '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config!.maxRuntimeSeconds * 1000),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Anthropic ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    return {
      content: data.content?.[0]?.text || '',
      model: data.model,
      provider: 'ANTHROPIC',
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      durationMs: Date.now() - start,
    };
  }

  // =========================================================================
  // OPENAI
  // =========================================================================

  private async completeOpenAI(messages: AIMessage[], maxTokens: number, temperature: number, start: number): Promise<AIResponse> {
    const baseUrl = this.config!.baseUrl || 'https://api.openai.com/v1';

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config!.apiKey || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config!.model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(this.config!.maxRuntimeSeconds * 1000),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`OpenAI ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      provider: 'OPENAI',
      tokensUsed: data.usage?.total_tokens,
      durationMs: Date.now() - start,
    };
  }

  // =========================================================================
  // OPENROUTER
  // =========================================================================

  private async completeOpenRouter(messages: AIMessage[], maxTokens: number, temperature: number, start: number): Promise<AIResponse> {
    const baseUrl = this.config!.baseUrl || 'https://openrouter.ai/api/v1';

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config!.apiKey || ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/visiontest-ai/visiontest-ai',
        'X-Title': 'VisionTest AI',
      },
      body: JSON.stringify({
        model: this.config!.model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(this.config!.maxRuntimeSeconds * 1000),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`OpenRouter ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      provider: 'OPENROUTER',
      tokensUsed: data.usage?.total_tokens,
      durationMs: Date.now() - start,
    };
  }

  // =========================================================================
  // GEMINI
  // =========================================================================

  private async completeGemini(messages: AIMessage[], maxTokens: number, temperature: number, start: number): Promise<AIResponse> {
    const model = this.config!.model;
    const apiKey = this.config!.apiKey || '';

    // Convert messages to Gemini format
    const systemMsg = messages.find(m => m.role === 'system');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config!.maxRuntimeSeconds * 1000),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Gemini ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);

    return {
      content: text,
      model,
      provider: 'GEMINI',
      tokensUsed,
      durationMs: Date.now() - start,
    };
  }

  // =========================================================================
  // LOCAL (Ollama / OpenAI-compatible)
  // =========================================================================

  private async completeLocal(messages: AIMessage[], maxTokens: number, temperature: number, start: number): Promise<AIResponse> {
    const baseUrl = this.config!.baseUrl || 'http://localhost:11434/v1';

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config!.model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(this.config!.maxRuntimeSeconds * 1000),
    });

    if (!resp.ok) {
      throw new Error(`Local LLM ${resp.status}: ${resp.statusText}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || this.config!.model,
      provider: 'LOCAL',
      tokensUsed: data.usage?.total_tokens,
      durationMs: Date.now() - start,
    };
  }

  // =========================================================================
  // HIGH-LEVEL METHODS (used by fix orchestrator)
  // =========================================================================

  /**
   * Analyze a failure and produce a structured analysis
   */
  async analyzeFailure(evidence: {
    errorMessage?: string;
    testSteps?: unknown;
    diffScore?: number;
    screenshotCount?: number;
    executionResult?: unknown;
    comparisonData?: unknown;
    flakyHistory?: unknown;
  }): Promise<{
    classification: string;
    confidence: number;
    reasoning: string;
    plainLanguageSummary: string;
    technicalSummary: string;
    rootCause: string;
  }> {
    const prompt = `You are a QA expert analyzing a test failure. Based on the evidence below, classify the failure and explain the root cause.

EVIDENCE:
${JSON.stringify(evidence, null, 2)}

Respond in this exact JSON format (no markdown, just JSON):
{
  "classification": "PRODUCT_BUG" | "TEST_ISSUE" | "ENVIRONMENT_ISSUE" | "EXPECTED_CHANGE",
  "confidence": 0.0-1.0,
  "reasoning": "why you chose this classification",
  "plainLanguageSummary": "1-2 sentence summary a non-technical person can understand",
  "technicalSummary": "technical details for engineers",
  "rootCause": "what likely caused this failure"
}`;

    const response = await this.complete([
      { role: 'system', content: 'You are a test failure analysis expert. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ]);

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();

      return JSON.parse(jsonStr);
    } catch {
      logger.warn('Failed to parse AI analysis response, returning raw content');
      return {
        classification: 'UNCLASSIFIED',
        confidence: 0.5,
        reasoning: response.content,
        plainLanguageSummary: response.content.substring(0, 200),
        technicalSummary: response.content,
        rootCause: 'AI analysis could not be structured — see raw output',
      };
    }
  }

  /**
   * Generate suggested actions for a bug candidate
   */
  async generateSuggestedActions(context: {
    classification: string;
    confidence: number;
    rootCause: string;
    failureType: string;
    hasRepoConnection: boolean;
  }): Promise<unknown[]> {
    const prompt = `Based on this bug classification, suggest ranked actions for the user:

Classification: ${context.classification}
Confidence: ${context.confidence}
Root Cause: ${context.rootCause}
Failure Type: ${context.failureType}
Repository Connected: ${context.hasRepoConnection}

Respond with a JSON array of suggested actions. Each action should have:
- id: short snake_case identifier
- title: action name
- description: what this action does
- rationale: why this is recommended
- confidence: 0.0-1.0
- actionFamily: "triage" | "expected_change" | "contract_change" | "code_fix"
- approvalClass: "triage_decision" | "expected_change" | "contract_change" | "code_fix"
- deliveryClass: "none" | "approval_only" | "patch" | "branch" | "pr"
- nextStep: what happens next

Respond with valid JSON array only, no markdown.`;

    const response = await this.complete([
      { role: 'system', content: 'You are a QA workflow expert. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ]);

    try {
      let jsonStr = response.content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  }

  /**
   * Generate a minimal, targeted code patch to fix a failure
   */
  async generatePatch(params: {
    errorMessage: string;
    failureType: string;
    rootCauseHypothesis: string;
    fileContents: Array<{ path: string; content: string }>;
    testSteps: string;
    impactedFiles: Array<{ path: string; reason: string }>;
  }): Promise<{ files: Array<{ path: string; original: string; patched: string; explanation: string }>; summary: string }> {
    // Truncate file contents to 500 lines each, limit to 5 files
    const truncatedFiles = params.fileContents.slice(0, 5).map(f => ({
      path: f.path,
      content: f.content.split('\n').slice(0, 500).join('\n'),
    }));

    const prompt = `You need to fix a bug. Generate minimal, targeted code changes.

ERROR MESSAGE:
${params.errorMessage}

FAILURE TYPE: ${params.failureType}

ROOT CAUSE HYPOTHESIS:
${params.rootCauseHypothesis}

TEST STEPS:
${params.testSteps}

IMPACTED FILES:
${params.impactedFiles.map(f => `- ${f.path}: ${f.reason}`).join('\n')}

FILE CONTENTS:
${truncatedFiles.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')}

Respond with valid JSON only:
{
  "files": [
    {
      "path": "relative/file/path",
      "original": "the exact original code snippet that needs changing",
      "patched": "the replacement code with the fix applied",
      "explanation": "why this change fixes the issue"
    }
  ],
  "summary": "one-line summary of the fix"
}`;

    const response = await this.complete([
      { role: 'system', content: 'You are a senior software engineer specializing in bug fixes. Generate minimal, targeted code changes to fix the described issue. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ]);

    try {
      let jsonStr = response.content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      return JSON.parse(jsonStr);
    } catch {
      logger.warn('Failed to parse AI patch response, returning raw content');
      return { files: [], summary: response.content.slice(0, 500) };
    }
  }

  /**
   * Generate a root cause hypothesis with file localization
   */
  async generateRootCauseHypothesis(context: {
    errorMessage?: string;
    failureType: string;
    testSteps?: unknown;
    impactMappings?: { filePath: string; components: string[] }[];
  }): Promise<{
    hypothesis: string;
    confidence: number;
    likelyFiles: { path: string; reason: string; confidence: number }[];
  }> {
    const prompt = `Analyze this test failure and hypothesize the root cause. Identify likely files if possible.

Error: ${context.errorMessage || 'No error message'}
Failure Type: ${context.failureType}
Test Steps: ${JSON.stringify(context.testSteps || [])}
Known Impact Mappings: ${JSON.stringify(context.impactMappings || [])}

Respond with valid JSON only:
{
  "hypothesis": "root cause explanation",
  "confidence": 0.0-1.0,
  "likelyFiles": [{ "path": "file/path", "reason": "why", "confidence": 0.0-1.0 }]
}`;

    const response = await this.complete([
      { role: 'system', content: 'You are a code analysis expert. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ]);

    try {
      let jsonStr = response.content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      return JSON.parse(jsonStr);
    } catch {
      return {
        hypothesis: response.content.substring(0, 500),
        confidence: 0.3,
        likelyFiles: [],
      };
    }
  }
}
