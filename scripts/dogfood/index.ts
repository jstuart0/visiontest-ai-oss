#!/usr/bin/env npx tsx
/**
 * VisionTest.ai Dogfood Runner
 *
 * Uses VisionTest.ai's own API to create visual tests against its own UI,
 * run them through the Playwright-based worker, and generate a completion
 * checklist with pass/fail results.
 *
 * Usage:
 *   npx tsx scripts/dogfood/index.ts              # Run all tests
 *   npx tsx scripts/dogfood/index.ts --clean       # Remove old dogfood tests first
 *   npx tsx scripts/dogfood/index.ts --group Auth  # Only run tests in the "Auth" group
 *   npx tsx scripts/dogfood/index.ts --api URL     # Custom API base URL
 *   npx tsx scripts/dogfood/index.ts --web URL     # Custom web UI base URL
 */

import { ApiClient } from './api';
import { dogfoodTests } from './tests';
import { Reporter, type TestResult } from './reporter';

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const API_BASE = getArg('--api', 'http://localhost:3001/api/v1');
const WEB_BASE = getArg('--web', 'http://localhost:3000');
const EMAIL = getArg('--email', 'admin@visiontest.local');
const PASSWORD = getArg('--password', 'admin123!');
const GROUP_FILTER = getArg('--group', '');
const DO_CLEAN = args.includes('--clean');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] ERROR: ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║    VisionTest.ai - Dogfood Runner    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  const api = new ApiClient(API_BASE);
  const reporter = new Reporter();

  // -- 1. Health check ------------------------------------------------------

  log('Checking API health...');
  const healthy = await api.health();
  if (!healthy) {
    logError(`API not reachable at ${API_BASE}`);
    logError('Make sure docker compose and npm run dev are running.');
    process.exit(1);
  }
  log('API is healthy.');

  log('Checking web UI...');
  try {
    const webRes = await fetch(WEB_BASE);
    if (!webRes.ok) throw new Error(`status ${webRes.status}`);
    log('Web UI is reachable.');
  } catch (e: any) {
    logError(`Web UI not reachable at ${WEB_BASE}: ${e.message}`);
    logError('Make sure npm run dev is running.');
    process.exit(1);
  }

  // -- 2. Authenticate ------------------------------------------------------

  log(`Logging in as ${EMAIL}...`);
  try {
    await api.login(EMAIL, PASSWORD);
  } catch (e: any) {
    logError(`Login failed: ${e.message}`);
    process.exit(1);
  }
  log('Authenticated successfully.');

  // -- 3. Get or create project ---------------------------------------------

  log('Finding or creating Dogfood project...');
  let projectId: string;
  let orgId: string;

  const projects = await api.listProjects();
  const existing = projects.find((p) => p.slug === 'dogfood');

  if (existing) {
    projectId = existing.id;
    orgId = existing.orgId;
    log(`Using existing Dogfood project (${projectId}).`);
  } else {
    // Need orgId to create a project
    const orgs = await api.listOrganizations();
    if (orgs.length === 0) {
      logError('No organizations found. Run the seed script first: npm run db:seed');
      process.exit(1);
    }
    orgId = orgs[0].id;

    const proj = await api.createProject(orgId, 'Dogfood', 'dogfood');
    projectId = proj.id;
    log(`Created Dogfood project (${projectId}).`);
  }

  // -- 4. Clean old tests (optional) ----------------------------------------

  if (DO_CLEAN) {
    log('Cleaning old dogfood tests...');
    try {
      const oldTests = await api.listTests(projectId, ['dogfood']);
      for (const t of oldTests) {
        await api.deleteTest(t.id);
        await sleep(200);
      }
      log(`Deleted ${oldTests.length} old tests.`);
    } catch (e: any) {
      log(`Clean skipped (${e.message}).`);
    }
  }

  // -- 5. Filter tests ------------------------------------------------------

  let tests = dogfoodTests;
  if (GROUP_FILTER) {
    tests = tests.filter(
      (t) => t.group.toLowerCase().includes(GROUP_FILTER.toLowerCase()),
    );
    log(`Filtered to ${tests.length} tests matching group "${GROUP_FILTER}".`);
  }

  if (tests.length === 0) {
    logError('No tests to run.');
    process.exit(1);
  }

  log(`Running ${tests.length} dogfood tests...\n`);

  // -- 6. Create & run each test --------------------------------------------

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const spec = tests[i];
    const prefix = `[${i + 1}/${tests.length}]`;

    // Replace localhost:3000 with WEB_BASE if custom
    const steps = spec.steps.map((s) => {
      if (s.url && WEB_BASE !== 'http://localhost:3000') {
        return { ...s, url: s.url.replace('http://localhost:3000', WEB_BASE) };
      }
      return s;
    });

    // Create the test
    let testId: string;
    try {
      const created = await api.createTest(projectId, spec.name, steps, spec.tags);
      testId = created.id;
    } catch (e: any) {
      logError(`${prefix} Failed to create "${spec.name}": ${e.message}`);
      reporter.record({
        group: spec.group,
        name: spec.name,
        testId: '',
        executionId: '',
        status: 'ERROR',
        error: `Create failed: ${e.message}`,
      });
      failed++;
      continue;
    }

    // Run the test
    let executionId: string;
    try {
      const exec = await api.runTest(testId);
      executionId = exec.id;
    } catch (e: any) {
      logError(`${prefix} Failed to run "${spec.name}": ${e.message}`);
      reporter.record({
        group: spec.group,
        name: spec.name,
        testId,
        executionId: '',
        status: 'ERROR',
        error: `Run failed: ${e.message}`,
      });
      failed++;
      await sleep(1000);
      continue;
    }

    // Poll for result
    log(`${prefix} Running "${spec.name}"...`);
    const result = await api.pollExecution(executionId, 3000, 120_000);

    const dur = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : '?';
    const statusIcon = result.status === 'PASSED' ? '✓' : '✗';

    if (result.status === 'PASSED') {
      log(`${prefix} ${statusIcon} ${spec.name} (${dur})`);
      passed++;
    } else {
      const errMsg =
        result.errorMessage ||
        (result.result as any)?.error ||
        (result.result as any)?.message ||
        result.status;
      logError(
        `${prefix} ${statusIcon} ${spec.name} — ${result.status}: ${String(errMsg).split('\n')[0].slice(0, 150)}`,
      );
      failed++;
    }

    const testResult: TestResult = {
      group: spec.group,
      name: spec.name,
      testId,
      executionId,
      status: result.status as TestResult['status'],
      duration: result.duration,
      error:
        result.status !== 'PASSED'
          ? result.errorMessage ||
            (result.result as any)?.error ||
            result.status
          : undefined,
    };
    reporter.record(testResult);

    // Rate limit buffer between tests
    if (i < tests.length - 1) {
      await sleep(2000);
    }
  }

  // -- 7. API-level AI feature tests ----------------------------------------

  if (!GROUP_FILTER || GROUP_FILTER.toLowerCase().includes('ai')) {
    log('\nRunning AI feature tests (API-level)...\n');

    const aiTests: Array<{
      group: string;
      name: string;
      run: () => Promise<{ ok: boolean; detail?: string }>;
    }> = [
      {
        group: 'AI Providers',
        name: 'List configured AI providers',
        run: async () => {
          const providers = await api.listAiProviders(projectId);
          return {
            ok: Array.isArray(providers) && providers.length > 0,
            detail: `${providers.length} provider(s) found`,
          };
        },
      },
      {
        group: 'AI Providers',
        name: 'List available Ollama models',
        run: async () => {
          const result = await api.listAiModels(
            'LOCAL',
            'http://localhost:11434/v1',
          );
          const count = result.models?.length ?? 0;
          return {
            ok: count > 0,
            detail: `${count} model(s): ${(result.models || []).map((m: any) => m.id).join(', ')}`,
          };
        },
      },
      {
        group: 'AI Providers',
        name: 'Test Ollama provider connection (Qwen3 32B)',
        run: async () => {
          const providers = await api.listAiProviders(projectId);
          const local = providers.find((p: any) => p.provider === 'LOCAL');
          if (!local) return { ok: false, detail: 'No LOCAL provider configured' };
          const result = await api.testAiProvider(local.id);
          return {
            ok: result.success === true,
            detail: result.message || `latency: ${result.latencyMs}ms`,
          };
        },
      },
      {
        group: 'AI NLP',
        name: 'Parse natural language test script',
        run: async () => {
          const result = await api.parseTestScript(
            'Go to https://example.com\nClick the login button\nTake a screenshot',
            projectId,
          );
          const stepCount = result.steps?.length ?? 0;
          return {
            ok: stepCount >= 2,
            detail: `Parsed ${stepCount} steps: ${(result.steps || []).map((s: any) => s.type).join(', ')}`,
          };
        },
      },
      {
        group: 'AI NLP',
        name: 'Parse YAML test script',
        run: async () => {
          const yaml = `- navigate: https://example.com\n- click: "#login"\n- screenshot: result`;
          const result = await api.parseTestScript(yaml, projectId, 'yaml');
          return {
            ok: (result.steps?.length ?? 0) >= 2,
            detail: `Parsed ${result.steps?.length} YAML steps`,
          };
        },
      },
      {
        group: 'AI Diff',
        name: 'Get AI diff configuration',
        run: async () => {
          const config = await api.getAiDiffConfig(projectId);
          return {
            ok: config !== null && config !== undefined,
            detail: `enabled=${config?.enabled ?? 'N/A'}, maxStage=${config?.maxStage ?? 'N/A'}`,
          };
        },
      },
      {
        group: 'AI Diff',
        name: 'Enable AI diff with VLM stage',
        run: async () => {
          const providers = await api.listAiProviders(projectId);
          const local = providers.find((p: any) => p.provider === 'LOCAL');
          const config = await api.updateAiDiffConfig({
            projectId,
            enabled: true,
            maxStage: 3,
            aiProviderId: local?.id || undefined,
          });
          return {
            ok: config?.enabled === true,
            detail: `AI diff enabled, maxStage=${config?.maxStage}`,
          };
        },
      },
    ];

    const totalAll = tests.length + aiTests.length;

    for (let i = 0; i < aiTests.length; i++) {
      const t = aiTests[i];
      const idx = tests.length + i + 1;
      const prefix = `[${idx}/${totalAll}]`;

      try {
        const start = Date.now();
        const result = await t.run();
        const dur = ((Date.now() - start) / 1000).toFixed(1);

        if (result.ok) {
          log(`${prefix} ✓ ${t.name} (${dur}s) — ${result.detail || ''}`);
          passed++;
        } else {
          logError(`${prefix} ✗ ${t.name} — ${result.detail || 'assertion failed'}`);
          failed++;
        }

        reporter.record({
          group: t.group,
          name: t.name,
          testId: '',
          executionId: '',
          status: result.ok ? 'PASSED' : 'FAILED',
          duration: Date.now() - start,
          error: result.ok ? undefined : result.detail,
        });
      } catch (e: any) {
        logError(`${prefix} ✗ ${t.name} — ${e.message.split('\n')[0].slice(0, 150)}`);
        failed++;
        reporter.record({
          group: t.group,
          name: t.name,
          testId: '',
          executionId: '',
          status: 'ERROR',
          error: e.message.split('\n')[0],
        });
      }

      await sleep(500);
    }
  }

  // -- 8. Final summary ----------------------------------------------------

  const total = passed + failed;
  console.log('');
  console.log('══════════════════════════════════════');
  console.log(`  Dogfood complete: ${passed} passed, ${failed} failed out of ${total}`);
  console.log(`  Report: ${reporter.getOutputPath()}`);
  console.log('══════════════════════════════════════');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
