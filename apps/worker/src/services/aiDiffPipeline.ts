// VisionTest.ai - AI Diff Pipeline
// 4-stage cascading visual diff analysis: Pixel → SSIM/LPIPS → DINOv2 → VLM

import { logger } from '../utils/logger';
import { AIService } from './aiService';
import { EmbeddingsClient } from './embeddingsClient';

// Mirror of the Prisma AiDiffConfig model.
// Defined locally to avoid dependency on generated client during early development.
// Once `prisma generate` has been run with the AiDiffConfig model, this can be
// replaced with: import { AiDiffConfig } from '@visiontest/database';
export interface AiDiffConfig {
  id: string;
  projectId: string;
  enabled: boolean;
  ssimThreshold: number;
  lpipsThreshold: number;
  dinoThreshold: number;
  maxStage: number;
  autoApproveNoise: boolean;
  autoApproveMinor: boolean;
  escalateBreaking: boolean;
  aiProviderId: string | null;
  vlmPromptOverride: string | null;
  vlmCallsPerExecution: number;
  vlmMonthlyBudget: number | null;
  sidecarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Types
// =============================================================================

export interface AiDiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  severity: 'NOISE' | 'MINOR' | 'SIGNIFICANT' | 'BREAKING';
}

export interface AiDiffResult {
  classification: 'IDENTICAL' | 'NOISE' | 'MINOR' | 'SIGNIFICANT' | 'BREAKING';
  confidence: number;
  stageReached: number; // 0-3
  explanation: string;
  regions: AiDiffRegion[];
  suggestedAction: 'AUTO_APPROVE' | 'REVIEW' | 'REJECT' | 'ESCALATE';
  processingTimeMs: number;
  modelUsed?: string;
  scores?: {
    pixelDiffPercent?: number;
    ssim?: number;
    lpips?: number;
    dinoCosineSimilarity?: number;
  };
}

interface AnalysisContext {
  testName?: string;
  pageOrComponent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
}

type Classification = AiDiffResult['classification'];
type SuggestedAction = AiDiffResult['suggestedAction'];

// =============================================================================
// VLM Prompt Templates
// =============================================================================

const VLM_SYSTEM_PROMPT = `You are a visual regression testing assistant. Your job is to analyze two screenshots of a web page (a baseline and a current version) plus a pixel-diff overlay, and classify the visual difference.

You MUST respond with a single JSON object. Do not include any text before or after the JSON. Do not use markdown code fences.

The JSON object must have this exact structure:
{
  "classification": "IDENTICAL" | "NOISE" | "MINOR" | "SIGNIFICANT" | "BREAKING",
  "confidence": <float 0.0-1.0>,
  "explanation": "<1-3 sentence human-readable description of what changed>",
  "regions": [
    {
      "x": <number>,
      "y": <number>,
      "width": <number>,
      "height": <number>,
      "description": "<what changed in this region>",
      "severity": "NOISE" | "MINOR" | "SIGNIFICANT" | "BREAKING"
    }
  ],
  "suggested_action": "AUTO_APPROVE" | "REVIEW" | "REJECT" | "ESCALATE"
}

Classification definitions:
- IDENTICAL: No visible difference. The screenshots look the same to a human.
- NOISE: Sub-pixel rendering, anti-aliasing, font hinting, or compression artifact differences. No human would notice these in normal use.
- MINOR: Small, intentional-looking changes that don't affect functionality or layout. Examples: updated copyright year, slightly different icon, minor color shade change.
- SIGNIFICANT: Clearly visible changes to content, layout, or styling that a user would notice. Examples: different hero image, moved navigation item, new banner added, color scheme change.
- BREAKING: Changes that indicate a bug, regression, or broken UI. Examples: missing component, overlapping text, broken layout, empty page section, misaligned elements, truncated content.

Suggested action rules:
- IDENTICAL or NOISE -> AUTO_APPROVE
- MINOR -> REVIEW (human should confirm)
- SIGNIFICANT -> REVIEW (human should confirm intentionality)
- BREAKING -> ESCALATE (likely a regression, needs immediate attention)

Confidence indicates how certain you are about the classification. Use lower confidence (0.5-0.7) when the change is ambiguous.`;

