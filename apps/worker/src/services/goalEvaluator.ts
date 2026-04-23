// VisionTest.ai — Goal Evaluator (Layer-1 runtime)
//
// Executes the Layer-1 goal checks stored on Test.goalChecks at the end of
// every story run. Layer 1 is deterministic — no LLM required. Layer 2
// (LLM semantic eval) can be added later but is NOT a precondition for
// goal enforcement: any test whose goal compiles to Layer-1 checks works
// offline with no AI provider configured.

import type { Page } from 'playwright';
import { expect } from 'playwright/test';
import { logger } from '../utils/logger';

export type GoalCheckKind =
  | 'url'
  | 'visible'
  | 'hidden'
  | 'enabled'
  | 'disabled'
  | 'count';

export type UrlOp = 'is' | 'contains' | 'endsWith' | 'startsWith';

export interface GoalCheck {
  kind: GoalCheckKind;
  selector?: string;
  value?: string;
  urlOp?: UrlOp;
  source: string;
}

export interface GoalCheckResult extends GoalCheck {
  passed: boolean;
  error?: string;
  actual?: string;
}

export interface GoalEvalResult {
  goalAchieved: boolean;
  reasoning: string;
  checks: GoalCheckResult[];
}

/**
 * Evaluate a list of compiled Layer-1 goal checks against the page's final
 * state. Returns per-check result + overall pass/fail.
 */
export async function evaluateGoal(
  page: Page,
  checks: GoalCheck[],
  options: { timeoutMs?: number } = {},
): Promise<GoalEvalResult> {
  const timeout = options.timeoutMs ?? 5000;
  const results: GoalCheckResult[] = [];

  for (const check of checks) {
    const result = await runCheck(page, check, timeout);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const goalAchieved = failed === 0 && results.length > 0;

  const reasoning = buildReasoning(results, goalAchieved);

  return { goalAchieved, reasoning, checks: results };
}

async function runCheck(
  page: Page,
  check: GoalCheck,
  timeout: number,
): Promise<GoalCheckResult> {
  try {
    switch (check.kind) {
      case 'url': {
        // Poll for up to `timeout` — the URL may still be settling from
        // an async nav that the preceding click() didn't await.
        const deadline = Date.now() + timeout;
        let actualUrl = page.url();
        let passed = checkUrl(actualUrl, check.urlOp!, check.value!);
        let iterations = 0;
        while (!passed && Date.now() < deadline) {
          await page.waitForTimeout(250);
          actualUrl = page.url();
          passed = checkUrl(actualUrl, check.urlOp!, check.value!);
          iterations++;
        }
        logger.info(
          `goal url check: op=${check.urlOp} value=${check.value} passed=${passed} actual=${actualUrl} iterations=${iterations}`,
        );
        return { ...check, passed, actual: actualUrl };
      }

      case 'visible': {
        const locator = page.locator(check.selector!).first();
        await expect(locator).toBeVisible({ timeout });
        return { ...check, passed: true };
      }

      case 'hidden': {
        const locator = page.locator(check.selector!).first();
        // toBeHidden() waits for the element to be hidden/absent.
        await expect(locator).toBeHidden({ timeout });
        return { ...check, passed: true };
      }

      case 'enabled': {
        const locator = page.locator(check.selector!).first();
        await expect(locator).toBeEnabled({ timeout });
        return { ...check, passed: true };
      }

      case 'disabled': {
        const locator = page.locator(check.selector!).first();
        await expect(locator).toBeDisabled({ timeout });
        return { ...check, passed: true };
      }

      case 'count': {
        const expected = parseInt(check.value!, 10);
        const locator = page.locator(check.selector!);
        await expect(locator).toHaveCount(expected, { timeout });
        return { ...check, passed: true };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`Goal check failed: ${check.source} — ${msg}`);
    return {
      ...check,
      passed: false,
      error: msg,
    };
  }
}

function checkUrl(actual: string, op: UrlOp, expected: string): boolean {
  switch (op) {
    case 'is':
      return actual === expected;
    case 'contains':
      return actual.includes(expected);
    case 'endsWith':
      return actual.endsWith(expected);
    case 'startsWith':
      return actual.startsWith(expected);
  }
}

function buildReasoning(results: GoalCheckResult[], achieved: boolean): string {
  if (results.length === 0) {
    return 'No goal checks were configured.';
  }
  const failed = results.filter((r) => !r.passed);
  if (achieved) {
    return `Goal achieved. All ${results.length} check${results.length === 1 ? '' : 's'} passed.`;
  }
  const lines = failed.map((r) => {
    const label = formatCheckLabel(r);
    return `  ✗ ${label} — ${r.error || 'not satisfied'}`;
  });
  return `Goal NOT achieved. ${failed.length} of ${results.length} check${results.length === 1 ? '' : 's'} failed:\n${lines.join('\n')}`;
}

function formatCheckLabel(r: GoalCheckResult): string {
  switch (r.kind) {
    case 'url':
      return `URL ${r.urlOp} "${r.value}" (actual: "${r.actual}")`;
    case 'visible':
      return `${r.selector} visible`;
    case 'hidden':
      return `${r.selector} hidden`;
    case 'enabled':
      return `${r.selector} enabled`;
    case 'disabled':
      return `${r.selector} disabled`;
    case 'count':
      return `${r.selector} count=${r.value}`;
  }
}

export default { evaluateGoal };
