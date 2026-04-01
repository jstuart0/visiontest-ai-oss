-- CreateEnum
CREATE TYPE "ApiProtocol" AS ENUM ('REST', 'GRAPHQL');
CREATE TYPE "ApiTestStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "ApiAssertionType" AS ENUM ('STATUS_CODE', 'HEADER', 'JSON_PATH', 'SCHEMA', 'GRAPHQL_ERROR_ABSENT', 'LATENCY', 'BODY_CONTAINS', 'BODY_REGEX', 'RESPONSE_TIME');
CREATE TYPE "ApiAssertionOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS', 'NOT_CONTAINS', 'MATCHES_REGEX', 'EXISTS', 'NOT_EXISTS', 'IS_TYPE', 'SCHEMA_VALID');
CREATE TYPE "ApiAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER', 'BASIC', 'OAUTH_CLIENT_CREDENTIALS', 'CUSTOM');
CREATE TYPE "ApiSuiteExecutionMode" AS ENUM ('API_ONLY', 'MIXED');
CREATE TYPE "ApiSuiteOrderingMode" AS ENUM ('PARALLEL', 'SEQUENTIAL', 'STAGED');
CREATE TYPE "ApiExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'ERROR', 'TIMEOUT', 'CANCELLED', 'SKIPPED');
CREATE TYPE "ApiExecutionTrigger" AS ENUM ('MANUAL', 'SCHEDULE', 'CI', 'API', 'SUITE');
CREATE TYPE "ApiArtifactType" AS ENUM ('REQUEST', 'RESPONSE', 'SCHEMA_REPORT', 'GRAPHQL_RESULT', 'ANALYSIS', 'CONTRACT_DIFF');

