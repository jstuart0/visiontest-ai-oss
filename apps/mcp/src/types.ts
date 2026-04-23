export interface VisionTestEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  } | string;
}

export interface VisionTestConfig {
  baseUrl: string;
  bearerToken?: string;
  apiKey?: string;
}

export interface ListTestsInput {
  project_id: string;
  status?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface ParseStoryInput {
  project_id: string;
  story: string;
  goal?: string;
  start_url?: string;
  story_format?: 'natural' | 'yaml' | 'json';
}

export interface CreateTestFromStoryInput extends ParseStoryInput {
  name: string;
  description?: string;
  suite_id?: string;
  feature_id?: string;
  tags?: string[];
  environment?: string;
  credential_ref?: string;
}

export interface RunTestInput {
  project_id: string;
  test_id: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  base_url?: string;
  device_profile_id?: string;
}

export interface RunSuiteInput {
  project_id: string;
  suite_id: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  base_url?: string;
  device_profile_id?: string;
}

export interface StartSmokeExploreInput {
  start_url: string;
  project_id?: string;
  session_mode?: 'auto' | 'anonymous' | 'project';
}

export interface StartProjectScanInput {
  project_id: string;
  start_url: string;
  max_pages?: number;
  max_clicks_per_page?: number;
  login_steps?: unknown[];
  safety?: {
    mode?: 'read-only' | 'allow-destructive' | 'sandbox';
    destructivePhrases?: string[];
    allowedSelectors?: string[];
    blockedSelectors?: string[];
    allowFormSubmit?: boolean;
    stubNetworkWrites?: boolean;
    resetHookUrl?: string | null;
  };
}