function buildUserPrompt(
  pixelDiffPercent: number,
  context?: AnalysisContext,
  scores?: AiDiffResult['scores'],
): string {
  const lines: string[] = ['Analyze this visual regression test comparison.', ''];

  if (context?.testName) {
    lines.push(`Test: ${context.testName}`);
  }
  if (context?.pageOrComponent) {
    lines.push(`Page/Component: ${context.pageOrComponent}`);
  }
  if (context?.viewportWidth && context?.viewportHeight) {
    lines.push(`Viewport: ${context.viewportWidth}x${context.viewportHeight}`);
  }

  lines.push(`Pixel diff percentage: ${pixelDiffPercent.toFixed(4)}%`);

  // Include sidecar metrics when available (since we send text-only, not images)
  if (scores) {
    lines.push('');
    lines.push('Perceptual similarity metrics from automated analysis:');
    if (scores.ssim !== undefined) {
      lines.push(`  SSIM (structural similarity): ${(scores.ssim * 100).toFixed(2)}%`);
    }
    if (scores.lpips !== undefined) {
      lines.push(`  LPIPS (perceptual distance): ${(scores.lpips * 100).toFixed(3)}% (lower = more similar)`);
    }
    if (scores.dinoCosineSimilarity !== undefined) {
      lines.push(`  DINOv2 cosine similarity (semantic): ${(scores.dinoCosineSimilarity * 100).toFixed(2)}%`);
    }
  }

  lines.push('');
  lines.push('Image 1 (BASELINE - the expected/approved version): [described by metrics above]');
  lines.push('Image 2 (CURRENT - the new version being tested): [described by metrics above]');
  lines.push('Image 3 (DIFF OVERLAY - red pixels show where differences exist): [described by metrics above]');
  lines.push('');
  lines.push('Based on the metrics and diff data, classify the visual difference and explain what likely changed.');

  return lines.join('\n');
}

// =============================================================================
// VLM Response Parser
// =============================================================================

interface VlmParsedResponse {
  classification: Classification;
  confidence: number;
  explanation: string;
  regions: AiDiffRegion[];
  suggestedAction: SuggestedAction;
}

/**
 * Parse VLM response with full fallback chain:
 * 1. Direct JSON.parse
 * 2. Extract from markdown code fences
 * 3. Extract first { ... } block
 * 4. Regex for classification keyword
 * 5. Final fallback to MINOR/REVIEW
 */
export function parseVlmResponse(raw: string): VlmParsedResponse {
  // Attempt 1: Direct JSON parse
  try {
    return normalizeVlmJson(JSON.parse(raw));
  } catch { /* continue */ }

  // Attempt 2: Extract JSON from markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return normalizeVlmJson(JSON.parse(fenceMatch[1]));
    } catch { /* continue */ }
  }

  // Attempt 3: Find first { ... } block (greedy)
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return normalizeVlmJson(JSON.parse(braceMatch[0]));
    } catch { /* continue */ }
  }

  // Attempt 4: Regex extraction of classification keyword
  const classMatch = raw.match(/\b(IDENTICAL|NOISE|MINOR|SIGNIFICANT|BREAKING)\b/i);
  if (classMatch) {
    const classification = classMatch[1].toUpperCase() as Classification;
    return {
      classification,
      confidence: 0.6, // Lower confidence due to parse failure
      explanation: raw.slice(0, 500),
      regions: [],
      suggestedAction: classificationToAction(classification),
    };
  }

  // Final fallback: inconclusive
  logger.warn('VLM response could not be parsed at all, falling back to MINOR/REVIEW');
  return {
    classification: 'MINOR',
    confidence: 0.4,
    explanation: 'AI analysis was inconclusive — manual review recommended.',
    regions: [],
    suggestedAction: 'REVIEW',
  };
}

/**
 * Normalize parsed JSON from VLM into our expected shape.
 * Handles snake_case vs camelCase, missing fields, and invalid values.
 */
function normalizeVlmJson(parsed: any): VlmParsedResponse {
  const validClassifications = new Set(['IDENTICAL', 'NOISE', 'MINOR', 'SIGNIFICANT', 'BREAKING']);
  const validActions = new Set(['AUTO_APPROVE', 'REVIEW', 'REJECT', 'ESCALATE']);

  const rawClassification = String(parsed.classification || '').toUpperCase();
  const classification: Classification = validClassifications.has(rawClassification)
    ? (rawClassification as Classification)
    : 'MINOR';

  const rawAction = String(parsed.suggested_action || parsed.suggestedAction || '').toUpperCase();
  const suggestedAction: SuggestedAction = validActions.has(rawAction)
    ? (rawAction as SuggestedAction)
    : classificationToAction(classification);

  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.7;

  const explanation = typeof parsed.explanation === 'string'
    ? parsed.explanation
    : 'Visual difference detected.';

  // Parse regions array, tolerating partial data
  const rawRegions = Array.isArray(parsed.regions) ? parsed.regions : [];
  const regions: AiDiffRegion[] = rawRegions
    .filter((r: any) => r && typeof r === 'object')
    .map((r: any) => ({
      x: typeof r.x === 'number' ? r.x : 0,
      y: typeof r.y === 'number' ? r.y : 0,
      width: typeof r.width === 'number' ? r.width : 0,
      height: typeof r.height === 'number' ? r.height : 0,
      description: String(r.description || 'Unknown region'),
      severity: validClassifications.has(String(r.severity || '').toUpperCase()) && String(r.severity).toUpperCase() !== 'IDENTICAL'
        ? (String(r.severity).toUpperCase() as AiDiffRegion['severity'])
        : 'MINOR',
    }));

  return { classification, confidence, explanation, regions, suggestedAction };
}

