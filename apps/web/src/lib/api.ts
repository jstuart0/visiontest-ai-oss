const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface ApiError {
  message: string;
  code?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = {
        message: 'An error occurred',
        status: response.status,
      };

      try {
        const data = await response.json();
        error.message = data.message || data.error?.message || (typeof data.error === 'string' ? data.error : error.message);
        error.code = data.code || data.error?.code;
      } catch {
        // Response might not be JSON
      }

      if (response.status === 401) {
        // Only redirect on 401 if this is NOT an auth endpoint (login/register)
        // Auth endpoints should let the error bubble up so the UI can show it
        const isAuthEndpoint = response.url.includes('/auth/login') || response.url.includes('/auth/register');
        if (typeof window !== 'undefined' && !isAuthEndpoint) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      }

      throw error;
    }

    const json = await response.json();
    // API wraps responses in { success: true, data: {...} }
    return json.data !== undefined ? json.data : json;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'undefined') {
          url.searchParams.append(key, value);
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }
}

export const api = new ApiClient(API_BASE);

// Type definitions for API responses
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  orgId?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  orgId?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type Platform = 'WEB' | 'IOS' | 'ANDROID' | 'MOBILE_WEB';

export interface DeviceProfile {
  id: string;
  name: string;
  platform: Platform;
  width: number;
  height: number;
  scaleFactor: number;
  userAgent?: string;
  osVersion?: string;
  isEmulator: boolean;
  config: Record<string, unknown>;
  isBuiltIn: boolean;
  projectId?: string;
  createdAt: string;
}

export interface Test {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: string; // Entity status: ACTIVE, DISABLED, ARCHIVED
  lastStatus?: string; // Execution status: PASSED, FAILED, RUNNING, PENDING
  platform?: Platform;
  deviceProfile?: { id: string; name: string; platform: Platform };
  lastRun?: string;
  lastDuration?: number;
  flakyScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisualComparison {
  id: string;
  executionId: string;
  baselineId: string;
  screenshotId?: string;
  diffScore: number;
  diffUrl?: string | null;
  status: string; // PENDING, APPROVED, REJECTED, AUTO_APPROVED, ESCALATED
  changes?: unknown;
  masksApplied: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string | null;
  baseline?: { id: string; name: string; branch: string; url?: string; screenshots?: unknown };
  screenshot?: { id: string; name: string; url: string };
  approval?: unknown;
  // Computed helpers for backward compat
  testId?: string;
  baselineUrl?: string;
  currentUrl?: string;
  diffPercentage?: number;
}

export interface FlakyTest {
  id: string;
  testId: string;
  projectId: string;
  flakinessScore: number;
  status: 'WATCHING' | 'WARNING' | 'QUARANTINED' | 'STABLE' | 'INVESTIGATING';
  quarantinedAt?: string;
  stabilizedAt?: string;
  lastAnalyzedAt?: string;
  createdAt: string;
  updatedAt: string;
  test: {
    id: string;
    name: string;
    tags: string[];
    status: string;
    suiteId?: string;
  };
  runHistory: Array<{
    timestamp: number;
    passed: boolean;
    duration: number;
    executionId?: string;
  }>;
}

export interface Mask {
  id: string;
  testId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ignore' | 'region';
  createdAt: string;
}

export interface DashboardStats {
  totalTests: number;
  passingTests: number;
  failingTests: number;
  flakyTests: number;
  flakyCount?: number;
  pendingVisuals: number;
  testsRunToday: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

// API endpoints
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { name, email, password }),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  validateResetToken: (token: string) =>
    api.get<{ valid: boolean }>('/auth/reset-password/validate', { token }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/password', { currentPassword, newPassword }),
  refreshToken: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }),
};

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string; orgId: string }) =>
    api.post<Project>('/projects', data),
  update: (id: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  stats: (id: string) => api.get<any>(`/projects/${id}/stats`),
};

