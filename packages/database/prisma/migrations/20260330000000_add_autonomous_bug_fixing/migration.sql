-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RepoProvider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET', 'LOCAL');
CREATE TYPE "RepoType" AS ENUM ('SINGLE', 'MONOREPO', 'SERVICE');
CREATE TYPE "BugCandidateStatus" AS ENUM ('NEW', 'TRIAGING', 'INVESTIGATING', 'AWAITING_APPROVAL', 'APPLYING', 'VERIFYING', 'READY', 'MERGED', 'DISMISSED');
CREATE TYPE "FailureType" AS ENUM ('VISUAL', 'RUNTIME', 'ASSERTION', 'PERFORMANCE', 'MOBILE', 'API', 'UNKNOWN');
CREATE TYPE "BugClassification" AS ENUM ('PRODUCT_BUG', 'TEST_ISSUE', 'ENVIRONMENT_ISSUE', 'EXPECTED_CHANGE', 'UNCLASSIFIED');
CREATE TYPE "CreatedByMode" AS ENUM ('USER', 'RULE', 'CI', 'AUTO');
CREATE TYPE "FixSessionStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'PLANNING', 'PATCHING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'AWAITING_APPROVAL');
CREATE TYPE "FixSessionMode" AS ENUM ('INVESTIGATE_ONLY', 'SUGGEST_PATCH', 'APPLY_PATCH', 'OPEN_PR');
CREATE TYPE "FixArtifactType" AS ENUM ('ROOT_CAUSE_REPORT', 'PATCH_DIFF', 'TEST_RERUN_REPORT', 'SCREENSHOT_BEFORE', 'SCREENSHOT_AFTER', 'LOG', 'PR_URL', 'BRANCH_NAME', 'EVIDENCE_BUNDLE', 'VERIFICATION_REPORT');
CREATE TYPE "VerificationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'PARTIAL', 'SKIPPED', 'TIMEOUT');
CREATE TYPE "FixMode" AS ENUM ('MANUAL', 'GUIDED', 'SEMI_AUTO', 'FULLY_AUTO');
CREATE TYPE "AnalysisType" AS ENUM ('FAILURE_SUMMARY', 'VISUAL_ANALYSIS', 'ROOT_CAUSE_HYPOTHESIS', 'SUGGESTED_ACTIONS', 'CODE_CONTEXT', 'PATCH_RATIONALE');
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED');
CREATE TYPE "FeedbackType" AS ENUM ('CORRECT_FIX', 'PARTIAL_FIX', 'WRONG_ROOT_CAUSE', 'TOO_RISKY', 'TOO_BROAD', 'SHOULD_BE_BASELINE_CHANGE', 'SHOULD_BE_TEST_ISSUE', 'OTHER');
CREATE TYPE "RunnerStatus" AS ENUM ('OFFLINE', 'STARTING', 'READY', 'BUSY', 'DEGRADED', 'DRAINING', 'UNHEALTHY');
CREATE TYPE "RunnerType" AS ENUM ('MANAGED', 'SELF_HOSTED', 'LOCAL');

-- CreateTable: RepositoryConnection
CREATE TABLE "RepositoryConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "RepoProvider" NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "authMode" TEXT NOT NULL DEFAULT 'token',
    "encryptedToken" TEXT,
    "repoType" "RepoType" NOT NULL DEFAULT 'SINGLE',
    "defaultPath" TEXT,
    "cloneStrategy" TEXT NOT NULL DEFAULT 'shallow',
    "allowedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ciMetadata" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BugCandidate
CREATE TABLE "BugCandidate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "testId" TEXT,
    "executionId" TEXT,
    "comparisonId" TEXT,
    "repoConnectionId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'execution',
    "title" TEXT NOT NULL,
    "plainLanguageSummary" TEXT,
    "failureType" "FailureType" NOT NULL DEFAULT 'UNKNOWN',
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "BugCandidateStatus" NOT NULL DEFAULT 'NEW',
    "classification" "BugClassification" NOT NULL DEFAULT 'UNCLASSIFIED',
    "branch" TEXT,
    "commitSha" TEXT,
    "evidence" JSONB,
    "suggestedActions" JSONB,
    "createdByMode" "CreatedByMode" NOT NULL DEFAULT 'USER',
    "createdByUserId" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BugCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FixSession
