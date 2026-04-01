// VisionTest.ai - API-side AI Service (minimal)
// Provides LLM completion for the test parser's AI fallback.
// This is a lightweight subset of the worker's AIService.

import { prisma } from '@visiontest/database';
import { logger } from '../utils/logger';
import { TestStep } from './tests.service';

interface AIConfig {
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRuntimeSeconds: number;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const VALID_STEP_TYPES = new Set([
  'navigate', 'click', 'type', 'waitFor', 'assert', 'screenshot',
  'hover', 'scroll', 'clear', 'select', 'ai',
]);

const SYSTEM_PROMPT = `You are a test automation expert. Convert the given natural language instruction into a structured Playwright test step. Respond with valid JSON only.
The JSON must have one of these types: navigate, click, type, waitFor, assert, screenshot, hover, scroll, clear
Schema: { "type": "...", "selector"?: "CSS selector", "value"?: "text to type", "url"?: "URL to navigate to", "name"?: "screenshot name", "assertion"?: "visible|contains:text", "timeout"?: number }
If the instruction is ambiguous or cannot be mapped to a test step, respond with: { "type": "ai", "value": "original instruction" }`;

export class ApiAiService {
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
          apiKey: anyConfig.apiKey,
          baseUrl: anyConfig.baseUrl,
          model: anyConfig.model,
          maxTokens: anyConfig.maxTokens,
          temperature: anyConfig.temperature,
          maxRuntimeSeconds: anyConfig.maxRuntimeSeconds,
        };
      } else {
        this.config = {
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          maxRuntimeSeconds: config.maxRuntimeSeconds,
        };
      }

      this.configLoaded = true;
      logger.info(`API AI service loaded: ${this.config.provider}/${this.config.model}`);
      return true;
    } catch (error) {
      logger.error('Failed to load API AI config:', error);
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
   * Parse a single natural language sentence into a structured test step using the LLM.
   * Returns null if the LLM cannot produce a valid step.
   */
  async parseStep(sentence: string): Promise<TestStep | null> {
    try {
      const response = await this.complete([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: sentence },
      ]);

      // Strip markdown fences if present
      let jsonStr = response.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();

      const parsed = JSON.parse(jsonStr);

      // Validate type field
      if (!parsed.type || !VALID_STEP_TYPES.has(parsed.type)) {
        return { type: 'ai', value: sentence };
      }

      return parsed as TestStep;
    } catch (error) {
      logger.warn(`AI parseStep failed for "${sentence}":`, error);
      return null;
    }
  }

  /**
   * Send a completion request to the configured provider
   */
  async complete(messages: AIMessage[]): Promise<string> {
    if (!this.config) {
      throw new Error('AI service not configured');
    }

    const maxTokens = Math.min(this.config.maxTokens, 1024); // Small output for step parsing
    const temperature = this.config.temperature;
    const timeoutMs = Math.min(this.config.maxRuntimeSeconds, 30) * 1000;

    switch (this.config.provider) {
      case 'ANTHROPIC':
        return this.completeAnthropic(messages, maxTokens, temperature, timeoutMs);
      case 'OPENAI':
        return this.completeOpenAI(messages, maxTokens, temperature, timeoutMs);
      case 'OPENROUTER':
        return this.completeOpenRouter(messages, maxTokens, temperature, timeoutMs);
      case 'GEMINI':
        return this.completeGemini(messages, maxTokens, temperature, timeoutMs);
      case 'LOCAL':
        return this.completeLocal(messages, maxTokens, temperature, timeoutMs);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  // ===========================================================================
  // ANTHROPIC
  // ===========================================================================

  private async completeAnthropic(messages: AIMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<string> {
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
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Anthropic ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data: any = await resp.json();
    return data.content?.[0]?.text || '';
  }

  // ===========================================================================
  // OPENAI
  // ===========================================================================

  private async completeOpenAI(messages: AIMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<string> {
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
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`OpenAI ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data: any = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ===========================================================================
  // OPENROUTER
  // ===========================================================================

  private async completeOpenRouter(messages: AIMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<string> {
    const baseUrl = this.config!.baseUrl || 'https://openrouter.ai/api/v1';

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config!.apiKey || ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/visiontest-ai/visiontest-ai',
        'X-Title': 'VisionTest.ai',
      },
      body: JSON.stringify({
        model: this.config!.model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`OpenRouter ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data: any = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ===========================================================================
  // GEMINI
  // ===========================================================================

  private async completeGemini(messages: AIMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<string> {
    const model = this.config!.model;
    const apiKey = this.config!.apiKey || '';

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

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Gemini ${resp.status}: ${(err as any).error?.message || resp.statusText}`);
    }

    const data: any = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ===========================================================================
  // LOCAL (Ollama / OpenAI-compatible)
  // ===========================================================================

  private async completeLocal(messages: AIMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<string> {
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
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      throw new Error(`Local LLM ${resp.status}: ${resp.statusText}`);
    }

    const data: any = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }
}
