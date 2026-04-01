// VisionTest.ai - Embeddings Sidecar Client
// HTTP client for the Python embeddings service (SSIM, LPIPS, DINOv2)

import { logger } from '../utils/logger';

const DEFAULT_TIMEOUT_MS = 10_000;

interface HealthResponse {
  status: string;
  models_loaded: string[];
  gpu_available: boolean;
  device: string;
}

interface SimilarityScore {
  score: number;
}

interface ComputeAllResponse {
  ssim: SimilarityScore;
  lpips: SimilarityScore;
  dino_cosine: SimilarityScore;
  baseline_embedding: number[];
  current_embedding: number[];
}

interface SsimResponse {
  ssim: SimilarityScore;
}

interface LpipsResponse {
  lpips: SimilarityScore;
}

interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

export class EmbeddingsClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.EMBEDDINGS_SERVICE_URL || 'http://visiontest-embeddings:8100';
    // Strip trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Check sidecar health, model readiness, and GPU availability
   */
  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Embeddings sidecar health check failed: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<HealthResponse>;
  }

  /**
   * Compute all similarity metrics in a single request (SSIM + LPIPS + DINOv2 cosine)
   * Returns scores and raw embeddings for caching
   */
  async computeAll(baseline: Buffer, current: Buffer): Promise<ComputeAllResponse> {
    const form = this.buildForm(baseline, current);

    const res = await fetch(`${this.baseUrl}/similarity/all`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Embeddings sidecar /similarity/all failed: ${res.status} ${res.statusText} — ${body}`);
    }

    return res.json() as Promise<ComputeAllResponse>;
  }

  /**
   * Compute SSIM only
   */
  async computeSsim(baseline: Buffer, current: Buffer): Promise<SsimResponse> {
    const form = this.buildForm(baseline, current);

    const res = await fetch(`${this.baseUrl}/similarity/ssim`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Embeddings sidecar /similarity/ssim failed: ${res.status} ${res.statusText} — ${body}`);
    }

    return res.json() as Promise<SsimResponse>;
  }

  /**
   * Compute LPIPS only
   */
  async computeLpips(baseline: Buffer, current: Buffer): Promise<LpipsResponse> {
    const form = this.buildForm(baseline, current);

    const res = await fetch(`${this.baseUrl}/similarity/lpips`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Embeddings sidecar /similarity/lpips failed: ${res.status} ${res.statusText} — ${body}`);
    }

    return res.json() as Promise<LpipsResponse>;
  }

  /**
   * Get DINOv2 embedding for a single image
   */
  async getEmbedding(image: Buffer): Promise<EmbeddingResponse> {
    const form = new FormData();
    form.append('image', new Blob([Uint8Array.from(image)], { type: 'image/png' }), 'image.png');

    const res = await fetch(`${this.baseUrl}/embeddings/image`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Embeddings sidecar /embeddings/image failed: ${res.status} ${res.statusText} — ${body}`);
    }

    return res.json() as Promise<EmbeddingResponse>;
  }

  /**
   * Check if the embeddings sidecar is reachable and healthy
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'ok' || health.status === 'healthy';
    } catch (err) {
      logger.debug({ err }, 'Embeddings sidecar unavailable');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildForm(baseline: Buffer, current: Buffer): FormData {
    const form = new FormData();
    form.append('baseline', new Blob([Uint8Array.from(baseline)], { type: 'image/png' }), 'baseline.png');
    form.append('current', new Blob([Uint8Array.from(current)], { type: 'image/png' }), 'current.png');
    return form;
  }
}