function classificationToAction(classification: Classification): SuggestedAction {
  switch (classification) {
    case 'IDENTICAL':
    case 'NOISE':
      return 'AUTO_APPROVE';
    case 'BREAKING':
      return 'ESCALATE';
    case 'MINOR':
    case 'SIGNIFICANT':
    default:
      return 'REVIEW';
  }
}

// =============================================================================
// Pipeline
// =============================================================================

export class AiDiffPipeline {
  private config: AiDiffConfig;
  private embeddingsClient: EmbeddingsClient;
  private aiService: AIService;

  constructor(
    config: AiDiffConfig,
    embeddingsClient: EmbeddingsClient,
    aiService: AIService,
  ) {
    this.config = config;
    this.embeddingsClient = embeddingsClient;
    this.aiService = aiService;
  }

  /**
   * Run the 4-stage cascading AI diff analysis.
   *
   * Stage 0: Pixel-identical check (pixelDiffPercent === 0)
   * Stage 1: SSIM + LPIPS structural/perceptual gate
   * Stage 2: DINOv2 semantic similarity gate
   * Stage 3: VLM (Vision Language Model) deep analysis
   *
   * Each stage can short-circuit with a classification or escalate to the next.
   * The pipeline respects config.maxStage to limit depth (cost control).
   */
  async analyze(
    baselineBuffer: Buffer,
    currentBuffer: Buffer,
    pixelDiffPercent: number,
    diffOverlayBuffer: Buffer,
    context?: AnalysisContext,
  ): Promise<AiDiffResult> {
    const startTime = Date.now();

    // -------------------------------------------------------------------------
    // Stage 0: Pixel-identical
    // -------------------------------------------------------------------------

    if (pixelDiffPercent === 0) {
      return {
        classification: 'IDENTICAL',
        stageReached: 0,
        confidence: 1.0,
        explanation: 'Screenshots are pixel-identical.',
        regions: [],
        suggestedAction: 'AUTO_APPROVE',
        processingTimeMs: Date.now() - startTime,
        scores: { pixelDiffPercent: 0 },
      };
    }

    // -------------------------------------------------------------------------
    // Stage 1-2: Sidecar metrics (SSIM + LPIPS + DINOv2)
    // -------------------------------------------------------------------------

    let sidecarResult: Awaited<ReturnType<EmbeddingsClient['computeAll']>> | null = null;

    try {
      sidecarResult = await this.embeddingsClient.computeAll(baselineBuffer, currentBuffer);
    } catch (err) {
      logger.warn({ err }, 'Embeddings sidecar unavailable — skipping Stages 1-2');

      // Sidecar unavailable: skip to Stage 3 if allowed, else return MINOR with low confidence
      if (this.config.maxStage >= 3) {
        return this.vlmAnalysis(pixelDiffPercent, startTime, context);
      }

      return {
        classification: 'MINOR',
        stageReached: 0,
        confidence: 0.5,
        explanation: 'AI analysis sidecar unavailable. Manual review recommended.',
        regions: [],
        suggestedAction: 'REVIEW',
        processingTimeMs: Date.now() - startTime,
        scores: { pixelDiffPercent },
      };
    }

    const { ssim, lpips, dino_cosine } = sidecarResult;
    const scores: AiDiffResult['scores'] = {
      pixelDiffPercent,
      ssim: ssim.score,
      lpips: lpips.score,
      dinoCosineSimilarity: dino_cosine.score,
    };

    // -------------------------------------------------------------------------
    // Stage 1: SSIM + LPIPS gate
    // Combined score = min(ssim, 1 - lpips). If above threshold → NOISE.
    // -------------------------------------------------------------------------

    const combinedScore = Math.min(ssim.score, 1.0 - lpips.score);

    if (combinedScore > this.config.ssimThreshold) {
      return {
        classification: 'NOISE',
        stageReached: 1,
        confidence: combinedScore,
        explanation: `Structural similarity ${(ssim.score * 100).toFixed(1)}%, perceptual distance ${(lpips.score * 100).toFixed(2)}% — rendering noise.`,
        regions: [],
        suggestedAction: 'AUTO_APPROVE',
        processingTimeMs: Date.now() - startTime,
        scores,
      };
    }

    if (this.config.maxStage < 2) {
      return {
        classification: 'MINOR',
        stageReached: 1,
        confidence: 0.6,
        explanation: `Below noise threshold (SSIM: ${(ssim.score * 100).toFixed(1)}%, LPIPS: ${(lpips.score * 100).toFixed(2)}%). Visual difference detected.`,
        regions: [],
        suggestedAction: 'REVIEW',
        processingTimeMs: Date.now() - startTime,
        scores,
      };
    }

    // -------------------------------------------------------------------------
    // Stage 2: DINOv2 cosine similarity gate
    // If above threshold → NOISE (semantically equivalent despite pixel diffs)
    // -------------------------------------------------------------------------

    if (dino_cosine.score > this.config.dinoThreshold) {
      return {
        classification: 'NOISE',
        stageReached: 2,
        confidence: dino_cosine.score,
        explanation: `Semantic similarity ${(dino_cosine.score * 100).toFixed(1)}% — visually equivalent despite pixel differences.`,
        regions: [],
        suggestedAction: 'AUTO_APPROVE',
        processingTimeMs: Date.now() - startTime,
        scores,
      };
    }

    if (this.config.maxStage < 3) {
      return {
        classification: 'SIGNIFICANT',
        stageReached: 2,
        confidence: 0.7,
        explanation: `Semantic similarity ${(dino_cosine.score * 100).toFixed(1)}% — meaningful visual change detected.`,
        regions: [],
        suggestedAction: 'REVIEW',
        processingTimeMs: Date.now() - startTime,
        scores,
      };
    }

    // -------------------------------------------------------------------------
    // Stage 3: Vision Language Model
    // -------------------------------------------------------------------------

    return this.vlmAnalysis(pixelDiffPercent, startTime, context, scores);
  }