CREATE TABLE "FixSession" (
    "id" TEXT NOT NULL,
    "bugCandidateId" TEXT NOT NULL,
    "mode" "FixSessionMode" NOT NULL DEFAULT 'SUGGEST_PATCH',
    "strategy" TEXT,
    "agentModel" TEXT,
    "status" "FixSessionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,
    "plainLanguageSummary" TEXT,
    "technicalSummary" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "patchDiff" TEXT,
    "patchFiles" JSONB,
    "branchName" TEXT,
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "verificationOutcome" TEXT,
    "rootCauseHypothesis" TEXT,
    "impactedFiles" JSONB,
    "eventLog" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FixArtifact
CREATE TABLE "FixArtifact" (
    "id" TEXT NOT NULL,
    "fixSessionId" TEXT NOT NULL,
    "type" "FixArtifactType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "storageUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VerificationRun
CREATE TABLE "VerificationRun" (
    "id" TEXT NOT NULL,
    "fixSessionId" TEXT NOT NULL,
    "profileId" TEXT,
    "status" "VerificationRunStatus" NOT NULL DEFAULT 'PENDING',
    "steps" JSONB,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "failedSteps" INTEGER NOT NULL DEFAULT 0,
    "passedSteps" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VerificationProfile
CREATE TABLE "VerificationProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "preset" TEXT NOT NULL DEFAULT 'balanced',
    "commands" JSONB NOT NULL,
    "targetingStrategy" TEXT NOT NULL DEFAULT 'affected',
    "maxRuntimeSeconds" INTEGER NOT NULL DEFAULT 300,
    "failurePolicy" TEXT NOT NULL DEFAULT 'fail_closed',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FixPolicy
CREATE TABLE "FixPolicy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repoConnectionId" TEXT,
    "name" TEXT NOT NULL,
    "mode" "FixMode" NOT NULL DEFAULT 'GUIDED',
    "maxFilesChanged" INTEGER NOT NULL DEFAULT 5,
    "maxLinesChanged" INTEGER NOT NULL DEFAULT 200,
    "allowedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowDependencyChanges" BOOLEAN NOT NULL DEFAULT false,
    "allowLockfileChanges" BOOLEAN NOT NULL DEFAULT false,
    "allowMigrationChanges" BOOLEAN NOT NULL DEFAULT false,
    "requireHumanApproval" BOOLEAN NOT NULL DEFAULT true,
    "autoMergeConditions" JSONB,
    "branchPrefix" TEXT NOT NULL DEFAULT 'visiontest/fix',
    "prTemplate" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvestigationAnalysis
CREATE TABLE "InvestigationAnalysis" (
    "id" TEXT NOT NULL,
    "bugCandidateId" TEXT NOT NULL,
    "fixSessionId" TEXT,
    "analysisType" "AnalysisType" NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "content" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestigationAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FixFeedback
CREATE TABLE "FixFeedback" (
    "id" TEXT NOT NULL,
    "bugCandidateId" TEXT NOT NULL,
    "fixSessionId" TEXT,
    "feedbackType" "FeedbackType" NOT NULL,
    "comment" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FixRunner
CREATE TABLE "FixRunner" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "type" "RunnerType" NOT NULL DEFAULT 'MANAGED',
    "status" "RunnerStatus" NOT NULL DEFAULT 'OFFLINE',
    "version" TEXT,
    "protocolVersion" TEXT,
    "capabilities" JSONB,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastJobAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixRunner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryConnection_projectId_repoUrl_key" ON "RepositoryConnection"("projectId", "repoUrl");
CREATE INDEX "RepositoryConnection_projectId_idx" ON "RepositoryConnection"("projectId");

CREATE INDEX "BugCandidate_projectId_status_idx" ON "BugCandidate"("projectId", "status");
CREATE INDEX "BugCandidate_status_createdAt_idx" ON "BugCandidate"("status", "createdAt");
CREATE INDEX "BugCandidate_executionId_idx" ON "BugCandidate"("executionId");
CREATE INDEX "BugCandidate_comparisonId_idx" ON "BugCandidate"("comparisonId");
CREATE INDEX "BugCandidate_classification_idx" ON "BugCandidate"("classification");
CREATE INDEX "BugCandidate_failureType_idx" ON "BugCandidate"("failureType");

CREATE INDEX "FixSession_bugCandidateId_idx" ON "FixSession"("bugCandidateId");
CREATE INDEX "FixSession_status_idx" ON "FixSession"("status");
CREATE INDEX "FixSession_createdAt_idx" ON "FixSession"("createdAt");

CREATE INDEX "FixArtifact_fixSessionId_idx" ON "FixArtifact"("fixSessionId");
CREATE INDEX "FixArtifact_type_idx" ON "FixArtifact"("type");

CREATE INDEX "VerificationRun_fixSessionId_idx" ON "VerificationRun"("fixSessionId");
CREATE INDEX "VerificationRun_status_idx" ON "VerificationRun"("status");

CREATE INDEX "VerificationProfile_projectId_idx" ON "VerificationProfile"("projectId");

CREATE INDEX "FixPolicy_projectId_idx" ON "FixPolicy"("projectId");
CREATE INDEX "FixPolicy_isActive_idx" ON "FixPolicy"("isActive");

CREATE INDEX "InvestigationAnalysis_bugCandidateId_idx" ON "InvestigationAnalysis"("bugCandidateId");
CREATE INDEX "InvestigationAnalysis_fixSessionId_idx" ON "InvestigationAnalysis"("fixSessionId");
CREATE INDEX "InvestigationAnalysis_analysisType_idx" ON "InvestigationAnalysis"("analysisType");

CREATE INDEX "FixFeedback_bugCandidateId_idx" ON "FixFeedback"("bugCandidateId");
CREATE INDEX "FixFeedback_fixSessionId_idx" ON "FixFeedback"("fixSessionId");

CREATE INDEX "FixRunner_projectId_idx" ON "FixRunner"("projectId");
CREATE INDEX "FixRunner_status_idx" ON "FixRunner"("status");
CREATE INDEX "FixRunner_type_idx" ON "FixRunner"("type");

-- AddForeignKey
ALTER TABLE "RepositoryConnection" ADD CONSTRAINT "RepositoryConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BugCandidate" ADD CONSTRAINT "BugCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BugCandidate" ADD CONSTRAINT "BugCandidate_repoConnectionId_fkey" FOREIGN KEY ("repoConnectionId") REFERENCES "RepositoryConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FixSession" ADD CONSTRAINT "FixSession_bugCandidateId_fkey" FOREIGN KEY ("bugCandidateId") REFERENCES "BugCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FixArtifact" ADD CONSTRAINT "FixArtifact_fixSessionId_fkey" FOREIGN KEY ("fixSessionId") REFERENCES "FixSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_fixSessionId_fkey" FOREIGN KEY ("fixSessionId") REFERENCES "FixSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "VerificationProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VerificationProfile" ADD CONSTRAINT "VerificationProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FixPolicy" ADD CONSTRAINT "FixPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FixPolicy" ADD CONSTRAINT "FixPolicy_repoConnectionId_fkey" FOREIGN KEY ("repoConnectionId") REFERENCES "RepositoryConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestigationAnalysis" ADD CONSTRAINT "InvestigationAnalysis_bugCandidateId_fkey" FOREIGN KEY ("bugCandidateId") REFERENCES "BugCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestigationAnalysis" ADD CONSTRAINT "InvestigationAnalysis_fixSessionId_fkey" FOREIGN KEY ("fixSessionId") REFERENCES "FixSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FixFeedback" ADD CONSTRAINT "FixFeedback_bugCandidateId_fkey" FOREIGN KEY ("bugCandidateId") REFERENCES "BugCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FixFeedback" ADD CONSTRAINT "FixFeedback_fixSessionId_fkey" FOREIGN KEY ("fixSessionId") REFERENCES "FixSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FixRunner" ADD CONSTRAINT "FixRunner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
