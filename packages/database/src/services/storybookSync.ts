// VisionTest.ai - Shared Storybook Sync Service
// Pure function: fetches index.json, applies filters, creates/updates/archives Test records.
// Used by both the API route (manual sync) and the BullMQ worker (scheduled polling).

import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SyncConfig {
  includePatterns: string[];
  excludePatterns: string[];
  waitAfterLoadMs: number;
}

export interface SyncResult {
  storiesDiscovered: number;
  testsCreated: number;
  testsUpdated: number;
  testsArchived: number;
  testsUnchanged: number;
  indexJsonVersion: string | null;
}

// ---------------------------------------------------------------------------
// Glob helper (simple wildcard matching)
// ---------------------------------------------------------------------------

function matchGlob(str: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(str);
}

// ---------------------------------------------------------------------------
// Core sync function
// ---------------------------------------------------------------------------

/**
 * Discover stories from a Storybook index.json and reconcile with Test records.
 *
 * @param prisma   - PrismaClient instance
 * @param projectId - target project
 * @param storybookUrl - base URL of the Storybook instance (e.g. https://storybook.example.com)
 * @param config    - include/exclude glob patterns and waitAfterLoadMs
 * @returns SyncResult with counts of created/updated/archived tests
 */
export async function syncStorybook(
  prisma: PrismaClient,
  projectId: string,
  storybookUrl: string,
  config: SyncConfig,
  fetchFn: typeof fetch = fetch,
): Promise<SyncResult> {
  const baseUrl = storybookUrl.replace(/\/$/, '');

  // ---- 1. Fetch Storybook index ----
  let stories: Array<{
    id: string;
    title: string;
    name: string;
    importPath?: string;
    tags: string[];
  }> = [];
  let indexVersion: string = 'v3';

  try {
    const indexUrl = baseUrl + '/index.json';
    const resp = await fetchFn(indexUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const indexJson: any = await resp.json();

    if (indexJson.v >= 4 && indexJson.entries) {
      indexVersion = 'v4';
      stories = Object.values(indexJson.entries)
        .filter((e: any) => e.type === 'story')
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          name: e.name,
          importPath: e.importPath,
          tags: e.tags || [],
        }));
    } else if (indexJson.stories) {
      indexVersion = 'v3';
      stories = Object.values(indexJson.stories).map((e: any) => ({
        id: e.id,
        title: e.title,
        name: e.name,
        importPath: e.importPath,
        tags: [],
      }));
    } else {
      throw new Error('Unknown Storybook index format');
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    // Persist the error on the config row
    await prisma.storybookConfig.upsert({
      where: { projectId },
      create: { projectId, lastSyncError: errMsg },
      update: { lastSyncError: errMsg },
    });
    throw new Error(`Failed to fetch Storybook index: ${errMsg}`);
  }

  // ---- 2. Apply include / exclude glob filters ----
  const { includePatterns, excludePatterns } = config;
  const filtered = stories.filter((s) => {
    if (excludePatterns.some((p) => matchGlob(s.id, p))) return false;
    if (
      includePatterns.length > 0 &&
      !includePatterns.some((p) => matchGlob(s.id, p))
    )
      return false;
    return true;
  });

  // ---- 3. Load existing storybook tests ----
  const existingTests = await prisma.test.findMany({
    where: { projectId, source: 'storybook' },
    select: { id: true, storybookStoryId: true, name: true },
  });
  const existingMap = new Map(
    existingTests.map((t) => [t.storybookStoryId, t]),
  );

  // ---- 4. Create / update tests ----
  let testsCreated = 0;
  let testsUpdated = 0;
  let testsUnchanged = 0;
  let testsArchived = 0;
  const discoveredIds = new Set<string>();

  for (const story of filtered) {
    discoveredIds.add(story.id);
    const testName = `Storybook / ${story.title} / ${story.name}`;
    const existing = existingMap.get(story.id);

    if (existing) {
      if (existing.name !== testName) {
        await prisma.test.update({
          where: { id: existing.id },
          data: { name: testName, storybookImport: story.importPath },
        });
        testsUpdated++;
      } else {
        testsUnchanged++;
      }
    } else {
      await prisma.test.create({
        data: {
          projectId,
          name: testName,
          source: 'storybook',
          storybookStoryId: story.id,
          storybookImport: story.importPath,
          tags: ['storybook'],
          steps: [
            {
              type: 'navigate',
              url: `${baseUrl}/iframe.html?id=${story.id}&viewMode=story`,
            },
            {
              type: 'waitFor',
              selector: '#storybook-root > *',
              timeout: 5000,
            },
            { type: 'screenshot', name: story.id },
          ],
        },
      });
      testsCreated++;
    }
  }

  // ---- 5. Archive tests whose stories no longer exist ----
  for (const [storyId, test] of existingMap) {
    if (storyId && !discoveredIds.has(storyId)) {
      await prisma.test.update({
        where: { id: test.id },
        data: { status: 'ARCHIVED' },
      });
      testsArchived++;
    }
  }

  // ---- 6. Update sync metadata ----
  await prisma.storybookConfig.upsert({
    where: { projectId },
    create: {
      projectId,
      storybookUrl: baseUrl,
      lastSyncAt: new Date(),
      lastSyncStoryCount: filtered.length,
      lastSyncError: null,
      indexJsonVersion: indexVersion,
    },
    update: {
      lastSyncAt: new Date(),
      lastSyncStoryCount: filtered.length,
      lastSyncError: null,
      indexJsonVersion: indexVersion,
    },
  });

  return {
    storiesDiscovered: filtered.length,
    testsCreated,
    testsUpdated,
    testsArchived,
    testsUnchanged,
    indexJsonVersion: indexVersion,
  };
}
