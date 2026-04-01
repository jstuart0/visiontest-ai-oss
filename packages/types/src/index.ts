// VisionTest.ai - Shared Types
// Hospital-Grade Visual Regression Testing Platform

// =============================================================================
// API TYPES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserPublic;
  token: string;
  expiresAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface ApiKeyCreate {
  name: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  key?: string; // Only returned on creation
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

// =============================================================================
// ORGANIZATION TYPES
// =============================================================================

export interface OrganizationCreate {
  name: string;
  slug?: string;
}

export interface OrganizationUpdate {
  name?: string;
  logo?: string;
  settings?: Record<string, unknown>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  projectCount?: number;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  user: UserPublic;
  createdAt: string;
}

// =============================================================================
// PROJECT TYPES
// =============================================================================

export interface ProjectCreate {
  name: string;
  slug?: string;
  description?: string;
  repoUrl?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  repoUrl?: string;
  settings?: ProjectSettings;
}

export interface ProjectSettings {
  defaultBrowser?: 'chromium' | 'firefox' | 'webkit';
  defaultViewport?: { width: number; height: number };
  screenshotOnFailure?: boolean;
  videoOnFailure?: boolean;
  flakyThreshold?: number;
  ciBlockQuarantined?: boolean;
  notifications?: {
    slack?: string;
    email?: string[];
  };
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  repoUrl: string | null;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
  testCount?: number;
  suiteCount?: number;
  baselineCount?: number;
}

// =============================================================================
// TEST TYPES
// =============================================================================

export interface TestCreate {
  name: string;
  description?: string;
  suiteId?: string;
  steps: TestStep[];
  tags?: string[];
  config?: TestConfig;
}

export interface TestUpdate {
  name?: string;
  description?: string;
  suiteId?: string | null;
  steps?: TestStep[];
  tags?: string[];
  config?: TestConfig;
  status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
}

export interface TestConfig {
  timeout?: number;
  retries?: number;
  browser?: 'chromium' | 'firefox' | 'webkit';
  viewport?: { width: number; height: number };
  baseUrl?: string;
  env?: Record<string, string>;
}

export interface TestStep {
  type: TestStepType;
  selector?: string;
  value?: string;
  url?: string;
  name?: string;
  assertion?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

export type TestStepType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'clear'
  | 'select'
  | 'hover'
  | 'scroll'
  | 'waitFor'
  | 'assert'
  | 'screenshot'
  | 'ai'
  | 'loop'
  | 'condition';

export interface Test {
  id: string;
  projectId: string;
  suiteId: string | null;
  name: string;
  description: string | null;
  steps: TestStep[];
  config: TestConfig;
  tags: string[];
  status: 'ACTIVE' | 'DISABLED' | 'QUARANTINED' | 'ARCHIVED';
  coveredFiles: string[];
  createdAt: string;
  updatedAt: string;
  suite?: TestSuite;
  flakyData?: FlakyTestData;
}

// =============================================================================
// TEST SUITE TYPES
// =============================================================================

export interface TestSuiteCreate {
  name: string;
  description?: string;
  tags?: string[];
  order?: number;
}

export interface TestSuiteUpdate {
  name?: string;
  description?: string;
  tags?: string[];
  config?: Record<string, unknown>;
  order?: number;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  tags: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  testCount?: number;
}

// =============================================================================
// EXECUTION TYPES
// =============================================================================

export interface ExecutionCreate {
  testId?: string;
  suiteId?: string;
  testIds?: string[];
  config?: ExecutionConfig;
  metadata?: Record<string, unknown>;
}

export interface ExecutionConfig {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  baseUrl?: string;
  env?: Record<string, string>;
  retries?: number;
  timeout?: number;
  parallel?: number;
}

export interface Execution {
  id: string;
  projectId: string;
  testId: string | null;
  suiteId: string | null;
  status: ExecutionStatus;
  triggeredBy: 'MANUAL' | 'SCHEDULE' | 'CI' | 'API' | 'WEBHOOK';
  triggerRef: string | null;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  result: ExecutionResult | null;
  artifacts: ExecutionArtifacts | null;
  healingLog: HealingEvent[] | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type ExecutionStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'SKIPPED';

export interface ExecutionResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  steps: StepResult[];
}

export interface StepResult {
  index: number;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface ExecutionArtifacts {
  screenshots: string[];
  videos?: string[];
  logs?: string[];
  har?: string;
}

export interface HealingEvent {
  timestamp: string;
  stepIndex: number;
  originalSelector: string;
  healedSelector: string;
  strategy: string;
  confidence: number;
}

// =============================================================================
// VISUAL REGRESSION TYPES
// =============================================================================

export interface BaselineCreate {
  name: string;
  branch?: string;
  screenshots: BaselineScreenshot[];
}

export interface BaselineScreenshot {
  name: string;
  url: string;
  width: number;
  height: number;
  deviceType?: string;
}

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  type: 'PROJECT' | 'BRANCH' | 'ENVIRONMENT' | 'DYNAMIC';
  screenshots: BaselineScreenshot[];
  createdAt: string;
  updatedAt: string;
}

export interface Comparison {
  id: string;
  executionId: string;
  baselineId: string;
  screenshotId: string | null;
  diffScore: number;
  diffUrl: string | null;
  status: ComparisonStatus;
  changes: VisualChange[] | null;
  masksApplied: number;
  createdAt: string;
  resolvedAt: string | null;
  approval?: ApprovalRequest;
}

export type ComparisonStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED'
  | 'ESCALATED';

export interface VisualChange {
  type: 'color' | 'layout' | 'content' | 'missing' | 'added';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  bounds?: { x: number; y: number; width: number; height: number };
  confidence: number;
}

// =============================================================================
// IGNORE MASK TYPES (P0 Feature)
// =============================================================================

export interface IgnoreMaskCreate {
  type: MaskType;
  value: string | Rectangle;
  reason?: string;
  testId?: string;
  baselineId?: string;
  isGlobal?: boolean;
}

export interface IgnoreMaskUpdate {
  type?: MaskType;
  value?: string | Rectangle;
  reason?: string;
  isActive?: boolean;
}

export type MaskType = 'RECTANGLE' | 'SELECTOR' | 'XPATH' | 'REGEX' | 'AI_DETECTED';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IgnoreMask {
  id: string;
  projectId: string | null;
  testId: string | null;
  baselineId: string | null;
  type: MaskType;
  value: string;
  reason: string | null;
  isGlobal: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIDetectedMask {
  type: MaskType;
  value: string | Rectangle;
  reason: string;
  confidence: number;
  category: 'timestamp' | 'counter' | 'avatar' | 'ad' | 'animation' | 'other';
}

// =============================================================================
// FLAKY TEST TYPES (P1 Feature)
// =============================================================================

export interface FlakyTestData {
  id: string;
  testId: string;
  flakinessScore: number;
  status: FlakyStatus;
  runHistory: FlakyRunRecord[];
  quarantinedAt: string | null;
  stabilizedAt: string | null;
  autoFixAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export type FlakyStatus = 'WATCHING' | 'WARNING' | 'QUARANTINED' | 'STABLE' | 'INVESTIGATING';

export interface FlakyRunRecord {
  timestamp: number;
  passed: boolean;
  duration: number;
  executionId?: string;
}

export interface FlakyStats {
  quarantined: number;
  warning: number;
  watching: number;
  stabilized: number;
  timeSaved: number; // minutes
}

// =============================================================================
// SMART SELECTION TYPES (P1 Feature)
// =============================================================================

export interface SmartSelectionRequest {
  baseRef: string;
  headRef: string;
  repoUrl?: string;
}

export interface SmartSelectionResponse {
  changedFiles: string[];
  affectedTests: AffectedTest[];
  stats: {
    totalTests: number;
    selectedTests: number;
    reduction: number; // percentage
    estimatedTime: number; // seconds
  };
}

export interface AffectedTest {
  id: string;
  name: string;
  tags: string[];
  impactedBy: string[];
}

// =============================================================================
// APPROVAL DELEGATION TYPES (P2 Feature)
// =============================================================================

export interface ApprovalRequest {
  id: string;
  comparisonId: string;
  changeType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  assignedTo: string | null;
  status: ApprovalStatus;
  approvedBy: string | null;
  comment: string | null;
  escalations: number;
  createdAt: string;
  resolvedAt: string | null;
  dueAt: string | null;
}

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'AUTO_APPROVED'
  | 'EXPIRED';

export interface ApprovalRuleCreate {
  name: string;
  priority?: number;
  conditions: ApprovalConditions;
  routeTo: string;
  routeType: 'user' | 'team' | 'slack' | 'email';
  autoApprove?: boolean;
}

export interface ApprovalConditions {
  changeType?: string[];
  severity?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
  component?: string[];
  confidence?: { min?: number; max?: number };
}

// =============================================================================
// REPLAY TYPES (P3 Feature)
// =============================================================================

export interface Checkpoint {
  id: string;
  executionId: string;
  stepNumber: number;
  url: string;
  screenshotUrl: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface ReplayRequest {
  checkpointId?: string;
  stepNumber?: number;
  updatedSteps?: TestStep[];
}

// =============================================================================
// SCHEDULE TYPES
// =============================================================================

export interface ScheduleCreate {
  name: string;
  suiteId?: string;
  cron: string;
  timezone?: string;
  config?: ScheduleConfig;
}

export interface ScheduleConfig {
  platforms?: ('chromium' | 'firefox' | 'webkit')[];
  environments?: string[];
  notifications?: {
    slack?: string;
    email?: string[];
  };
  failureThreshold?: number;
}

export interface Schedule {
  id: string;
  projectId: string;
  suiteId: string | null;
  name: string;
  cron: string;
  timezone: string;
  config: ScheduleConfig;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// WEBSOCKET EVENTS
// =============================================================================

export interface WSExecutionStarted {
  event: 'execution:started';
  data: {
    executionId: string;
    testId?: string;
    suiteId?: string;
  };
}

export interface WSExecutionProgress {
  event: 'execution:progress';
  data: {
    executionId: string;
    stepIndex: number;
    stepName: string;
    status: 'running' | 'passed' | 'failed';
    duration?: number;
  };
}

export interface WSExecutionScreenshot {
  event: 'execution:screenshot';
  data: {
    executionId: string;
    stepIndex: number;
    url: string;
  };
}

export interface WSExecutionHealing {
  event: 'execution:healing';
  data: HealingEvent & { executionId: string };
}

export interface WSExecutionCompleted {
  event: 'execution:completed';
  data: {
    executionId: string;
    status: ExecutionStatus;
    result: ExecutionResult;
  };
}

export type WSEvent =
  | WSExecutionStarted
  | WSExecutionProgress
  | WSExecutionScreenshot
  | WSExecutionHealing
  | WSExecutionCompleted;

// =============================================================================
// AUTONOMOUS BUG FIXING TYPES
// =============================================================================

// --- Repository Connection ---

export type RepoProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'LOCAL';
export type RepoType = 'SINGLE' | 'MONOREPO' | 'SERVICE';

export interface RepositoryConnectionCreate {
  provider: RepoProvider;
  repoUrl: string;
  defaultBranch?: string;
  authMode?: string;
  token?: string;
  repoType?: RepoType;
  defaultPath?: string;
  cloneStrategy?: string;
  allowedPaths?: string[];
  blockedPaths?: string[];
}

export interface RepositoryConnectionUpdate {
  defaultBranch?: string;
  authMode?: string;
  token?: string;
  repoType?: RepoType;
  defaultPath?: string;
  cloneStrategy?: string;
  allowedPaths?: string[];
  blockedPaths?: string[];
  isActive?: boolean;
}

export interface RepositoryConnection {
  id: string;
  projectId: string;
  provider: RepoProvider;
  repoUrl: string;
  defaultBranch: string;
  authMode: string;
  repoType: RepoType;
  defaultPath: string | null;
  cloneStrategy: string;
  allowedPaths: string[];
  blockedPaths: string[];
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Bug Candidate ---

export type BugCandidateStatus =
  | 'NEW'
  | 'TRIAGING'
  | 'INVESTIGATING'
  | 'AWAITING_APPROVAL'
  | 'APPLYING'
  | 'VERIFYING'
  | 'READY'
  | 'MERGED'
  | 'DISMISSED';

export type FailureType =
  | 'VISUAL'
  | 'RUNTIME'
  | 'ASSERTION'
  | 'PERFORMANCE'
  | 'MOBILE'
  | 'API'
  | 'UNKNOWN';

export type BugClassification =
  | 'PRODUCT_BUG'
  | 'TEST_ISSUE'
  | 'ENVIRONMENT_ISSUE'
  | 'EXPECTED_CHANGE'
  | 'UNCLASSIFIED';

export type CreatedByMode = 'USER' | 'RULE' | 'CI' | 'AUTO';

export interface BugCandidateCreate {
  testId?: string;
  executionId?: string;
  comparisonId?: string;
  repoConnectionId?: string;
  sourceType?: string;
  title: string;
  plainLanguageSummary?: string;
  failureType?: FailureType;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  branch?: string;
  commitSha?: string;
  classification?: BugClassification;
}

export interface BugCandidateUpdate {
  title?: string;
  plainLanguageSummary?: string;
  failureType?: FailureType;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: BugCandidateStatus;
  classification?: BugClassification;
  assignedTo?: string;
}

export interface BugCandidate {
  id: string;
  projectId: string;
  testId: string | null;
  executionId: string | null;
  comparisonId: string | null;
  repoConnectionId: string | null;
  sourceType: string;
  title: string;
  plainLanguageSummary: string | null;
  failureType: FailureType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidenceScore: number;
  riskScore: number;
  status: BugCandidateStatus;
  classification: BugClassification;
  branch: string | null;
  commitSha: string | null;
  evidence: Record<string, unknown> | null;
  suggestedActions: SuggestedAction[] | null;
  createdByMode: CreatedByMode;
  createdByUserId: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  fixSessions?: FixSession[];
  analyses?: InvestigationAnalysis[];
}

export interface SuggestedAction {
  id: string;
  title: string;
  description: string;
  rationale: string;
  confidence: number;
  actionFamily: 'triage' | 'expected_change' | 'contract_change' | 'code_fix';
  approvalClass: 'triage_decision' | 'expected_change' | 'contract_change' | 'code_fix';
  deliveryClass: 'none' | 'approval_only' | 'patch' | 'branch' | 'pr';
  nextStep: string;
}

// --- Fix Session ---

export type FixSessionStatus =
  | 'PENDING'
  | 'INVESTIGATING'
  | 'PLANNING'
  | 'PATCHING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'AWAITING_APPROVAL';

export type FixSessionMode =
  | 'INVESTIGATE_ONLY'
  | 'SUGGEST_PATCH'
  | 'APPLY_PATCH'
  | 'OPEN_PR';

export interface FixSessionCreate {
  bugCandidateId: string;
  mode?: FixSessionMode;
  strategy?: string;
}

export interface FixSession {
  id: string;
  bugCandidateId: string;
  mode: FixSessionMode;
  strategy: string | null;
  agentModel: string | null;
  status: FixSessionStatus;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  plainLanguageSummary: string | null;
  technicalSummary: string | null;
  confidenceScore: number | null;
  riskScore: number | null;
  patchDiff: string | null;
  patchFiles: PatchFile[] | null;
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  verificationOutcome: string | null;
  rootCauseHypothesis: string | null;
  impactedFiles: ImpactedFile[] | null;
  eventLog: FixSessionEvent[] | null;
  createdAt: string;
  updatedAt: string;
  artifacts?: FixArtifact[];
  verificationRuns?: VerificationRun[];
}

export interface PatchFile {
  path: string;
  action: 'modified' | 'added' | 'deleted';
  linesAdded: number;
  linesRemoved: number;
}

export interface ImpactedFile {
  path: string;
  reason: string;
  confidence: number;
}

export interface FixSessionEvent {
  timestamp: string;
  phase: string;
  message: string;
  detail?: string;
}

// --- Fix Artifact ---

export type FixArtifactType =
  | 'ROOT_CAUSE_REPORT'
  | 'PATCH_DIFF'
  | 'TEST_RERUN_REPORT'
  | 'SCREENSHOT_BEFORE'
  | 'SCREENSHOT_AFTER'
  | 'LOG'
  | 'PR_URL'
  | 'BRANCH_NAME'
  | 'EVIDENCE_BUNDLE'
  | 'VERIFICATION_REPORT';

export interface FixArtifact {
  id: string;
  fixSessionId: string;
  type: FixArtifactType;
  name: string;
  content: string | null;
  storageUrl: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

// --- Verification ---

export type VerificationRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'PARTIAL'
  | 'SKIPPED'
  | 'TIMEOUT';

export interface VerificationRun {
  id: string;
  fixSessionId: string;
  profileId: string | null;
  status: VerificationRunStatus;
  steps: VerificationStep[] | null;
  summary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  failedSteps: number;
  passedSteps: number;
  totalSteps: number;
  createdAt: string;
}

export interface VerificationStep {
  name: string;
  command: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  output?: string;
  duration?: number;
}

export interface VerificationProfileCreate {
  name: string;
  description?: string;
  preset?: string;
  commands: VerificationCommand[];
  targetingStrategy?: string;
  maxRuntimeSeconds?: number;
  failurePolicy?: string;
  isDefault?: boolean;
}

export interface VerificationCommand {
  name: string;
  command: string;
  timeout?: number;
  required?: boolean;
}

export interface VerificationProfile {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  preset: string;
  commands: VerificationCommand[];
  targetingStrategy: string;
  maxRuntimeSeconds: number;
  failurePolicy: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Fix Policy ---

export type FixMode = 'MANUAL' | 'GUIDED' | 'SEMI_AUTO' | 'FULLY_AUTO';

export interface FixPolicyCreate {
  repoConnectionId?: string;
  name: string;
  mode?: FixMode;
  maxFilesChanged?: number;
  maxLinesChanged?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
  allowDependencyChanges?: boolean;
  allowLockfileChanges?: boolean;
  allowMigrationChanges?: boolean;
  requireHumanApproval?: boolean;
  branchPrefix?: string;
  prTemplate?: string;
  isDefault?: boolean;
}

export interface FixPolicyUpdate {
  name?: string;
  mode?: FixMode;
  maxFilesChanged?: number;
  maxLinesChanged?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
  allowDependencyChanges?: boolean;
  allowLockfileChanges?: boolean;
  allowMigrationChanges?: boolean;
  requireHumanApproval?: boolean;
  branchPrefix?: string;
  prTemplate?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface FixPolicy {
  id: string;
  projectId: string;
  repoConnectionId: string | null;
  name: string;
  mode: FixMode;
  maxFilesChanged: number;
  maxLinesChanged: number;
  allowedPaths: string[];
  blockedPaths: string[];
  allowDependencyChanges: boolean;
  allowLockfileChanges: boolean;
  allowMigrationChanges: boolean;
  requireHumanApproval: boolean;
  branchPrefix: string;
  prTemplate: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Investigation Analysis ---

export type AnalysisType =
  | 'FAILURE_SUMMARY'
  | 'VISUAL_ANALYSIS'
  | 'ROOT_CAUSE_HYPOTHESIS'
  | 'SUGGESTED_ACTIONS'
  | 'CODE_CONTEXT'
  | 'PATCH_RATIONALE';

export type AnalysisStatus = 'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED';

export interface InvestigationAnalysis {
  id: string;
  bugCandidateId: string;
  fixSessionId: string | null;
  analysisType: AnalysisType;
  status: AnalysisStatus;
  summary: string | null;
  content: string | null;
  confidence: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Fix Feedback ---

export type FeedbackType =
  | 'CORRECT_FIX'
  | 'PARTIAL_FIX'
  | 'WRONG_ROOT_CAUSE'
  | 'TOO_RISKY'
  | 'TOO_BROAD'
  | 'SHOULD_BE_BASELINE_CHANGE'
  | 'SHOULD_BE_TEST_ISSUE'
  | 'OTHER';

export interface FixFeedbackCreate {
  bugCandidateId: string;
  fixSessionId?: string;
  feedbackType: FeedbackType;
  comment?: string;
}

export interface FixFeedbackResponse {
  id: string;
  bugCandidateId: string;
  fixSessionId: string | null;
  feedbackType: FeedbackType;
  comment: string | null;
  createdByUserId: string;
  createdAt: string;
}

// --- Fix Runner ---

export type RunnerStatus = 'OFFLINE' | 'STARTING' | 'READY' | 'BUSY' | 'DEGRADED' | 'DRAINING' | 'UNHEALTHY';
export type RunnerType = 'MANAGED' | 'SELF_HOSTED' | 'LOCAL';

export interface FixRunner {
  id: string;
  projectId: string | null;
  name: string;
  type: RunnerType;
  status: RunnerStatus;
  version: string | null;
  protocolVersion: string | null;
  capabilities: RunnerCapabilities | null;
  lastHeartbeatAt: string | null;
  lastJobAt: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerCapabilities {
  languages?: string[];
  toolchains?: string[];
  browsers?: string[];
  networkAccess?: boolean;
  maxWorkspaceSize?: number;
  maxRuntimeBudget?: number;
}

export interface FixRunnerRegister {
  name: string;
  type?: RunnerType;
  version?: string;
  protocolVersion?: string;
  capabilities?: RunnerCapabilities;
}

// --- Fix Stats (Dashboard) ---

export interface FixStats {
  openCandidates: number;
  highConfidenceReady: number;
  autoFixSuccessRate: number;
  meanTimeToVerifiedFix: number | null;
  recentFixes: number;
  dismissedCandidates: number;
}

// --- WebSocket Events for Fixes ---

export interface WSFixSessionUpdate {
  event: 'fix:session:update';
  data: {
    fixSessionId: string;
    bugCandidateId: string;
    status: FixSessionStatus;
    phase?: string;
    message?: string;
  };
}

export interface WSFixAnalysisChunk {
  event: 'fix:analysis:chunk';
  data: {
    fixSessionId: string;
    analysisId: string;
    chunk: string;
  };
}

// =============================================================================
// API TESTING TYPES
// =============================================================================

export type ApiProtocol = 'REST' | 'GRAPHQL';
export type ApiTestStatusType = 'ACTIVE' | 'DISABLED' | 'ARCHIVED';

export interface ApiTestDefinitionCreate {
  name: string;
  description?: string;
  protocol?: ApiProtocol;
  method?: string;
  urlTemplate: string;
  headersTemplate?: Record<string, string>;
  queryTemplate?: Record<string, string>;
  bodyTemplate?: string;
  variablesTemplate?: Record<string, string>;
  graphqlQuery?: string;
  graphqlVariables?: Record<string, unknown>;
  graphqlOperationName?: string;
  authBindingId?: string;
  environmentBindingId?: string;
  serviceBindingId?: string;
  tags?: string[];
  timeoutMs?: number;
  retries?: number;
}

export interface ApiTestDefinitionUpdate {
  name?: string;
  description?: string;
  protocol?: ApiProtocol;
  method?: string;
  urlTemplate?: string;
  headersTemplate?: Record<string, string>;
  queryTemplate?: Record<string, string>;
  bodyTemplate?: string;
  variablesTemplate?: Record<string, string>;
  graphqlQuery?: string;
  graphqlVariables?: Record<string, unknown>;
  graphqlOperationName?: string;
  authBindingId?: string | null;
  environmentBindingId?: string | null;
  serviceBindingId?: string | null;
  tags?: string[];
  status?: ApiTestStatusType;
  timeoutMs?: number;
  retries?: number;
}

export interface ApiTestDefinition {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  protocol: ApiProtocol;
  method: string;
  urlTemplate: string;
  headersTemplate: Record<string, string> | null;
  queryTemplate: Record<string, string> | null;
  bodyTemplate: string | null;
  variablesTemplate: Record<string, string> | null;
  graphqlQuery: string | null;
  graphqlVariables: Record<string, unknown> | null;
  graphqlOperationName: string | null;
  authBindingId: string | null;
  environmentBindingId: string | null;
  serviceBindingId: string | null;
  tags: string[];
  status: ApiTestStatusType;
  timeoutMs: number;
  retries: number;
  createdAt: string;
  updatedAt: string;
  assertions?: ApiAssertionData[];
  lastExecution?: ApiExecutionData;
}

// --- Assertions ---

export type ApiAssertionType =
  | 'STATUS_CODE'
  | 'HEADER'
  | 'JSON_PATH'
  | 'SCHEMA'
  | 'GRAPHQL_ERROR_ABSENT'
  | 'LATENCY'
  | 'BODY_CONTAINS'
  | 'BODY_REGEX'
  | 'RESPONSE_TIME';

export type ApiAssertionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'MATCHES_REGEX'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'IS_TYPE'
  | 'SCHEMA_VALID';

export interface ApiAssertionCreate {
  apiTestId: string;
  type: ApiAssertionType;
  operator?: ApiAssertionOperator;
  target?: string;
  expectedValue?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  order?: number;
  description?: string;
}

export interface ApiAssertionData {
  id: string;
  apiTestId: string;
  type: ApiAssertionType;
  operator: ApiAssertionOperator;
  target: string | null;
  expectedValue: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  order: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiAssertionResult {
  assertionId: string;
  passed: boolean;
  actual: string | null;
  expected: string | null;
  message: string;
  type: ApiAssertionType;
}

// --- Environment Bindings ---

export interface ApiEnvironmentBindingCreate {
  name: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  defaultVariables?: Record<string, string>;
  authBindingId?: string;
  isDefault?: boolean;
}

export interface ApiEnvironmentBindingData {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  defaultHeaders: Record<string, string> | null;
  defaultVariables: Record<string, string> | null;
  secretRefs: unknown | null;
  authBindingId: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Auth Bindings ---

export type ApiAuthType = 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC' | 'OAUTH_CLIENT_CREDENTIALS' | 'CUSTOM';

export interface ApiAuthBindingCreate {
  name: string;
  authType: ApiAuthType;
  headerName?: string;
  tokenPrefix?: string;
  secretRef?: string;
  oauthConfig?: {
    tokenUrl: string;
    clientId: string;
    clientSecretRef: string;
    scopes?: string[];
  };
  customConfig?: Record<string, unknown>;
  redactionPolicy?: string;
}

export interface ApiAuthBindingData {
  id: string;
  projectId: string;
  name: string;
  authType: ApiAuthType;
  headerName: string | null;
  tokenPrefix: string | null;
  secretRef: string | null;
  oauthConfig: Record<string, unknown> | null;
  customConfig: Record<string, unknown> | null;
  redactionPolicy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Suite Definitions ---

export type ApiSuiteExecutionMode = 'API_ONLY' | 'MIXED';
export type ApiSuiteOrderingMode = 'PARALLEL' | 'SEQUENTIAL' | 'STAGED';

export interface ApiSuiteDefinitionCreate {
  name: string;
  description?: string;
  executionMode?: ApiSuiteExecutionMode;
  orderingMode?: ApiSuiteOrderingMode;
  setupSteps?: unknown[];
  teardownSteps?: unknown[];
  failurePolicy?: string;
  tags?: string[];
  memberIds?: string[];
}

export interface ApiSuiteDefinitionData {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  executionMode: ApiSuiteExecutionMode;
  orderingMode: ApiSuiteOrderingMode;
  failurePolicy: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members?: { id: string; apiTestId: string; order: number; stage: number }[];
  _count?: { members: number; executions: number };
}

// --- Service Bindings ---

export interface ApiServiceBindingCreate {
  name: string;
  serviceName: string;
  repoId?: string;
  repoPath?: string;
  ownerTeamId?: string;
  routePatterns?: string[];
  contractSource?: string;
  environmentMappings?: Record<string, string>;
}

export interface ApiServiceBindingData {
  id: string;
  projectId: string;
  name: string;
  serviceName: string;
  repoId: string | null;
  repoPath: string | null;
  ownerTeamId: string | null;
  routePatterns: string[];
  contractSource: string | null;
  environmentMappings: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

// --- API Executions ---

export type ApiExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'SKIPPED';

export type ApiExecutionTrigger = 'MANUAL' | 'SCHEDULE' | 'CI' | 'API' | 'SUITE';

export interface ApiExecutionCreate {
  apiTestId?: string;
  suiteId?: string;
  environmentName?: string;
  branch?: string;
  variableOverrides?: Record<string, string>;
}

export interface ApiExecutionData {
  id: string;
  projectId: string;
  apiTestId: string | null;
  suiteId: string | null;
  status: ApiExecutionStatus;
  trigger: ApiExecutionTrigger;
  environmentName: string | null;
  branch: string | null;

  requestMethod: string | null;
  requestUrl: string | null;
  requestHeaders: Record<string, string> | null;
  requestBody: string | null;

  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  responseBodySize: number | null;

  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  latencyMs: number | null;

  assertionResults: ApiAssertionResult[] | null;
  passedAssertions: number;
  failedAssertions: number;
  totalAssertions: number;

  failureSummary: string | null;
  errorMessage: string | null;
  createdAt: string;

  apiTest?: { id: string; name: string; protocol: ApiProtocol };
  suite?: { id: string; name: string };
}

// --- API Execution Artifacts ---

export type ApiArtifactType = 'REQUEST' | 'RESPONSE' | 'SCHEMA_REPORT' | 'GRAPHQL_RESULT' | 'ANALYSIS' | 'CONTRACT_DIFF';

export interface ApiExecutionArtifactData {
  id: string;
  apiExecutionId: string;
  type: ApiArtifactType;
  name: string;
  content: string | null;
  storageUrl: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

// --- API Test Stats ---

export interface ApiTestStats {
  totalApiTests: number;
  activeApiTests: number;
  apiPassRate: number;
  failedByService: { serviceName: string; count: number }[];
  slowestTests: { testId: string; name: string; avgDurationMs: number }[];
  recentExecutions: number;
}

// =============================================================================
// AI PLATFORM TYPES
// =============================================================================

export type AIProviderType = 'ANTHROPIC' | 'OPENAI' | 'OPENROUTER' | 'GEMINI' | 'LOCAL';

export interface AIProviderConfigCreate {
  provider: AIProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  maxRequestsPerMin?: number;
  maxCostPerSession?: number;
  maxRuntimeSeconds?: number;
  supportsStreaming?: boolean;
  supportsImages?: boolean;
  supportsFunctions?: boolean;
  isDefault?: boolean;
}

export interface AIProviderConfigUpdate {
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxRequestsPerMin?: number;
  maxCostPerSession?: number;
  maxRuntimeSeconds?: number;
  supportsStreaming?: boolean;
  supportsImages?: boolean;
  supportsFunctions?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface AIProviderConfigData {
  id: string;
  projectId: string;
  provider: AIProviderType;
  name: string;
  hasApiKey: boolean;
  baseUrl: string | null;
  organizationId: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRequestsPerMin: number | null;
  maxCostPerSession: number | null;
  maxRuntimeSeconds: number;
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsFunctions: boolean;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsImages?: boolean;
  supportsStreaming?: boolean;
  supportsFunctions?: boolean;
  pricing?: {
    inputPerMToken?: number;
    outputPerMToken?: number;
  };
}

export interface AIProviderDefaults {
  provider: AIProviderType;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string;
  models: AIModelInfo[];
  requiresApiKey: boolean;
  supportsModelListing: boolean;
}
