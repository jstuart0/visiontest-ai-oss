// VisionTest.ai — Bug Report Import (Phase 1c)
//
// Pastes from Jira / GitHub / Slack / raw markdown. Heuristic-first — no
// LLM required. The regex extractor looks for the standard "Steps to
// reproduce / Expected / Actual" sections most bug reports follow. When
// an LLM is configured the worker can enhance noisy input; that's a
// future hook, not a precondition.

export type ImportSource = 'jira' | 'github' | 'slack' | 'markdown';

export interface ImportResult {
  /** One-line title extracted from the document, or null. */
  title: string | null;
  /** Steps-to-reproduce, converted to story sentences. */
  story: string;
  /** Expected outcome → used as the goal (pattern vocabulary if possible). */
  goal: string;
  /** Actual-behaviour text, converted to "NOT visible" assertions. */
  negativeAssertions: string[];
  /** Diagnostics — each line the importer couldn't classify. */
  leftoverLines: string[];
}

/**
 * Extract story / goal / negatives from free-form bug-report text.
 */
export function importBugReport(
  text: string,
  source: ImportSource = 'markdown',
): ImportResult {
  const normalized = text.replace(/\r\n/g, '\n').trim();

  const title = extractTitle(normalized);
  const sections = extractSections(normalized);

  const steps = linesToSteps(sections.steps);
  const goal = sections.expected ? expectedToGoal(sections.expected) : '';
  const negatives = linesToNegatives(sections.actual);

  const used = new Set<string>([
    ...(sections.steps || '').split('\n'),
    ...(sections.expected || '').split('\n'),
    ...(sections.actual || '').split('\n'),
  ]);
  const leftoverLines = normalized
    .split('\n')
    .filter((l) => l.trim() && !used.has(l) && !isHeading(l));

  return {
    title,
    story: steps.join('\n'),
    goal,
    negativeAssertions: negatives,
    leftoverLines,
  };
}

/**
 * Pick the first heading-like line as the title (# foo, == foo ==,
 * "Summary: …", plain uppercase first line).
 */
function extractTitle(text: string): string | null {
  const firstTen = text.split('\n').slice(0, 10);
  for (const line of firstTen) {
    const l = line.trim();
    const h1 = l.match(/^#{1,3}\s+(.+)$/);
    if (h1) return h1[1].trim();
    const summary = l.match(/^Summary\s*[:\-]\s*(.+)$/i);
    if (summary) return summary[1].trim();
    const bug = l.match(/^Bug\s*[:\-]\s*(.+)$/i);
    if (bug) return bug[1].trim();
  }
  const first = text.split('\n').find((l) => l.trim());
  return first && first.length < 140 ? first.trim() : null;
}

/**
 * Split the document into the three canonical bug-report sections.
 * Recognises heading variants: "## Steps to Reproduce", "**Steps**",
 * "Expected behaviour", "Actual:", bullet markers, etc.
 */
function extractSections(text: string): {
  steps?: string;
  expected?: string;
  actual?: string;
} {
  const lines = text.split('\n');

  const headings = {
    steps: /^(?:#{1,3}\s*)?(?:\*\*)?(?:steps\s*(?:to\s*reproduce)?|repro|reproduction|how\s+to\s+reproduce)[:\s]*(?:\*\*)?$/i,
    expected: /^(?:#{1,3}\s*)?(?:\*\*)?(?:expected(?:\s+(?:result|behaviou?r|outcome))?)[:\s]*(?:\*\*)?$/i,
    actual: /^(?:#{1,3}\s*)?(?:\*\*)?(?:actual(?:\s+(?:result|behaviou?r))?|observed)[:\s]*(?:\*\*)?$/i,
  };

  let current: 'steps' | 'expected' | 'actual' | null = null;
  const buckets: Record<string, string[]> = {
    steps: [],
    expected: [],
    actual: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (headings.steps.test(trimmed)) {
      current = 'steps';
      continue;
    }
    if (headings.expected.test(trimmed)) {
      current = 'expected';
      continue;
    }
    if (headings.actual.test(trimmed)) {
      current = 'actual';
      continue;
    }
    if (isOtherHeading(trimmed)) {
      current = null;
      continue;
    }
    if (current && trimmed) {
      buckets[current].push(line);
    }
  }

  return {
    steps: buckets.steps.join('\n').trim() || undefined,
    expected: buckets.expected.join('\n').trim() || undefined,
    actual: buckets.actual.join('\n').trim() || undefined,
  };
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim()) || /^\*\*.*\*\*$/.test(line.trim());
}
function isOtherHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line) || /^\*\*[^*]+\*\*\s*$/.test(line);
}

/**
 * Convert a steps-to-reproduce block into story sentences. Strips the
 * numeric / bullet prefixes that bug reports always use, so each line
 * reads like a natural-language instruction the parser can compile.
 */
function linesToSteps(block: string | undefined): string[] {
  if (!block) return [];
  return block
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^\s*\d+[.)]\s+/, '')
        .replace(/^\s*Step\s*\d+\s*[:.]\s*/i, '')
        .trim(),
    )
    .filter((l) => l.length > 0);
}

/**
 * Convert expected-result prose into goal clauses in the pattern
 * vocabulary when possible. Falls back to the raw line so the compiler
 * can mark it unresolved, giving the user a visible nudge to rewrite.
 */
function expectedToGoal(block: string): string {
  const lines = linesToSteps(block); // same stripping logic
  const out: string[] = [];
  for (const line of lines) {
    // "user is redirected to /x" → "The URL contains /x"
    const redirected = line.match(/redirected\s+to\s+(\S+)/i);
    if (redirected) {
      out.push(`The URL contains ${redirected[1].replace(/[.,;]$/, '')}`);
      continue;
    }
    // "X is displayed/shown/visible"
    const shown = line.match(
      /(?:"([^"]+)"|([A-Za-z][\w\s]+?))\s+(?:is\s+)?(?:displayed|shown|visible)/i,
    );
    if (shown) {
      const target = shown[1] || shown[2];
      out.push(`"${target.trim()}" is visible`);
      continue;
    }
    // "should see X" / "sees X" → "X is visible"
    const sees = line.match(/(?:should\s+)?sees?\s+"?([^"]+?)"?\s*$/i);
    if (sees) {
      out.push(`"${sees[1].trim()}" is visible`);
      continue;
    }
    // "Page shows X" / "page shows X" → "X is visible"
    const shows = line.match(
      /(?:page|screen|app)\s+shows?\s+"?([^"]+?)"?\s*$/i,
    );
    if (shows) {
      out.push(`"${shows[1].trim()}" is visible`);
      continue;
    }
    // Otherwise pass through — the goal compiler will mark unresolved.
    out.push(line);
  }
  return out.join('. ');
}

/**
 * Convert actual-result prose into "X is NOT visible" assertions. Bug
 * reports describe current-broken state; our regression test asserts it
 * no longer appears.
 */
function linesToNegatives(block: string | undefined): string[] {
  if (!block) return [];
  const lines = linesToSteps(block);
  return lines.map((l) => {
    // Quoted error text → "text" is NOT visible
    const quoted = l.match(/"([^"]+)"/);
    if (quoted) return `"${quoted[1]}" is NOT visible`;
    // "Error: foo bar" → "Error: foo bar" is NOT visible
    const errMsg = l.match(/^(?:error|warning|failure)\s*[:\-]?\s*(.+)$/i);
    if (errMsg) return `"${errMsg[1].trim()}" is NOT visible`;
    return l;
  });
}

export default { importBugReport };
