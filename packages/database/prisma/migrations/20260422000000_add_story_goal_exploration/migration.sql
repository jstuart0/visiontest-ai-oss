-- Phase 1a: Story-based authoring and goal contract; scaffolding for EXPLORE mode

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('STANDARD', 'EXPLORE');

-- AlterTable: Test — story authoring fields
ALTER TABLE "Test"
  ADD COLUMN "goal"         TEXT,
  ADD COLUMN "goalChecks"   JSONB,
  ADD COLUMN "storySource"  TEXT,
  ADD COLUMN "storyFormat"  TEXT;

-- AlterTable: Execution — goal evaluation + EXPLORE hooks
ALTER TABLE "Execution"
  ADD COLUMN "mode"           "ExecutionMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "goalAchieved"   BOOLEAN,
  ADD COLUMN "goalReasoning"  TEXT,
  ADD COLUMN "goalChecks"     JSONB,
  ADD COLUMN "exploreSummary" JSONB;
