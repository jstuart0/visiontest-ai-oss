// VisionTest.ai — Goal Compiler (Layer-1 deterministic)
//
// Compiles free-form goal text into concrete runnable checks. A goal is a
// first-class part of a story test: when `test.goal` is set, the goal MUST
// be verified. Layer 1 (this file) handles the cases the regex parser can
// turn into a concrete assertion — no LLM required. Sentences we cannot
// compile are held as `unresolvedClauses` so the API can decide whether to
// block save (no LLM configured) or delegate to Layer 2 (LLM configured).

import type { TestStep } from './tests.service';

export type GoalCheckKind =
  | 'url'             // page URL match (is, contains, endsWith)
  | 'visible'         // text is visible on the page
  | 'hidden'          // text is NOT visible on the page
  | 'enabled'         // element (by id/selector) is enabled
  | 'disabled'        // element (by id/selector) is disabled
  | 'count';          // element count equals N

export type UrlOp = 'is' | 'contains' | 'endsWith' | 'startsWith';

export interface GoalCheck {
  kind: GoalCheckKind;
  /** Compiled selector (for visible/hidden/enabled/disabled/count). */
  selector?: string;
  /** The target value for comparison (url value, count, text). */
  value?: string;
  /** URL-only: comparison mode. */
  urlOp?: UrlOp;
  /** Original sentence/clause this check was compiled from — for debugging. */
  source: string;
}

export interface CompileResult {
  checks: GoalCheck[];
  unresolvedClauses: string[];
}

/**
 * Split a goal paragraph into clause-sized sentences we can match one at a
 * time. Honors semicolons, line-breaks, and sentence-final periods, but
 * does NOT split inside URLs (https://example.com/x) or quoted fragments
 * ("foo. bar") — both of which commonly contain periods that are part of
 * the token, not clause boundaries.
 */