export interface Execution {
  id: string;
  projectId: string;
  testId?: string;
  status: string;
  triggeredBy: string;
  duration?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export const testsApi = {
  list: (projectId: string, params?: { status?: string; search?: string }) =>
    api.get<Test[]>(`/tests`, { projectId, ...params } as Record<string, string>),
  get: (projectId: string, testId: string) =>
    api.get<Test>(`/tests/${testId}`),
  create: (projectId: string, data: { name: string; description?: string; steps?: any[]; platform?: string }) =>
    api.post<Test>(`/tests`, { projectId, steps: data.steps || [], ...data }),
  update: (projectId: string, testId: string, data: Partial<Test>) =>
    api.patch<Test>(`/tests/${testId}`, data),
  delete: (projectId: string, testId: string) =>
    api.delete(`/tests/${testId}`),
  run: (projectId: string, testId: string) =>
    api.post<Execution>(`/tests/${testId}/run`),
  duplicate: (projectId: string, testId: string) =>
    api.post<Test>(`/tests/${testId}/duplicate`),
  history: (testId: string, params?: { page?: string; limit?: string }) =>
    api.get<Execution[]>(`/tests/${testId}/history`, params),
  parse: (script: string) =>
    api.post<{ steps: any[] }>(`/tests/parse`, { script }),
};

export const visualApi = {
  list: (projectId: string, params?: { status?: string }) =>
    api.get<VisualComparison[]>(`/comparisons`, { projectId, ...params } as Record<string, string>),
  get: (projectId: string, comparisonId: string) =>
    api.get<VisualComparison>(`/comparisons/${comparisonId}`),
  approve: (projectId: string, comparisonId: string, data?: { updateBaseline?: boolean }) =>
    api.post<VisualComparison>(`/comparisons/${comparisonId}/approve`, data),
  reject: (projectId: string, comparisonId: string, comment: string = '') =>
    api.post<VisualComparison>(`/comparisons/${comparisonId}/reject`, { comment }),
  bulkApprove: (projectId: string, comparisonIds: string[]) =>
    api.post<any>(`/comparisons/bulk-approve`, { ids: comparisonIds }),
};

export const flakyApi = {
  list: (projectId: string) =>
    api.get<FlakyTest[]>('/flaky', { projectId }),
  stats: (projectId: string) =>
    api.get<any>('/flaky/stats', { projectId }),
  get: (testId: string) =>
    api.get<FlakyTest>(`/flaky/${testId}`),
  history: (testId: string) =>
    api.get<any>(`/flaky/${testId}/history`),
  quarantine: (testId: string) =>
    api.post(`/flaky/${testId}/quarantine`),
  unquarantine: (testId: string) =>
    api.post(`/flaky/${testId}/release`),
};

export const masksApi = {
  list: (projectId: string, params?: { testId?: string; baselineId?: string }) =>
    api.get<Mask[]>('/masks', { projectId, ...params } as Record<string, string>),
  get: (maskId: string) =>
    api.get<Mask>(`/masks/${maskId}`),
  create: (data: { projectId: string; testId?: string; baselineId?: string; type: string; value: any; reason?: string; isGlobal?: boolean }) =>
    api.post<Mask>('/masks', data),
  update: (maskId: string, data: Partial<{ type: string; value: any; reason: string; isActive: boolean }>) =>
    api.patch<Mask>(`/masks/${maskId}`, data),
  delete: (maskId: string) =>
    api.delete(`/masks/${maskId}`),
  aiDetect: (data: { projectId: string; screenshotUrl: string }) =>
    api.post<Mask[]>('/masks/ai-detect', data),
  apply: (data: { comparisonId: string; maskIds: string[] }) =>
    api.post<any>('/masks/apply', data),
};

export const dashboardApi = {
  stats: (projectId: string) =>
    api.get<DashboardStats>('/dashboard/stats', { projectId }),
};

export interface VideoData {
  id: string;
  executionId: string;
  url: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  format: string;
  createdAt: string;
}

export const videosApi = {
  list: (executionId: string) =>
    api.get<VideoData[]>(`/videos/${executionId}`),
};

export const devicesApi = {
  list: (params?: { projectId?: string; platform?: string }) =>
    api.get<DeviceProfile[]>('/devices', params as Record<string, string>),
  get: (id: string) => api.get<DeviceProfile>(`/devices/${id}`),
  create: (data: Omit<DeviceProfile, 'id' | 'createdAt' | 'isBuiltIn'>) =>
    api.post<DeviceProfile>('/devices', data),
  update: (id: string, data: Partial<DeviceProfile>) =>
    api.put<DeviceProfile>(`/devices/${id}`, data),
  delete: (id: string) => api.delete(`/devices/${id}`),
  available: () => api.get<any[]>('/devices/available'),
};

// =============================================================================
// TEAMS
// =============================================================================

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  members: TeamMember[];
  _count?: {
    projects: number;
  };
}

