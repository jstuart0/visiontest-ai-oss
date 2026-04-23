// VisionTest.ai — Exploratory Scan Runner (Phase 2)
//
// Point at a URL, enumerate clickables/links, exercise the safe ones,
// record everything as ExploreNode rows so the UI can render a live tree.
// Safety model enforced via services/scanSafety.ts.

import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { prisma, Prisma } from '@visiontest/database';
import {
  classifyElement,
  isLogout,
  shouldExercise,
  type SafetyMode,
  type SafetyOptions,
  type CandidateElement,
} from './scanSafety';
import { logger } from '../utils/logger';

export interface ScanConfig {
  executionId: string;
  startUrl: string;
  maxPages?: number;
  maxClicksPerPage?: number;
  loginSteps?: any[];
  safety?: {
    mode?: SafetyMode;
    destructivePhrases?: string[];
    allowedSelectors?: string[];
    blockedSelectors?: string[];
    allowFormSubmit?: boolean;
    stubNetworkWrites?: boolean;
    resetHookUrl?: string | null;
  };
}

export interface ScanSummary {
  pagesVisited: number;
  interactionsTried: number;
  ok: number;
  warn: number;
  fail: number;
  skipped: number;
}

export class ScanRunner {
  private browser: Browser | null = null;

  async run(config: ScanConfig): Promise<ScanSummary> {
    const maxPages = config.maxPages ?? 25;
    const maxClicks = config.maxClicksPerPage ?? 15;
    const mode: SafetyMode = config.safety?.mode ?? 'read-only';
    const safetyOpts: SafetyOptions = {
      mode,
      destructivePhrases: config.safety?.destructivePhrases,
      allowedSelectors: config.safety?.allowedSelectors,
      blockedSelectors: config.safety?.blockedSelectors,
    };

    // Sandbox mode: POST the reset hook first. Non-2xx aborts the run so
    // we never exercise destructive actions against a non-reset backend.
    if (mode === 'sandbox' && config.safety?.resetHookUrl) {
      const r = await fetch(config.safety.resetHookUrl, { method: 'POST' });
      if (!r.ok) {
        throw new Error(
          `sandbox reset hook returned ${r.status} — aborting scan`,
        );
      }
    }

    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext();
    const page = await context.newPage();

    // Optional network-write stub. Intercepts DELETE|POST|PUT|PATCH and
    // returns synthetic 200 {} so destructive buttons pressed in read-
    // only + stub mode don't actually mutate the backend.
    if (config.safety?.stubNetworkWrites) {
      await page.route('**', (route) => {
        const method = route.request().method();
        if (['DELETE', 'POST', 'PUT', 'PATCH'].includes(method)) {
          return route.fulfill({ status: 200, body: '{}' });
        }
        return route.continue();
      });
    }

    const summary: ScanSummary = {
      pagesVisited: 0,
      interactionsTried: 0,
      ok: 0,
      warn: 0,
      fail: 0,
      skipped: 0,
    };

    // Keep a visited-URL set (normalised by origin+pathname) so we don't
    // re-enumerate the same page when the crawl loops back.
    const visited = new Set<string>();
    const queue: Array<{ url: string; parentNodeId: string | null }> = [];

    try {
      // Optional login step block — run once, mutation-wise.
      if (config.loginSteps && config.loginSteps.length > 0) {
        try {
          await runLoginSteps(page, config.loginSteps);
        } catch (err) {
          logger.warn('loginSteps failed — scan continues unauthenticated', err);
        }
      }

      // Create the root node so the tree has a single origin.
      const rootNode = await prisma.exploreNode.create({
        data: {
          executionId: config.executionId,
          url: config.startUrl,
          interactionKind: 'root',
          interactionLabel: `root: ${config.startUrl}`,
          status: 'ok',
          orderIndex: 0,
          parentId: null,
        },
      });

      queue.push({ url: config.startUrl, parentNodeId: rootNode.id });

      while (queue.length > 0 && summary.pagesVisited < maxPages) {
        const next = queue.shift()!;
        const key = normalizeUrl(next.url);
        if (visited.has(key)) continue;
        visited.add(key);

        summary.pagesVisited += 1;
        await page.goto(next.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        // Let JS-rendered apps hydrate before we enumerate clickables.
        // SPAs (Next.js, React Router, etc.) render a loading shell first
        // and only wire up buttons after client-side hydration.
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);

        const candidates = await enumerateClickables(page, maxClicks);

        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i];
          summary.interactionsTried += 1;

          const decision = shouldExercise(c, mode, safetyOpts);

          if (!decision.exercise) {
            await prisma.exploreNode.create({
              data: {
                executionId: config.executionId,
                parentId: next.parentNodeId,
                url: page.url(),
                orderIndex: i,
                interactionKind: c.tag === 'a' ? 'navigate' : 'click',
                interactionLabel: `${c.tag ?? 'el'}: "${c.text.slice(0, 80)}"`,
                interactionSelector: c.selector,
                status: 'skipped',
                skipReason: decision.skipReason,
              },
            });
            summary.skipped += 1;
            continue;
          }

          // Exercise — click, observe, record.
          const pre = Date.now();
          const consoleErrors: string[] = [];
          const onConsole = (msg: any) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
          };
          page.on('console', onConsole);

          let status: 'ok' | 'warn' | 'fail' = 'ok';
          let errorText: string | null = null;
          let httpStatus: number | null = null;

          try {
            const responsePromise = page
              .waitForResponse((r) => r.url() === page.url() || r.ok(), {
                timeout: 5000,
              })
              .catch(() => null);
            await page.locator(c.selector).first().click({ timeout: 5000 });
            const resp = await responsePromise;
            if (resp) httpStatus = resp.status();
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

            // Session-loss recovery — if we land on /login with loginSteps,
            // re-auth and continue; otherwise stop exercising this page.
            if (/\/(login|signin|sign-in)$/.test(page.url()) && config.loginSteps) {
              await runLoginSteps(page, config.loginSteps).catch(() => {});
            }

            if (httpStatus && httpStatus >= 500) {
              status = 'fail';
              errorText = `HTTP ${httpStatus}`;
            } else if (consoleErrors.length > 0) {
              status = 'warn';
              errorText = consoleErrors.slice(0, 3).join(' | ');
            }
          } catch (err) {
            status = 'fail';
            errorText = err instanceof Error ? err.message : String(err);
          } finally {
            page.off('console', onConsole);
          }

          if (status === 'ok') summary.ok += 1;
          else if (status === 'warn') summary.warn += 1;
          else summary.fail += 1;

          await prisma.exploreNode.create({
            data: {
              executionId: config.executionId,
              parentId: next.parentNodeId,
              url: page.url(),
              orderIndex: i,
              interactionKind: c.tag === 'a' ? 'navigate' : 'click',
              interactionLabel: `${c.tag ?? 'el'}: "${c.text.slice(0, 80)}"`,
              interactionSelector: c.selector,
              status,
              errorText: errorText,
              httpStatus,
              consoleErrors: consoleErrors.length
                ? (consoleErrors as unknown as Prisma.InputJsonValue)
                : undefined,
              durationMs: Date.now() - pre,
            },
          });

          // New same-origin page? Enqueue for further scanning.
          if (c.tag === 'a' && page.url() !== next.url) {
            try {
              const dest = new URL(page.url());
              const origin = new URL(config.startUrl);
              if (dest.origin === origin.origin) {
                queue.push({ url: page.url(), parentNodeId: next.parentNodeId });
              }
            } catch {
              // ignore non-URL
            }
            // Go back so remaining candidates on this page still match.
            await page.goBack({ timeout: 5000 }).catch(() => {});
          }
        }
      }
    } finally {
      try {
        await context.close();
      } catch {
        // best-effort
      }
      try {
        await this.browser?.close();
      } catch {
        // best-effort
      }
      this.browser = null;
    }

    return summary;
  }
}

