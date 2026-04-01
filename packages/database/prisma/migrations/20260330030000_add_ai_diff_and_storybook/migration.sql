-- AlterTable: Add AI Diff fields to Comparison
ALTER TABLE "Comparison" ADD COLUMN "aiClassification" TEXT;
ALTER TABLE "Comparison" ADD COLUMN "aiConfidence" DOUBLE PRECISION;
ALTER TABLE "Comparison" ADD COLUMN "aiStageReached" INTEGER;
ALTER TABLE "Comparison" ADD COLUMN "aiExplanation" TEXT;
ALTER TABLE "Comparison" ADD COLUMN "aiRegions" JSONB;
ALTER TABLE "Comparison" ADD COLUMN "aiSuggestedAction" TEXT;
ALTER TABLE "Comparison" ADD COLUMN "aiModelUsed" TEXT;
ALTER TABLE "Comparison" ADD COLUMN "aiProcessingTimeMs" INTEGER;
ALTER TABLE "Comparison" ADD COLUMN "aiAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "Comparison" ADD COLUMN "aiScores" JSONB;

CREATE INDEX "Comparison_aiClassification_idx" ON "Comparison"("aiClassification");

-- AlterTable: Add Storybook fields to Test
ALTER TABLE "Test" ADD COLUMN "storybookStoryId" TEXT;
ALTER TABLE "Test" ADD COLUMN "storybookImport" TEXT;
ALTER TABLE "Test" ADD COLUMN "storybookContentHash" TEXT;
ALTER TABLE "Test" ADD COLUMN "source" TEXT DEFAULT 'manual';

CREATE INDEX "Test_storybookStoryId_idx" ON "Test"("storybookStoryId");
CREATE INDEX "Test_source_idx" ON "Test"("source");

-- CreateTable: AiDiffConfig
CREATE TABLE "AiDiffConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ssimThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.97,
    "lpipsThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "dinoThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.94,
    "maxStage" INTEGER NOT NULL DEFAULT 3,
    "autoApproveNoise" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveMinor" BOOLEAN NOT NULL DEFAULT false,
    "escalateBreaking" BOOLEAN NOT NULL DEFAULT true,
    "aiProviderId" TEXT,
    "vlmPromptOverride" TEXT,
    "vlmCallsPerExecution" INTEGER NOT NULL DEFAULT 50,
    "vlmMonthlyBudget" INTEGER,
    "sidecarUrl" TEXT DEFAULT 'http://visiontest-embeddings:8100',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiDiffConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiDiffConfig_projectId_key" ON "AiDiffConfig"("projectId");
CREATE INDEX "AiDiffConfig_projectId_idx" ON "AiDiffConfig"("projectId");

ALTER TABLE "AiDiffConfig" ADD CONSTRAINT "AiDiffConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AiDiffFeedback
CREATE TABLE "AiDiffFeedback" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "aiClassification" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "userAction" TEXT NOT NULL,
    "userClassification" TEXT,
    "disagreement" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiDiffFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiDiffFeedback_comparisonId_idx" ON "AiDiffFeedback"("comparisonId");
CREATE INDEX "AiDiffFeedback_orgId_createdAt_idx" ON "AiDiffFeedback"("orgId", "createdAt");
CREATE INDEX "AiDiffFeedback_disagreement_createdAt_idx" ON "AiDiffFeedback"("disagreement", "createdAt");

ALTER TABLE "AiDiffFeedback" ADD CONSTRAINT "AiDiffFeedback_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: StorybookConfig
CREATE TABLE "StorybookConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'cli',
    "storybookUrl" TEXT,
    "minioStaticPath" TEXT,
    "syncMode" TEXT NOT NULL DEFAULT 'manual',
    "pollIntervalMin" INTEGER DEFAULT 60,
    "viewports" JSONB,
    "includePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "waitAfterLoadMs" INTEGER NOT NULL DEFAULT 500,
    "indexJsonVersion" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStoryCount" INTEGER,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorybookConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorybookConfig_projectId_key" ON "StorybookConfig"("projectId");
CREATE INDEX "StorybookConfig_projectId_idx" ON "StorybookConfig"("projectId");

ALTER TABLE "StorybookConfig" ADD CONSTRAINT "StorybookConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