export interface TeamMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
  userId: string;
  teamId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export const teamsApi = {
  list: (orgId: string) => api.get<Team[]>('/teams', { orgId }),
  get: (id: string) => api.get<Team>(`/teams/${id}`),
  create: (data: { name: string; orgId: string }) =>
    api.post<Team>('/teams', data),
  update: (id: string, data: Partial<Pick<Team, 'name'>>) =>
    api.put<Team>(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMember: (teamId: string, data: { userId: string; role?: string }) =>
    api.post<TeamMember>(`/teams/${teamId}/members`, data),
  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
  updateMember: (teamId: string, userId: string, data: { role: string }) =>
    api.patch<TeamMember>(`/teams/${teamId}/members/${userId}`, data),
};

// =============================================================================
// WEBHOOKS
// =============================================================================

export type WebhookEvent =
  | 'TEST_PASSED'
  | 'TEST_FAILED'
  | 'BASELINE_UPDATED'
  | 'SCHEDULE_COMPLETED'
  | 'FLAKY_DETECTED';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string | null;
  events: WebhookEvent[];
  isActive: boolean;
  lastTriggered?: string | null;
  failureCount: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: string;
  statusCode?: number | null;
  response?: string | null;
  success: boolean;
  createdAt: string;
}

export const webhooksApi = {
  list: (projectId: string) =>
    api.get<Webhook[]>('/webhooks', { projectId }),
  get: (id: string) => api.get<Webhook & { deliveries?: WebhookDelivery[] }>(`/webhooks/${id}`),
  create: (data: { name: string; url: string; events: string[]; projectId: string }) =>
    api.post<Webhook>('/webhooks', data),
  update: (id: string, data: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'isActive'>>) =>
    api.put<Webhook>(`/webhooks/${id}`, data),
  delete: (id: string) => api.delete(`/webhooks/${id}`),
  test: (id: string) => api.post<WebhookDelivery>(`/webhooks/${id}/test`),
  // Deliveries are embedded in GET /webhooks/:id response, not a separate endpoint
  deliveries: async (webhookId: string): Promise<WebhookDelivery[]> => {
    const webhook = await api.get<Webhook & { deliveries?: WebhookDelivery[] }>(`/webhooks/${webhookId}`);
    return webhook.deliveries || [];
  },
};

// =============================================================================
// WORKFLOWS
// =============================================================================

export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  parameters?: unknown;
  projectId: string;
  createdById: string;
  createdBy?: { name: string | null; email: string };
  steps: WorkflowStep[];
  _count?: { tests: number };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id?: string;
  workflowId?: string;
  blockId: string;
  block?: TaskBlock;
  order: number;
  config?: Record<string, unknown> | null;
  createdAt?: string;
}