/**
 * Replay a minimal loginSteps array. Supports navigate, type, click — the
 * subset likely to appear in a session-establishing block.
 */
async function runLoginSteps(page: Page, steps: any[]): Promise<void> {
  for (const step of steps) {
    switch (step.type) {
      case 'navigate':
        await page.goto(step.url, { waitUntil: 'domcontentloaded' });
        break;
      case 'type':
        await page.fill(step.selector, step.value || '');
        break;
      case 'click':
        await page.click(step.selector);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        break;
      case 'waitFor':
        await page.waitForSelector(step.selector, { timeout: 10000 });
        break;
      default:
        break;
    }
  }
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return u;
  }
}

/**
 * Enumerate interactable elements on the current page: buttons, links,
 * role=button elements. Capped at `limit` per page.
 *
 * The per-element metadata is enough for the safety classifier to judge
 * destructiveness without a second round-trip: text, tag, aria, testid,
 * marker attributes, nearest form action, nearest heading.
 */
async function enumerateClickables(
  page: Page,
  limit: number,
): Promise<Array<CandidateElement & { tag: string }>> {
  // NB: the function body ships as-is to the browser via Playwright's
  // CDP evaluate. tsx/esbuild injects __name() wrappers for any NAMED
  // function expression (including `function foo(){}` inside evaluate).
  // Use an anonymous arrow with no inner helpers to sidestep this
  // entirely — every operation inlined into the single closure.
  return page.evaluate((limit: number) => {
    const out: Array<any> = [];
    const nodes = Array.from(
      document.querySelectorAll(
        'button, a[href], [role="button"], input[type="submit"]',
      ),
    ).slice(0, limit);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const e = n as HTMLElement;
      const tag = e.tagName.toLowerCase();
      const text = (e.innerText || e.textContent || '').trim();

      let selector = tag;
      if (e.id) {
        selector = '#' + e.id.replace(/([^\w-])/g, '\\$1');
      } else {
        const testId = e.getAttribute('data-testid');
        if (testId) {
          selector = '[data-testid="' + testId.replace(/"/g, '\\"') + '"]';
        } else if (text) {
          selector = tag + ':has-text("' + text.slice(0, 60).replace(/"/g, '\\"') + '")';
        }
      }

      const formEl = e.closest('form');
      const modalRoot = e.closest('[role="dialog"], dialog, .modal');
      const heading = modalRoot
        ? modalRoot.querySelector('h1,h2,h3,[role="heading"]')
        : null;

      const markerAttrs: string[] = [];
      const attrNames = e.getAttributeNames();
      for (let j = 0; j < attrNames.length; j++) {
        const a = attrNames[j];
        if (a === 'data-confirm' || a === 'data-destructive' || a === 'data-mutation') {
          markerAttrs.push(a);
        }
      }

      out.push({
        text,
        tag,
        selector,
        ariaLabel: e.getAttribute('aria-label') || undefined,
        testId: e.getAttribute('data-testid') || undefined,
        markerAttrs,
        formAction: formEl ? formEl.getAttribute('action') || undefined : undefined,
        nearestHeading: heading ? (heading as HTMLElement).innerText : undefined,
      });
    }
    return out;
  }, limit) as unknown as Array<CandidateElement & { tag: string }>;
}

// Unused, but re-exported for tests that want to inspect private heuristics.
export { classifyElement, isLogout };

export default { ScanRunner };