function splitGoalIntoClauses(goal: string): string[] {
  const text = goal.replace(/\r/g, '').trim();
  if (!text) return [];

  const clauses: string[] = [];
  let buf = '';
  let inQuote: '"' | "'" | null = null;

  // Temporary placeholder to protect URL dots from splitting.
  const urlPlaceholder = '\x00URLDOT\x00';
  const urlPattern = /\b(?:https?:\/\/|\/\/)[^\s]+/gi;
  const urls: string[] = [];
  const protectedText = text.replace(urlPattern, (match) => {
    urls.push(match);
    return match.replace(/\./g, urlPlaceholder);
  });

  const push = () => {
    const s = buf.trim().replace(new RegExp(urlPlaceholder, 'g'), '.');
    if (s) clauses.push(s);
    buf = '';
  };

  for (let i = 0; i < protectedText.length; i++) {
    const c = protectedText[i];
    if (inQuote) {
      buf += c;
      if (c === inQuote) inQuote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inQuote = c;
      buf += c;
      continue;
    }
    if (c === '.' || c === '\n' || c === ';') {
      push();
      continue;
    }
    // "and" that joins clauses. Only split when the preceding buffer looks
    // like a complete clause (contains a verb-like token) to avoid
    // breaking "go to line and copy ref" etc.
    if (
      c === ' ' &&
      protectedText.substring(i + 1, i + 5).toLowerCase() === 'and '
    ) {
      const next = protectedText.substring(i + 5, i + 25);
      // Heuristic: split before "and" if the next word starts a new
      // clause (capital letter, quote, or known starter keyword).
      // Uppercase test is case-sensitive; keyword test is case-insensitive.
      if (/^["']/.test(next) || /^[A-Z]/.test(next) || /^(?:the|no|url|page)\b/i.test(next)) {
        push();
        i += 4; // skip " and"
        continue;
      }
    }
    buf += c;
  }
  push();
  return clauses;
}

/**
 * Compile a text-visibility phrase. We accept quoted targets and bare-word
 * fragments. Returned selector is always a Playwright text selector so the
 * assert step type can pick it up directly (see §5 in the plan).
 */
function compileTextSelector(rawTarget: string): string {
  const trimmed = rawTarget
    .trim()
    .replace(/^(?:the\s+text\s+|the\s+)/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/^["']|["']$/g, ''); // handle any residual quote after stripping prefix
  return `text=${trimmed}`;
}

/**
 * Compile a single sentence into a goal check. Returns null if no pattern
 * matches — caller marks as unresolved.
 */
function compileClause(clause: string): GoalCheck | null {
  const s = clause.trim();

  // URL patterns ---------------------------------------------------
  const urlIs = s.match(
    /^(?:the\s+)?url\s+(?:is|equals|should\s+be)\s+["']?([^"']+?)["']?$/i,
  );
  if (urlIs) {
    return { kind: 'url', urlOp: 'is', value: urlIs[1].trim(), source: clause };
  }
  const urlContains = s.match(
    /^(?:the\s+)?url\s+(?:contains|includes|has)\s+["']?([^"']+?)["']?$/i,
  );
  if (urlContains) {
    return {
      kind: 'url',
      urlOp: 'contains',
      value: urlContains[1].trim(),
      source: clause,
    };
  }
  const urlEnds = s.match(
    /^(?:the\s+)?url\s+ends?\s+with\s+["']?([^"']+?)["']?$/i,
  );
  if (urlEnds) {
    return {
      kind: 'url',
      urlOp: 'endsWith',
      value: urlEnds[1].trim(),
      source: clause,
    };
  }
  const urlStarts = s.match(
    /^(?:the\s+)?url\s+starts?\s+with\s+["']?([^"']+?)["']?$/i,
  );
  if (urlStarts) {
    return {
      kind: 'url',
      urlOp: 'startsWith',
      value: urlStarts[1].trim(),
      source: clause,
    };
  }
  const landsOn = s.match(
    /^(?:(?:the\s+page\s+)?(?:lands?|navigates?)\s+(?:on|to))\s+["']?([^"']+?)["']?$/i,
  );
  if (landsOn) {
    const target = landsOn[1].trim();
    const op: UrlOp = target.includes('://') ? 'is' : 'contains';
    return { kind: 'url', urlOp: op, value: target, source: clause };
  }

  // Hidden / NOT visible — check BEFORE visible (more specific) -----
  const notVisible = s.match(
    /^(?:(?:verify|check|assert|expect)\s+(?:that\s+)?)?(?:there\s+is\s+no|no)\s+["']?(.+?)["']?\s*(?:\s+visible)?$/i,
  );
  if (notVisible) {
    return {
      kind: 'hidden',
      selector: compileTextSelector(notVisible[1]),
      source: clause,
    };
  }
  const isNotVisible = s.match(
    /^(?:(?:verify|check|assert|expect)\s+(?:that\s+)?)?["']?(.+?)["']?\s+is\s+(?:not\s+visible|hidden)$/i,
  );
  if (isNotVisible) {
    return {
      kind: 'hidden',
      selector: compileTextSelector(isNotVisible[1]),
      source: clause,
    };
  }
  const doesNotShow = s.match(
    /^(?:the\s+page\s+)?does\s+not\s+show\s+["']?(.+?)["']?$/i,
  );
  if (doesNotShow) {
    return {
      kind: 'hidden',
      selector: compileTextSelector(doesNotShow[1]),
      source: clause,
    };
  }

  // Visible ---------------------------------------------------------
  const isVisible = s.match(
    /^(?:(?:verify|check|assert|expect)\s+(?:that\s+)?)?["']?(.+?)["']?\s+(?:is\s+visible|is\s+shown|appears)$/i,
  );
  if (isVisible) {
    return {
      kind: 'visible',
      selector: compileTextSelector(isVisible[1]),
      source: clause,
    };
  }
  const pageShows = s.match(
    /^(?:the\s+page\s+)?shows?\s+["']?(.+?)["']?$/i,
  );
  if (pageShows) {
    return {
      kind: 'visible',
      selector: compileTextSelector(pageShows[1]),
      source: clause,
    };
  }

  // Enabled / disabled — selectors only (#id or .class or [attr]) ---
  const enabled = s.match(
    /^(?:(?:element|button)\s+)?([#.\[][^\s]+)\s+is\s+enabled$/i,
  );
  if (enabled) {
    return { kind: 'enabled', selector: enabled[1], source: clause };
  }
  const disabled = s.match(
    /^(?:(?:element|button)\s+)?([#.\[][^\s]+)\s+is\s+disabled$/i,
  );
  if (disabled) {
    return { kind: 'disabled', selector: disabled[1], source: clause };
  }

  // Count — "N items are shown", "3 rows visible", "5 results"
  const count = s.match(
    /^(\d+)\s+(items?|rows?|results?|entries|cards?|tiles?|records?)\s+(?:are|is)?\s*(?:visible|shown|listed|displayed)?$/i,
  );
  if (count) {
    // Heuristic selector fallback — use a generic list-item selector
    const kind = count[2].toLowerCase();
    const selector = kind.startsWith('row')
      ? 'tr'
      : kind.startsWith('item')
        ? 'li'
        : kind.startsWith('card') || kind.startsWith('tile')
          ? '[data-testid*="card"], [class*="card"]'
          : '[data-testid*="row"], [data-testid*="result"], [class*="result"]';
    return {
      kind: 'count',
      selector,
      value: count[1],
      source: clause,
    };
  }

  return null;
}

/**
 * Compile a goal block into Layer-1 checks. Clauses that don't match any
 * pattern are returned as `unresolvedClauses` for the caller to decide.
 */
export function compileGoal(goal: string): CompileResult {
  const clauses = splitGoalIntoClauses(goal);
  const checks: GoalCheck[] = [];
  const unresolvedClauses: string[] = [];

  for (const clause of clauses) {
    const check = compileClause(clause);
    if (check) {
      checks.push(check);
    } else {
      unresolvedClauses.push(clause);
    }
  }

  return { checks, unresolvedClauses };
}

/**
 * Does this goal compile to something? Used by the save endpoint to decide
 * whether to block on unresolved clauses (no LLM) or let them through to
 * Layer 2 (LLM configured).
 */
export function hasUnresolvedClauses(goal: string): boolean {
  return compileGoal(goal).unresolvedClauses.length > 0;
}

/**
 * Emit the pattern-vocabulary reference shown in the UI's help drawer.
 * Source-of-truth for the supported patterns.
 */
export const GOAL_PATTERN_REFERENCE: Array<{
  pattern: string;
  example: string;
  compiles: string;
}> = [
  {
    pattern: 'The URL is/contains/ends with/starts with X',
    example: 'The URL contains /orders/42',
    compiles: 'url contains "/orders/42"',
  },
  {
    pattern: 'The page lands on / navigates to X',
    example: 'The page lands on /dashboard',
    compiles: 'url contains "/dashboard"',
  },
  {
    pattern: '"X" is visible / X is shown / the page shows X',
    example: '"Welcome back" is visible',
    compiles: 'assert text="Welcome back" visible',
  },
  {
    pattern: 'X is NOT visible / is hidden / no X',
    example: '"Error" is not visible',
    compiles: 'assert text="Error" hidden',
  },
  {
    pattern: '#selector is enabled / disabled',
    example: '#submit-btn is enabled',
    compiles: 'assert #submit-btn enabled',
  },
  {
    pattern: 'N rows / items / results / cards visible',
    example: '5 results are visible',
    compiles: 'assert count=5 on [data-testid*="result"]',
  },
];

// Compatibility alias for callers that want a TestStep form directly. We
// compile on the fly for any caller that wants it. Not used yet — kept
// because it will become the adapter for Layer-1 → existing `assert`
// step type once we need to embed checks into the step array (future).
export function goalCheckToAssertStep(check: GoalCheck): TestStep | null {
  switch (check.kind) {
    case 'visible':
      return {
        type: 'assert',
        selector: check.selector,
        assertion: 'visible',
      };
    case 'hidden':
      return {
        type: 'assert',
        selector: check.selector,
        assertion: 'hidden',
      };
    case 'enabled':
      return {
        type: 'assert',
        selector: check.selector,
        assertion: 'enabled',
      };
    case 'disabled':
      return {
        type: 'assert',
        selector: check.selector,
        assertion: 'disabled',
      };
    case 'count':
      return {
        type: 'assert',
        selector: check.selector,
        assertion: 'count',
        value: check.value,
      };
    case 'url':
      // URL checks aren't a step type — evaluated in the runner end-of-run.
      return null;
  }
}

export default {
  compileGoal,
  hasUnresolvedClauses,
  GOAL_PATTERN_REFERENCE,
  goalCheckToAssertStep,
};