export const workflowsApi = {
  list: (projectId: string) =>
    api.get<Workflow[]>('/workflows', { projectId }),
  get: (id: string) => api.get<Workflow>(`/workflows/${id}`),
  create: (data: { name: string; description?: string; projectId: string }) =>
    api.post<Workflow>('/workflows', data),
  update: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.put<Workflow>(`/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  // Step management (separate sub-resource)
  addStep: (workflowId: string, data: { blockId: string; order: number; config?: any }) =>
    api.post<WorkflowStep>(`/workflows/${workflowId}/steps`, data),
  updateStep: (workflowId: string, stepId: string, data: { blockId?: string; order?: number; config?: any }) =>
    api.put<WorkflowStep>(`/workflows/${workflowId}/steps/${stepId}`, data),
  deleteStep: (workflowId: string, stepId: string) =>
    api.delete(`/workflows/${workflowId}/steps/${stepId}`),
  run: (workflowId: string) =>
    api.post<{ executionId: string; workflowId: string; status: string }>(`/workflows/${workflowId}/run`),
  // Export workflow as JSON (client-side only)
  exportJson: async (workflowId: string): Promise<string> => {
    const workflow = await api.get<Workflow>(`/workflows/${workflowId}`);
    return JSON.stringify(workflow, null, 2);
  },
};

// =============================================================================
// TASK BLOCKS
// =============================================================================

export interface TaskBlock {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  config?: Record<string, unknown> | null;
  isTemplate: boolean;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const blocksApi = {
  list: (projectId: string) =>
    api.get<TaskBlock[]>('/blocks', { projectId }),
  // Note: no GET /blocks/:id endpoint exists on the backend
  create: (data: {
    name: string;
    description?: string;
    type: string;
    config?: Record<string, unknown>;
    isTemplate?: boolean;
    projectId: string;
  }) => api.post<TaskBlock>('/blocks', data),
  update: (id: string, data: { name?: string; description?: string; type?: string; config?: Record<string, unknown>; isTemplate?: boolean }) =>
    api.put<TaskBlock>(`/blocks/${id}`, data),
  delete: (id: string) => api.delete(`/blocks/${id}`),
};

// =============================================================================
// API KEYS (Extended)
// =============================================================================

export interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  usageCount?: number;
  expiresAt?: string | null;
  isActive: boolean;
  revokedAt?: string | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  createdAt: string;
}

export const apiKeysApi = {
  list: () =>
    api.get<ApiKeyData[]>('/auth/api-keys'),
  create: (data: { name: string; scopes?: string[]; expiresAt?: string }) =>
    api.post<ApiKeyData & { key: string; rawKey?: string }>('/auth/api-keys', data),
  revoke: (id: string) => api.delete(`/auth/api-keys/${id}`),
};

// =============================================================================
// ANALYTICS
// =============================================================================

export interface AnalyticsData {
  summary: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    passRate: number;
    avgDiff: number;
    flakyTests: number;
    projectCount: number;
  };
  trends: Array<{
    date: string;
    passed: number;
    failed: number;
    total: number;
  }>;
  topFailingTests: Array<{
    test: { id: string; name: string; projectName: string };
    failures: number;
  }>;
  environmentStats: Array<{ environment: string; count: number }>;
  branchStats: Array<{ branch: string; count: number }>;
  recentActivity: Array<{
    id: string;
    testName: string;
    projectName: string;
    status: string;
    createdAt: string;
  }>;
}

export const analyticsApi = {
  get: async (params?: { projectId?: string; days?: string }): Promise<AnalyticsData> => {
    // Map frontend 'days' to API 'period' format (e.g., '30' -> '30d')
    const queryParams: Record<string, string> = {};
    if (params?.projectId) queryParams.projectId = params.projectId;
    if (params?.days) queryParams.period = `${params.days}d`;

    const raw = await api.get<any>('/dashboard/analytics', queryParams);

    // Map API response shape to frontend AnalyticsData interface
    return {
      summary: {
        totalRuns: raw.summary?.totalExecutions || 0,
        passedRuns: raw.summary?.totalPassed || 0,
        failedRuns: raw.summary?.totalFailed || 0,
        passRate: raw.summary?.overallPassRate || 0,
        avgDiff: 0,
        flakyTests: (raw.flaky?.quarantined || 0) + (raw.flaky?.warning || 0) + (raw.flaky?.watching || 0),
        projectCount: 1,
      },
      trends: (raw.trend || []).map((d: any) => ({
        date: d.date,
        passed: d.passed,
        failed: d.failed,
        total: d.total,
      })),
      topFailingTests: raw.topFailingTests || [],
      environmentStats: raw.environmentStats || [],
      branchStats: raw.branchStats || [],
      recentActivity: raw.recentActivity || [],
    };
  },
};

// =============================================================================
// SCHEDULES
// =============================================================================

export interface Schedule {
  id: string;
  projectId: string;
  suiteId?: string | null;
  name: string;
  cron: string;
  timezone: string;
  config?: Record<string, any> | null;
  isActive: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const schedulesApi = {
  list: (projectId: string) =>
    api.get<Schedule[]>('/schedules', { projectId }),
  get: (id: string) => api.get<Schedule>(`/schedules/${id}`),
  create: (data: { projectId: string; name: string; cron: string; timezone: string; suiteId?: string; config?: Record<string, any> }) =>
    api.post<Schedule>('/schedules', data),
  update: (id: string, data: Partial<Pick<Schedule, 'name' | 'cron' | 'timezone' | 'config' | 'suiteId'>>) =>
    api.patch<Schedule>(`/schedules/${id}`, data),
  delete: (id: string) => api.delete(`/schedules/${id}`),
  run: (id: string) => api.post<any>(`/schedules/${id}/run`),
  toggle: (id: string) => api.post<Schedule>(`/schedules/${id}/toggle`),
};

// =============================================================================
// APPROVALS
// =============================================================================

export interface ApprovalRequest {
  id: string;
  comparisonId: string;
  changeType?: string;
  severity?: string;
  confidence?: number;
  assignedTo?: string;
  status: string;
  approvedBy?: string;
  comment?: string;
  escalations: number;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  comparison?: VisualComparison;
}

export interface ApprovalRule {
  id: string;
  projectId: string;
  name: string;
  priority: number;
  conditions: Record<string, any>;
  routeTo: string;
  routeType: string;
  autoApprove: boolean;
  isActive: boolean;
  createdAt: string;
}

export const approvalsApi = {
  pending: (projectId: string) =>
    api.get<ApprovalRequest[]>('/approvals/pending', { projectId }),
  stats: (projectId: string) =>
    api.get<any>('/approvals/stats', { projectId }),
  approve: (id: string) =>
    api.post<ApprovalRequest>(`/approvals/${id}/approve`),
  reject: (id: string, comment?: string) =>
    api.post<ApprovalRequest>(`/approvals/${id}/reject`, { comment }),
  delegate: (id: string, assignTo: string) =>
    api.post<ApprovalRequest>(`/approvals/${id}/delegate`, { assignTo }),
  rules: (projectId: string) =>
    api.get<ApprovalRule[]>('/approvals/rules', { projectId }),
  createRule: (data: { projectId: string; name: string; priority: number; conditions: Record<string, any>; routeTo: string; routeType: string; autoApprove?: boolean }) =>
    api.post<ApprovalRule>('/approvals/rules', data),
  deleteRule: (ruleId: string) =>
    api.delete(`/approvals/rules/${ruleId}`),
};

// =============================================================================
// EXECUTIONS (Extended)
// =============================================================================

export const executionsApi = {
  list: (projectId: string, params?: { status?: string; testId?: string; page?: string; limit?: string }) =>
    api.get<Execution[]>('/executions', { projectId, ...params } as Record<string, string>),
  get: (executionId: string) =>
    api.get<any>(`/executions/${executionId}`),
  create: (data: { projectId: string; testId?: string; suiteId?: string; config?: any }) =>
    api.post<Execution>('/executions', data),
  stop: (executionId: string) =>
    api.post<any>(`/executions/${executionId}/stop`),
  rerun: (executionId: string) =>
    api.post<Execution>(`/executions/${executionId}/rerun`),
  replay: (executionId: string, checkpointId: string) =>
    api.post<Execution>(`/executions/${executionId}/replay`, { checkpointId }),
  compare: (executionId: string) =>
    api.post<any>(`/executions/${executionId}/compare`),
  checkpoints: (executionId: string) =>
    api.get<any[]>(`/executions/${executionId}/checkpoints`),
  logs: (executionId: string) =>
    api.get<any>(`/executions/${executionId}/logs`),
  artifacts: (executionId: string) =>
    api.get<any>(`/executions/${executionId}/artifacts`),
};

// =============================================================================
// BASELINES
// =============================================================================

export const baselinesApi = {
  list: (projectId: string) =>
    api.get<any[]>('/baselines', { projectId }),
  get: (id: string) => api.get<any>(`/baselines/${id}`),
  create: (data: { projectId: string; name: string; branch?: string; type?: string; screenshots?: any[] }) =>
    api.post<any>('/baselines', data),
  update: (id: string, data: any) =>
    api.put<any>(`/baselines/${id}`, data),
  delete: (id: string) => api.delete(`/baselines/${id}`),
  branch: (branch: string, projectId: string) =>
    api.get<any>(`/baselines/branch/${branch}`, { projectId }),
  promote: (data: { baselineId: string; targetBranch: string; projectId: string }) =>
    api.post<any>('/baselines/promote', data),
  /**
   * Promote an execution's screenshots into a baseline in one call.
   * `replace` defaults to true — repeated clicks replace the image set
   * so rotating a design is a single button press.
   */
  fromExecution: (
    executionId: string,
    data: { name?: string; branch?: string; replace?: boolean } = {},
  ) => api.post<any>(`/baselines/from-execution/${executionId}`, data),
};

// =============================================================================
// ORGANIZATIONS
// =============================================================================

export const organizationsApi = {
  list: () => api.get<any[]>('/organizations'),
  get: (id: string) => api.get<any>(`/organizations/${id}`),
  create: (data: { name: string }) =>
    api.post<any>('/organizations', data),
  update: (id: string, data: { name?: string; settings?: any }) =>
    api.patch<any>(`/organizations/${id}`, data),
  members: (orgId: string) =>
    api.get<any[]>(`/organizations/${orgId}/members`),
  addMember: (orgId: string, data: { email: string; role: string }) =>
    api.post<any>(`/organizations/${orgId}/members`, data),
  removeMember: (orgId: string, memberId: string) =>
    api.delete(`/organizations/${orgId}/members/${memberId}`),
  auditLog: (orgId: string, params?: { page?: string; limit?: string }) =>
    api.get<any>(`/organizations/${orgId}/audit-log`, params as Record<string, string>),
};

// =============================================================================
// REPORTS
// =============================================================================

export const reportsApi = {
  get: (projectId: string, params?: { type?: string }) =>
    api.get<any>('/reports', { projectId, ...params } as Record<string, string>),
};

// =============================================================================
// SMART SELECT
// =============================================================================

export const smartSelectApi = {
  run: (data: { projectId: string; changedFiles?: string[]; repoPath?: string }) =>
    api.post<any>('/smart-select', data),
  mapping: (projectId: string) =>
    api.get<any>('/smart-select/mapping', { projectId }),
  stats: (projectId: string) =>
    api.get<any>('/smart-select/stats', { projectId }),
};

// =============================================================================
// FEATURES (scenario grouping)
// =============================================================================

export interface Feature {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  sharedSetup: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tests: number };
  tests?: Array<{ id: string; name: string; status: string; goal: string | null }>;
}

export const featuresApi = {
  list: (projectId: string) =>
    api.get<{ features: Feature[] }>('/features', { projectId }).then((r) => r.features),
  get: (id: string) => api.get<Feature>(`/features/${id}`),
  create: (data: { projectId: string; name: string; description?: string; sharedSetup?: string }) =>
    api.post<Feature>('/features', data),
  update: (id: string, data: { name?: string; description?: string | null; sharedSetup?: string | null }) =>
    api.patch<Feature>(`/features/${id}`, data),
  delete: (id: string) => api.delete(`/features/${id}`),
};

// =============================================================================
// CREDENTIALS (encrypted blobs, env-scoped)
// =============================================================================

export interface Credential {
  id: string;
  orgId: string;
  projectId: string | null;
  key: string;
  environment: string | null;
  allowEnvironmentFallback: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const credentialsApi = {
  list: (orgId: string, projectId?: string) =>
    api.get<{ credentials: Credential[] }>('/credentials', {
      orgId,
      ...(projectId ? { projectId } : {}),
    }).then((r) => r.credentials),
  create: (data: {
    orgId: string;
    projectId?: string;
    key: string;
    environment?: string;
    blob: Record<string, string>;
    allowEnvironmentFallback?: boolean;
  }) => api.post<Credential>('/credentials', data),
  rotate: (id: string, data: { blob?: Record<string, string>; allowEnvironmentFallback?: boolean }) =>
    api.patch<Credential>(`/credentials/${id}`, data),
  delete: (id: string) => api.delete(`/credentials/${id}`),
};

// =============================================================================
// TEMPLATES (story scaffolds)
// =============================================================================

export interface Template {
  slug: string;
  title: string;
  description: string;
  storyText: string;
  goalText: string | null;
  source: string;
  usageCount: number;
}

export const templatesApi = {
  list: () => api.get<{ templates: Template[] }>('/templates').then((r) => r.templates),
  pick: (slug: string, projectId?: string) =>
    api.post(`/templates/${slug}/pick`, projectId ? { projectId } : {}),
};

// Export auth token getter for SSE connections
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

// Export API base URL for SSE connections
export function getApiBaseUrl(): string {
  return API_BASE;
}
