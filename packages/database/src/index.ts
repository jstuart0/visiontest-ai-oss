// VisionTest.ai - Database Client Export
// Re-exports Prisma client and types for use across the monorepo

export * from '@prisma/client';
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { encrypt, decrypt, decryptApiKey, isEncrypted } from './crypto';

export default prisma;

// Shared services
export { syncStorybook } from './services/storybookSync';
export type { SyncResult, SyncConfig } from './services/storybookSync';
export { updateImpactMappings, decayStaleConfidence } from './services/impactMapping';
