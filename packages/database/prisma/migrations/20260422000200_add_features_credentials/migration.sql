-- Phase 1c: Features, Credentials, Test context fields

-- Test context fields
ALTER TABLE "Test"
  ADD COLUMN "startUrl"           TEXT,
  ADD COLUMN "credentialRef"      TEXT,
  ADD COLUMN "environment"        TEXT,
  ADD COLUMN "preconditionTestId" TEXT,
  ADD COLUMN "featureId"          TEXT,
  ADD COLUMN "fixtureJson"        JSONB;

CREATE INDEX "Test_featureId_idx" ON "Test"("featureId");

-- Feature: scenario grouping
CREATE TABLE "Feature" (
  "id"          TEXT PRIMARY KEY,
  "projectId"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "sharedSetup" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Feature_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Feature_projectId_idx" ON "Feature"("projectId");

ALTER TABLE "Test"
  ADD CONSTRAINT "Test_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Credential: env-scoped encrypted creds
CREATE TABLE "Credential" (
  "id"                        TEXT PRIMARY KEY,
  "orgId"                     TEXT NOT NULL,
  "projectId"                 TEXT,
  "key"                       TEXT NOT NULL,
  "environment"               TEXT,
  "allowEnvironmentFallback"  BOOLEAN NOT NULL DEFAULT false,
  "encryptedBlob"             TEXT NOT NULL,
  "version"                   INTEGER NOT NULL DEFAULT 1,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Credential_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Credential_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Credential_orgId_projectId_key_environment_key"
  ON "Credential"("orgId", "projectId", "key", "environment");
CREATE INDEX "Credential_orgId_key_environment_idx"
  ON "Credential"("orgId", "key", "environment");
