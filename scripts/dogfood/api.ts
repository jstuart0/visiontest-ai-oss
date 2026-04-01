/**
 * VisionTest AI Dogfood - API Client
 *
 * Thin HTTP wrapper for authenticating, creating tests, running executions,
 * and polling for results against the VisionTest API.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
}

export interface TestStep {
  type: string;
  url?: string;
  selector?: string;
  value?: string;
  name?: string;
  assertion?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

export interface CreatedTest {
  id: string;
  projectId: string;
  name: string;
  status: string;
}

export interface Execution {
  id: string;
  testId: string;
  status: string;
  duration?: number;
  result?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ApiClient {
  constructor(
    private baseUrl: string,
    private token: string = '',
  ) {}

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();

    if (!res.ok || json.success === false) {
      const msg = json.error?.message || json.message || res.statusText;
      throw new Error(`API ${method} ${endpoint} failed (${res.status}): ${msg}`);
    }

    return json.data ?? json;
  }

  // -- Auth -----------------------------------------------------------------

  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>('/auth/login', 'POST', {
      email,
      password,
    });
    this.token = data.accessToken;
    return data;
  }

  // -- Organizations --------------------------------------------------------

  async listOrganizations(): Promise<Organization[]> {
    return this.request<Organization[]>('/organizations');
  }

  // -- Projects -------------------------------------------------------------

  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects');
  }

  async createProject(orgId: string, name: string, slug: string): Promise<Project> {
    return this.request<Project>('/projects', 'POST', { orgId, name, slug });
  }

  // -- Tests ----------------------------------------------------------------

  async listTests(projectId: string, tags?: string[]): Promise<CreatedTest[]> {
    let qs = `?projectId=${projectId}&limit=100`;
    if (tags?.length) qs += `&tags=${tags.join(',')}`;
    return this.request<CreatedTest[]>(`/tests${qs}`);
  }

  async createTest(
    projectId: string,
    name: string,
    steps: TestStep[],
    tags: string[] = [],
  ): Promise<CreatedTest> {
    return this.request<CreatedTest>('/tests', 'POST', {
      projectId,
      name,
      steps,
      tags,
      config: {
        browser: 'chromium',
        viewport: { width: 1920, height: 1080 },
        timeout: 30000,
      },
    });
  }

  async deleteTest(testId: string): Promise<void> {
    await this.request<void>(`/tests/${testId}`, 'DELETE');
  }

  // -- Executions -----------------------------------------------------------

  async runTest(testId: string): Promise<Execution> {
    return this.request<Execution>(`/tests/${testId}/run`, 'POST');
  }

  async getExecution(executionId: string): Promise<Execution> {
    return this.request<Execution>(`/executions/${executionId}`);
  }

  /**
   * Poll an execution until it reaches a terminal status or times out.
   */
  async pollExecution(
    executionId: string,
    intervalMs: number = 3000,
    maxMs: number = 120_000,
  ): Promise<Execution> {
    const terminal = new Set(['PASSED', 'FAILED', 'CANCELLED', 'TIMEOUT']);
    const deadline = Date.now() + maxMs;

    while (Date.now() < deadline) {
      const exec = await this.getExecution(executionId);
      if (terminal.has(exec.status)) return exec;
      await sleep(intervalMs);
    }

    // Timed out waiting
    return {
      id: executionId,
      testId: '',
      status: 'TIMEOUT',
    };
  }

  // -- AI Providers ---------------------------------------------------------

  async listAiProviders(projectId: string): Promise<any[]> {
    return this.request<any[]>(`/ai-providers?projectId=${projectId}`);
  }

  async listAiModels(provider: string, baseUrl: string): Promise<any> {
    return this.request<any>(
      `/ai-providers/models?provider=${encodeURIComponent(provider)}&baseUrl=${encodeURIComponent(baseUrl)}`,
    );
  }

  async testAiProvider(providerId: string): Promise<any> {
    return this.request<any>(`/ai-providers/${providerId}/test`, 'POST');
  }

  // -- Natural Language Parsing ---------------------------------------------

  async parseTestScript(
    script: string,
    projectId: string,
    format: string = 'natural',
  ): Promise<any> {
    return this.request<any>('/tests/parse', 'POST', {
      script,
      format,
      projectId,
    });
  }

  // -- AI Diff --------------------------------------------------------------

  async getAiDiffConfig(projectId: string): Promise<any> {
    return this.request<any>(`/ai-diff/config?projectId=${projectId}`);
  }

  async updateAiDiffConfig(config: Record<string, unknown>): Promise<any> {
    return this.request<any>('/ai-diff/config', 'PUT', config);
  }

  // -- Health ---------------------------------------------------------------

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl.replace('/api/v1', '')}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
