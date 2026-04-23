import type {
  CreateTestFromStoryInput,
  ListTestsInput,
  ParseStoryInput,
  RunSuiteInput,
  RunTestInput,
  StartProjectScanInput,
  StartSmokeExploreInput,
  VisionTestConfig,
  VisionTestEnvelope,
} from './types.js';

type QueryValue = string | number | boolean | string[] | undefined | null;

function buildQuery(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) query.set(key, value.join(','));
      continue;
    }
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const maybeEnvelope = payload as VisionTestEnvelope<unknown>;
    if (typeof maybeEnvelope.error === 'string') return maybeEnvelope.error;
    if (maybeEnvelope.error && typeof maybeEnvelope.error.message === 'string') {
      return maybeEnvelope.error.message;
    }
  }
  return fallback;
}

export class VisionTestApiClient {
  constructor(private readonly config: VisionTestConfig) {}

  private async requestEnvelope<T>(path: string, init?: RequestInit): Promise<VisionTestEnvelope<T>> {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.config.bearerToken) {
      headers.set('Authorization', `Bearer ${this.config.bearerToken}`);
    }
    if (this.config.apiKey) {
      headers.set('X-API-Key', this.config.apiKey);
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers,
    });

    let payload: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `VisionTest API error ${response.status}`));
    }

    const envelope = payload as VisionTestEnvelope<T>;
    if (!envelope || envelope.success !== true) {
      throw new Error(extractErrorMessage(payload, 'VisionTest API returned an unexpected response'));
    }

    return envelope;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const envelope = await this.requestEnvelope<T>(path, init);
    return envelope.data;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  listProjects() {
    return this.get<any[]>('/projects');
  }

  getProject(projectId: string) {
    return this.get<any>(`/projects/${projectId}`);
  }

  listTests(input: ListTestsInput) {
    const query = buildQuery({
      projectId: input.project_id,
      status: input.status,
      tags: input.tags,
      search: input.search,
      page: input.page,
      limit: input.limit,
    });
    return this.requestEnvelope<any[]>(`/tests${query}`, { method: 'GET' });
  }

  getTest(testId: string) {
    return this.get<any>(`/tests/${testId}`);
  }

  previewStory(input: ParseStoryInput) {
    return this.post<any>('/tests/story-preview', {
      projectId: input.project_id,
      story: input.story,
      goal: input.goal,
      baseUrl: input.start_url,
      storyFormat: input.story_format,
    });
  }

  createTestFromStory(input: CreateTestFromStoryInput) {
    return this.post<any>('/tests/story', {
      projectId: input.project_id,
      name: input.name,
      description: input.description,
      suiteId: input.suite_id,
      featureId: input.feature_id,
      story: input.story,
      goal: input.goal,
      baseUrl: input.start_url,
      storyFormat: input.story_format,
      tags: input.tags,
      environment: input.environment,
      credentialRef: input.credential_ref,
    });
  }

  updateTest(testId: string, patch: Record<string, unknown>) {
    return this.patch<any>(`/tests/${testId}`, patch);
  }

  runTest(input: RunTestInput) {
    return this.post<any>('/executions', {
      projectId: input.project_id,
      testId: input.test_id,
      deviceProfileId: input.device_profile_id,
      config: {
        browser: input.browser,
        headless: input.headless,
        baseUrl: input.base_url,
      },
    });
  }

  runSuite(input: RunSuiteInput) {
    return this.post<any>('/executions', {
      projectId: input.project_id,
      suiteId: input.suite_id,
      deviceProfileId: input.device_profile_id,
      config: {
        browser: input.browser,
        headless: input.headless,
        baseUrl: input.base_url,
      },
    });
  }

  getExecution(executionId: string) {
    return this.get<any>(`/executions/${executionId}`);
  }

  getFailureSummary(executionId: string) {
    return this.get<any>(`/executions/${executionId}/failure-summary`);
  }

  listComparisons(input: { project_id?: string; execution_id?: string; status?: string; page?: number; limit?: number }) {
    const query = buildQuery({
      projectId: input.project_id,
      executionId: input.execution_id,
      status: input.status,
      page: input.page,
      limit: input.limit,
    });
    return this.requestEnvelope<any[]>(`/comparisons${query}`, { method: 'GET' });
  }

  getComparison(comparisonId: string) {
    return this.get<any>(`/comparisons/${comparisonId}`);
  }

  startSmokeExplore(input: StartSmokeExploreInput) {
    return this.post<any>('/scans/smoke', {
      projectId: input.project_id,
      startUrl: input.start_url,
      sessionMode: input.session_mode,
    });
  }

  startProjectScan(input: StartProjectScanInput) {
    return this.post<any>(`/projects/${input.project_id}/scan`, {
      startUrl: input.start_url,
      maxPages: input.max_pages,
      maxClicksPerPage: input.max_clicks_per_page,
      loginSteps: input.login_steps,
      safety: input.safety,
    });
  }

  getScanTree(executionId: string) {
    return this.get<any>(`/executions/${executionId}/nodes`);
  }

  promoteScanFinding(executionId: string, nodeId: string, body: { name?: string; projectId?: string }) {
    return this.post<any>(`/scans/${executionId}/nodes/${nodeId}/promote`, body);
  }
}
