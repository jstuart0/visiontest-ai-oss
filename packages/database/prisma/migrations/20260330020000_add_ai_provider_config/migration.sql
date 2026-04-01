-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('ANTHROPIC', 'OPENAI', 'OPENROUTER', 'GEMINI', 'LOCAL');

-- CreateTable
CREATE TABLE "AIProviderConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "organizationId" TEXT,
    "model" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxRequestsPerMin" INTEGER,
    "maxCostPerSession" DOUBLE PRECISION,
    "maxRuntimeSeconds" INTEGER NOT NULL DEFAULT 120,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT true,
    "supportsImages" BOOLEAN NOT NULL DEFAULT false,
    "supportsFunctions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIProviderConfig_projectId_isDefault_idx" ON "AIProviderConfig"("projectId", "isDefault");
CREATE INDEX "AIProviderConfig_provider_idx" ON "AIProviderConfig"("provider");

-- AddForeignKey
ALTER TABLE "AIProviderConfig" ADD CONSTRAINT "AIProviderConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
