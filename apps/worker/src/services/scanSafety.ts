// VisionTest.ai — Scan Safety Classifier (Phase 2)
//
// Used by the exploratory scan to decide whether a given interactable
// element is safe to exercise. Default mode is `read-only`: destructive
// elements are skipped, not silently omitted — the UI surfaces them in
// the result tree with the reason so users can allowlist or fix.
//
// The classifier is pure regex/string heuristics; no LLM required.

export type SafetyMode = 'read-only' | 'allow-destructive' | 'sandbox';

export interface SafetyOptions {
  mode?: SafetyMode;
  destructivePhrases?: string[];
  allowedSelectors?: string[];
  blockedSelectors?: string[];
}

export interface CandidateElement {
  /** Visible text of the element (button label, link text, etc.) */
  text: string;
  /** The selector we'd click — used for allow/block overrides. */
  selector: string;
  /** HTML tag name — 'button' | 'a' | 'input' | etc. */
  tag?: string;
  /** aria-label when present. */
  ariaLabel?: string;
  /** data-testid when present. */
  testId?: string;
  /** data-* marker attributes (e.g. data-confirm, data-destructive). */
  markerAttrs?: string[];
  /** Parent form's action URL, when the element is form-scoped. */
  formAction?: string;
  /** Nearest heading text (for modal confirm detection). */
  nearestHeading?: string;
}

export interface ClassificationResult {
  destructive: boolean;
  reason?: string;
  matchedPhrase?: string;
}

const DEFAULT_DESTRUCTIVE = [
  'delete',
  'remove',
  'destroy',
  'drop',
  'purge',
  'revoke',
  'cancel',
  'unsubscribe',
  'deactivate',
  'archive',
  'ban',
  'kick',
  'log out',
  'sign out',
  'logout',
  'signout',
  'send',
  'submit',
  'pay',
  'charge',
  'checkout',
  'confirm order',
  'invite',
  'email',
  'publish',
  'deploy',
  'restart',
  'reboot',
  'shutdown',
];

const LOGOUT_PHRASES = ['log out', 'sign out', 'logout', 'signout'];

const FORM_ACTION_REGEX =
  /\/api\/.*\/(delete|remove|destroy|cancel|pay|submit|send)/i;

const MARKER_ATTRS = new Set([
  'data-confirm',
  'data-destructive',
  'data-mutation',
]);

export function buildDestructiveRegex(
  phrases: string[] = DEFAULT_DESTRUCTIVE,
): RegExp {
  // Escape then word-boundary each phrase. Allows flexible whitespace for
  // multi-word phrases like "log out".
  const escaped = phrases.map((p) =>
    p
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+'),
  );
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i');
}

/**
 * Classify an element as destructive or safe. Returns the matching reason
 * so it can be surfaced in the scan result tree — "destructive: matched
 * 'delete'".
 */
export function classifyElement(
  el: CandidateElement,
  opts: SafetyOptions = {},
): ClassificationResult {
  // Explicit overrides take precedence.
  if (opts.blockedSelectors?.includes(el.selector)) {
    return { destructive: true, reason: 'blockedSelectors override' };
  }
  if (opts.allowedSelectors?.includes(el.selector)) {
    return { destructive: false };
  }

  const phrases = [
    ...DEFAULT_DESTRUCTIVE,
    ...(opts.destructivePhrases || []),
  ];
  const regex = buildDestructiveRegex(phrases);

  const textMatch = regex.exec(el.text || '');
  if (textMatch) {
    return {
      destructive: true,
      reason: `text match "${textMatch[0]}"`,
      matchedPhrase: textMatch[0],
    };
  }
  const ariaMatch = regex.exec(el.ariaLabel || '');
  if (ariaMatch) {
    return {
      destructive: true,
      reason: `aria-label match "${ariaMatch[0]}"`,
      matchedPhrase: ariaMatch[0],
    };
  }
  const testIdMatch = regex.exec(el.testId || '');
  if (testIdMatch) {
    return {
      destructive: true,
      reason: `data-testid match "${testIdMatch[0]}"`,
      matchedPhrase: testIdMatch[0],
    };
  }
  if (el.formAction && FORM_ACTION_REGEX.test(el.formAction)) {
    return {
      destructive: true,
      reason: `form action ${el.formAction} matches destructive API path`,
    };
  }
  if (el.markerAttrs && el.markerAttrs.some((a) => MARKER_ATTRS.has(a))) {
    return {
      destructive: true,
      reason: `marker attribute ${el.markerAttrs.find((a) => MARKER_ATTRS.has(a))}`,
    };
  }
  if (
    el.nearestHeading &&
    /\b(confirm|are you sure|delete)\b/i.test(el.nearestHeading)
  ) {
    return {
      destructive: true,
      reason: `inside confirm modal: "${el.nearestHeading}"`,
    };
  }
  return { destructive: false };
}

/**
 * Is this element a logout trigger? We always re-route to loginSteps
 * rather than actually logging out mid-scan — see plan §6.
 */
export function isLogout(el: CandidateElement): boolean {
  const regex = buildDestructiveRegex(LOGOUT_PHRASES);
  return (
    regex.test(el.text || '') ||
    regex.test(el.ariaLabel || '') ||
    regex.test(el.testId || '')
  );
}

/**
 * Should we click this element given the safety mode + classification?
 * Used by the scan runner to branch — either exercise, skip with reason,
 * or rewrite to loginSteps for logout recovery.
 */
export function shouldExercise(
  el: CandidateElement,
  mode: SafetyMode,
  opts: SafetyOptions = {},
): { exercise: boolean; skipReason?: string } {
  if (isLogout(el)) {
    // Always skip logout unless loginSteps was provided (checked by the
    // scan runner — this function just reports "logout skip").
    return { exercise: false, skipReason: 'logout protection' };
  }
  const cls = classifyElement(el, opts);
  if (!cls.destructive) return { exercise: true };

  switch (mode) {
    case 'read-only':
      return { exercise: false, skipReason: `read-only: ${cls.reason}` };
    case 'allow-destructive':
    case 'sandbox':
      return { exercise: true };
  }
}

export default {
  classifyElement,
  isLogout,
  shouldExercise,
  buildDestructiveRegex,
};