  // ---------------------------------------------------------------------------
  // Stage 3: VLM Analysis
  // ---------------------------------------------------------------------------

  private async vlmAnalysis(
    pixelDiffPercent: number,
    startTime: number,
    context?: AnalysisContext,
    scores?: AiDiffResult['scores'],
  ): Promise<AiDiffResult> {
    if (!this.aiService.isAvailable()) {
      logger.warn('AI service not configured — cannot run VLM analysis (Stage 3)');
      return {
        classification: 'SIGNIFICANT',
        stageReached: scores ? 2 : 0,
        confidence: 0.5,
        explanation: 'AI provider not configured. Manual review recommended.',
        regions: [],
        suggestedAction: 'REVIEW',
        processingTimeMs: Date.now() - startTime,
        scores: scores || { pixelDiffPercent },
      };
    }

    try {
      // Use custom prompt override from config if set, otherwise default
      const systemPrompt = this.config.vlmPromptOverride || VLM_SYSTEM_PROMPT;
      const userPrompt = buildUserPrompt(pixelDiffPercent, context, scores);

      logger.debug('Calling VLM for Stage 3 analysis');

      const response = await this.aiService.complete([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        maxTokens: 2048,
        temperature: 0.1, // Low temperature for consistent structured output
      });

      const parsed = parseVlmResponse(response.content);
      const modelInfo = this.aiService.getInfo();

      return {
        classification: parsed.classification,
        stageReached: 3,
        confidence: parsed.confidence,
        explanation: parsed.explanation,
        regions: parsed.regions,
        suggestedAction: parsed.suggestedAction,
        processingTimeMs: Date.now() - startTime,
        modelUsed: modelInfo ? `${modelInfo.provider}/${modelInfo.model}` : undefined,
        scores: scores || { pixelDiffPercent },
      };
    } catch (err) {
      logger.error({ err }, 'VLM analysis failed (Stage 3)');

      // Fall back to a conservative classification based on earlier stages
      return {
        classification: 'SIGNIFICANT',
        stageReached: scores ? 2 : 0,
        confidence: 0.5,
        explanation: `VLM analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}. Manual review recommended.`,
        regions: [],
        suggestedAction: 'REVIEW',
        processingTimeMs: Date.now() - startTime,
        scores: scores || { pixelDiffPercent },
      };
    }
  }
}