-- CreateTable: ApiTestDefinition
CREATE TABLE "ApiTestDefinition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "protocol" "ApiProtocol" NOT NULL DEFAULT 'REST',
    "method" TEXT NOT NULL DEFAULT 'GET',
    "urlTemplate" TEXT NOT NULL,
    "headersTemplate" JSONB,
    "queryTemplate" JSONB,
    "bodyTemplate" TEXT,
    "variablesTemplate" JSONB,
    "graphqlQuery" TEXT,
    "graphqlVariables" JSONB,
    "graphqlOperationName" TEXT,
    "authBindingId" TEXT,
    "environmentBindingId" TEXT,
    "serviceBindingId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ApiTestStatus" NOT NULL DEFAULT 'ACTIVE',
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiTestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiAssertion
CREATE TABLE "ApiAssertion" (
    "id" TEXT NOT NULL,
    "apiTestId" TEXT NOT NULL,
    "type" "ApiAssertionType" NOT NULL,
    "operator" "ApiAssertionOperator" NOT NULL DEFAULT 'EQUALS',
    "target" TEXT,
    "expectedValue" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiAssertion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiEnvironmentBinding
CREATE TABLE "ApiEnvironmentBinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "defaultHeaders" JSONB,
    "defaultVariables" JSONB,
    "secretRefs" JSONB,
    "authBindingId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiEnvironmentBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiAuthBinding
CREATE TABLE "ApiAuthBinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authType" "ApiAuthType" NOT NULL DEFAULT 'NONE',
    "headerName" TEXT,
    "tokenPrefix" TEXT,
    "secretRef" TEXT,
    "oauthConfig" JSONB,
    "customConfig" JSONB,
    "redactionPolicy" TEXT NOT NULL DEFAULT 'full',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiAuthBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiSuiteDefinition
CREATE TABLE "ApiSuiteDefinition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "executionMode" "ApiSuiteExecutionMode" NOT NULL DEFAULT 'API_ONLY',
    "orderingMode" "ApiSuiteOrderingMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "setupSteps" JSONB,
    "teardownSteps" JSONB,
    "failurePolicy" TEXT NOT NULL DEFAULT 'stop_on_failure',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiSuiteDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiSuiteMember
CREATE TABLE "ApiSuiteMember" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "apiTestId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiSuiteMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiServiceBinding
CREATE TABLE "ApiServiceBinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "repoId" TEXT,
    "repoPath" TEXT,
    "ownerTeamId" TEXT,
    "routePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contractSource" TEXT,
    "environmentMappings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiServiceBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiExecution
CREATE TABLE "ApiExecution" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "apiTestId" TEXT,
    "suiteId" TEXT,
    "status" "ApiExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "ApiExecutionTrigger" NOT NULL DEFAULT 'MANUAL',
    "environmentName" TEXT,
    "branch" TEXT,
    "triggeredBy" TEXT,
    "requestMethod" TEXT,
    "requestUrl" TEXT,
    "requestHeaders" JSONB,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "responseHeaders" JSONB,
    "responseBody" TEXT,
    "responseBodySize" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "latencyMs" INTEGER,
    "assertionResults" JSONB,
    "passedAssertions" INTEGER NOT NULL DEFAULT 0,
    "failedAssertions" INTEGER NOT NULL DEFAULT 0,
    "totalAssertions" INTEGER NOT NULL DEFAULT 0,
    "failureSummary" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiExecutionArtifact
CREATE TABLE "ApiExecutionArtifact" (
    "id" TEXT NOT NULL,
    "apiExecutionId" TEXT NOT NULL,
    "type" "ApiArtifactType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "storageUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiExecutionArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiTestDefinition_projectId_status_idx" ON "ApiTestDefinition"("projectId", "status");
CREATE INDEX "ApiTestDefinition_protocol_idx" ON "ApiTestDefinition"("protocol");
CREATE INDEX "ApiTestDefinition_tags_idx" ON "ApiTestDefinition"("tags");

CREATE INDEX "ApiAssertion_apiTestId_idx" ON "ApiAssertion"("apiTestId");
CREATE INDEX "ApiAssertion_type_idx" ON "ApiAssertion"("type");

CREATE UNIQUE INDEX "ApiEnvironmentBinding_projectId_name_key" ON "ApiEnvironmentBinding"("projectId", "name");
CREATE INDEX "ApiEnvironmentBinding_projectId_idx" ON "ApiEnvironmentBinding"("projectId");

CREATE UNIQUE INDEX "ApiAuthBinding_projectId_name_key" ON "ApiAuthBinding"("projectId", "name");
CREATE INDEX "ApiAuthBinding_projectId_idx" ON "ApiAuthBinding"("projectId");

CREATE INDEX "ApiSuiteDefinition_projectId_idx" ON "ApiSuiteDefinition"("projectId");

CREATE UNIQUE INDEX "ApiSuiteMember_suiteId_apiTestId_key" ON "ApiSuiteMember"("suiteId", "apiTestId");
CREATE INDEX "ApiSuiteMember_suiteId_idx" ON "ApiSuiteMember"("suiteId");

CREATE UNIQUE INDEX "ApiServiceBinding_projectId_name_key" ON "ApiServiceBinding"("projectId", "name");
CREATE INDEX "ApiServiceBinding_projectId_idx" ON "ApiServiceBinding"("projectId");

CREATE INDEX "ApiExecution_projectId_status_idx" ON "ApiExecution"("projectId", "status");
CREATE INDEX "ApiExecution_apiTestId_createdAt_idx" ON "ApiExecution"("apiTestId", "createdAt");
CREATE INDEX "ApiExecution_suiteId_idx" ON "ApiExecution"("suiteId");
CREATE INDEX "ApiExecution_status_createdAt_idx" ON "ApiExecution"("status", "createdAt");

CREATE INDEX "ApiExecutionArtifact_apiExecutionId_idx" ON "ApiExecutionArtifact"("apiExecutionId");
CREATE INDEX "ApiExecutionArtifact_type_idx" ON "ApiExecutionArtifact"("type");

-- AddForeignKey
ALTER TABLE "ApiTestDefinition" ADD CONSTRAINT "ApiTestDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiTestDefinition" ADD CONSTRAINT "ApiTestDefinition_authBindingId_fkey" FOREIGN KEY ("authBindingId") REFERENCES "ApiAuthBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiTestDefinition" ADD CONSTRAINT "ApiTestDefinition_environmentBindingId_fkey" FOREIGN KEY ("environmentBindingId") REFERENCES "ApiEnvironmentBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiTestDefinition" ADD CONSTRAINT "ApiTestDefinition_serviceBindingId_fkey" FOREIGN KEY ("serviceBindingId") REFERENCES "ApiServiceBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiAssertion" ADD CONSTRAINT "ApiAssertion_apiTestId_fkey" FOREIGN KEY ("apiTestId") REFERENCES "ApiTestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiEnvironmentBinding" ADD CONSTRAINT "ApiEnvironmentBinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiEnvironmentBinding" ADD CONSTRAINT "ApiEnvironmentBinding_authBindingId_fkey" FOREIGN KEY ("authBindingId") REFERENCES "ApiAuthBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiAuthBinding" ADD CONSTRAINT "ApiAuthBinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiSuiteDefinition" ADD CONSTRAINT "ApiSuiteDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiSuiteMember" ADD CONSTRAINT "ApiSuiteMember_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "ApiSuiteDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiSuiteMember" ADD CONSTRAINT "ApiSuiteMember_apiTestId_fkey" FOREIGN KEY ("apiTestId") REFERENCES "ApiTestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiServiceBinding" ADD CONSTRAINT "ApiServiceBinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_apiTestId_fkey" FOREIGN KEY ("apiTestId") REFERENCES "ApiTestDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "ApiSuiteDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiExecutionArtifact" ADD CONSTRAINT "ApiExecutionArtifact_apiExecutionId_fkey" FOREIGN KEY ("apiExecutionId") REFERENCES "ApiExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
