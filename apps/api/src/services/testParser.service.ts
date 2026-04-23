// VisionTest.ai - Test Script Parser Service
// Supports: Natural Language (AI) and YAML DSL

import { TestStep } from './tests.service';
import { logger } from '../utils/logger';
import * as yaml from 'js-yaml';

// =============================================================================
// TYPES
// =============================================================================

export interface ParseResult {
  steps: TestStep[];
  warnings?: string[];
}

// =============================================================================
// YAML DSL PARSER
// =============================================================================

/**
 * Parse YAML test script into steps.
 * 
 * Example YAML format:
 * ```yaml
 * - navigate: https://example.com
 * - click: "#login-button"
 * - type:
 *     selector: "#username"
 *     value: "testuser"
 * - type:
 *     selector: "#password"  
 *     value: "secret123"
 * - click: "button[type=submit]"
 * - waitFor: ".dashboard"
 * - assert:
 *     selector: ".welcome-message"
 *     contains: "Welcome"
 * - screenshot: "login-complete"
 * ```
 */
export function parseYamlScript(yamlContent: string): ParseResult {
  const warnings: string[] = [];
  const steps: TestStep[] = [];

  try {
    const parsed = yaml.load(yamlContent) as any[];

    if (!Array.isArray(parsed)) {
      throw new Error('YAML must be a list of steps');
    }

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const stepNum = i + 1;

      try {
        const step = parseYamlStep(item);
        steps.push(step);
      } catch (err: any) {
        warnings.push(`Step ${stepNum}: ${err.message}`);
      }
    }

    return { steps, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (err: any) {
    throw new Error(`Invalid YAML: ${err.message}`);
  }
}

function parseYamlStep(item: any): TestStep {
  if (typeof item === 'string') {
    // Short form: "- navigate: https://..."
    throw new Error('Invalid step format');
  }

  const keys = Object.keys(item);
  if (keys.length !== 1) {
    throw new Error('Each step must have exactly one action');
  }

  const action = keys[0];
  const value = item[action];

  switch (action) {
    case 'navigate':
    case 'goto':
    case 'visit':
      return { type: 'navigate', url: String(value) };

    case 'click':
      if (typeof value === 'string') {
        return { type: 'click', selector: value };
      }
      return { type: 'click', selector: value.selector, options: value.options };

    case 'type':
    case 'fill':
      if (typeof value === 'object') {
        return { type: 'type', selector: value.selector, value: String(value.value || value.text) };
      }
      throw new Error('type requires selector and value');

    case 'clear':
      return { type: 'clear', selector: String(value) };

    case 'select':
      if (typeof value === 'object') {
        return { type: 'select', selector: value.selector, value: String(value.value || value.option) };
      }
      throw new Error('select requires selector and value');

    case 'hover':
      return { type: 'hover', selector: String(value) };

    case 'scroll':
      if (typeof value === 'string') {
        return { type: 'scroll', selector: value };
      }
      return { type: 'scroll', selector: value.selector, options: value };

    case 'wait':
    case 'waitFor':
    case 'waitfor':
      if (typeof value === 'number') {
        return { type: 'waitFor', timeout: value };
      }
      if (typeof value === 'string') {
        return { type: 'waitFor', selector: value };
      }
      return { type: 'waitFor', selector: value.selector, timeout: value.timeout };

    case 'assert':
    case 'expect':
    case 'check':
      if (typeof value === 'object') {
        let assertion = '';
        if (value.visible) assertion = `visible:${value.selector}`;
        else if (value.hidden) assertion = `hidden:${value.selector}`;
        else if (value.contains) assertion = `contains:${value.contains}`;
        else if (value.text) assertion = `text:${value.text}`;
        else if (value.exists) assertion = `exists:${value.selector}`;
        return { type: 'assert', selector: value.selector, assertion };
      }
      return { type: 'assert', selector: String(value), assertion: 'visible' };

    case 'screenshot':
    case 'capture':
      if (typeof value === 'string') {
        return { type: 'screenshot', name: value };
      }
      return { type: 'screenshot', name: value.name, selector: value.selector };

    case 'ai':
      return { type: 'ai', value: String(value) };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// =============================================================================
// NATURAL LANGUAGE PARSER
// =============================================================================

/**
 * Parse natural language test description into steps.
 * Uses pattern matching for common phrases, with AI fallback for complex cases.
 * 
 * Examples:
 * - "go to https://example.com"
 * - "click the login button"
 * - "type 'hello' into the search box"
 * - "wait for the page to load"
 * - "take a screenshot"
 */
export async function parseNaturalLanguage(
  text: string,
  aiFallback?: (sentence: string) => Promise<TestStep | null>,
): Promise<ParseResult> {
  const warnings: string[] = [];
  const steps: TestStep[] = [];

  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    try {
      const step = parseSentence(sentence);
      if (step) {
        steps.push(step);
      } else {
        // No regex match — try AI fallback if available
        if (aiFallback) {
          const aiStep = await aiFallback(sentence);
          if (aiStep) {
            steps.push(aiStep);
            warnings.push(`AI-interpreted: "${sentence}"`);
          } else {
            steps.push({ type: 'ai', value: sentence });
            warnings.push(`Unrecognized (will use DOM analysis at runtime): "${sentence}"`);
          }
        } else {
          steps.push({ type: 'ai', value: sentence });
          warnings.push(`Unrecognized (will use DOM analysis at runtime): "${sentence}"`);
        }
      }
    } catch (err: any) {
      warnings.push(`Could not parse: "${sentence}"`);
      // Add as AI step for runtime interpretation
      steps.push({ type: 'ai', value: sentence });
    }
  }

  return { steps, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Split a story paragraph into step-sized sentences, protecting URLs and
 * quoted fragments so their internal periods/commas don't trigger a
 * clause boundary. See goalCompiler.service.ts for the mirror-image
 * implementation used for goals.
 */
function splitIntoSentences(text: string): string[] {
  const normalizedText = text
    // Strip common numbered or bulleted list prefixes before sentence splitting
    // so "1. Navigate…" becomes "Navigate…" instead of ["1", "Navigate…"].
    .replace(/^\s*(?:\d+[.)]|[-*])\s+/gm, '');
  const URL_DOT = '\x00URLDOT\x00';
  // Match URL body but strip trailing sentence punctuation so ". Click…"
  // still splits at the period after the URL.
  const protectedText = normalizedText.replace(
    /\b(?:https?:\/\/|\/\/)[^\s]+?(?=[.,;!?]?(?:\s|$))/gi,
    (m) => m.replace(/\./g, URL_DOT),
  );

  const raw: string[] = [];
  let buf = '';
  let inQuote: '"' | "'" | null = null;

  const push = () => {
    const t = buf.trim();
    if (t) raw.push(t);
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
    // Split on " then ", " and then ", " next ", " after that "
    const rest = protectedText.substring(i);
    const m = rest.match(/^\s+(?:then|and then|next|after that)\s+/i);
    if (m && buf.trim()) {
      push();
      i += m[0].length - 1; // -1 because loop increments
      continue;
    }
    buf += c;
  }
  push();

  return raw.map((s) => s.replace(new RegExp(URL_DOT, 'g'), '.'));
}

function parseSentence(sentence: string): TestStep | null {
  // Navigate patterns
  const navPatterns = [
    /^(?:go to|navigate to|visit|open)\s+(.+)$/i,
    /^(?:load|browse to)\s+(.+)$/i,
  ];
  for (const pattern of navPatterns) {
    const match = sentence.match(pattern);
    if (match) {
      const url = normalizeNavigationTarget(match[1].trim());
      return { type: 'navigate', url };
    }
  }

  // Click patterns
  const clickPatterns = [
    /^click (?:on )?(?:the )?["']?(.+?)["']?$/i,
    /^press (?:the )?["']?(.+?)["']?(?: button)?$/i,
    /^tap (?:on )?(?:the )?["']?(.+?)["']?$/i,
  ];
  for (const pattern of clickPatterns) {
    const match = sentence.match(pattern);
    if (match) {
      const target = match[1].trim();
      // Convert descriptive text to selector
      const selector = textToSelector(target);
      return { type: 'click', selector };
    }
  }

  // Type patterns
  const typePatterns = [
    /^(?:type|enter|input)\s+["'](.+?)["']\s+(?:in(?:to)?|in the)\s+(?:the )?["']?(.+?)["']?$/i,
    /^(?:fill|fill in)\s+(?:the )?["']?(.+?)["']?\s+with\s+["'](.+?)["']$/i,
    /^(?:set|write)\s+["']?(.+?)["']?\s+(?:to|as)\s+["'](.+?)["']$/i,
  ];
  for (const pattern of typePatterns) {
    const match = sentence.match(pattern);
    if (match) {
      // Patterns have different capture group orders
      let value: string, target: string;
      if (pattern.source.includes('fill')) {
        [, target, value] = match;
      } else if (pattern.source.includes('set|write')) {
        [, target, value] = match;
      } else {
        [, value, target] = match;
      }
      const selector = textToSelector(target.trim());
      return { type: 'type', selector, value: value.trim() };
    }
  }

  // Wait patterns
  if (/^wait for (?:the )?page to load$/i.test(sentence)) {
    return { type: 'waitFor', options: { loadState: 'load' } };
  }

  const waitPatterns = [
    /^wait\s+(\d+)\s*(?:ms|milliseconds?)?$/i,
    /^wait\s+(\d+)\s*(?:s|sec|seconds?)$/i,
    /^wait for\s+(?:the )?["']?(.+?)["']?(?:\s+to (?:appear|load|show))?$/i,
    /^(?:pause|sleep)\s+(?:for\s+)?(\d+)/i,
  ];
  for (const pattern of waitPatterns) {
    const match = sentence.match(pattern);
    if (match) {
      if (pattern.source.includes('wait for')) {
        const selector = textToSelector(match[1].trim());
        return { type: 'waitFor', selector };
      }
      let timeout = parseInt(match[1]);
      if (pattern.source.includes('sec')) {
        timeout *= 1000;
      }
      return { type: 'waitFor', timeout };
    }
  }

  // Screenshot patterns
  const screenshotPatterns = [
    /^(?:take|capture|grab)\s+(?:a )?screenshot(?:\s+(?:of|named)\s+["']?(.+?)["']?)?$/i,
    /^screenshot(?:\s+["']?(.+?)["']?)?$/i,
  ];
  for (const pattern of screenshotPatterns) {
    const match = sentence.match(pattern);
    if (match) {
      return { type: 'screenshot', name: match[1]?.trim() };
    }
  }

  // Assert patterns
  const assertTextVisiblePatterns = [
    /^(?:verify|check|assert|expect)\s+(?:that )?text\s+["'](.+?)["']\s+(?:is )?visible$/i,
    /^(?:verify|check|assert|expect)\s+(?:that )?["'](.+?)["']\s+(?:text )?(?:is )?visible$/i,
  ];
  for (const pattern of assertTextVisiblePatterns) {
    const match = sentence.match(pattern);
    if (match) {
      return { type: 'assert', selector: `text="${match[1].trim()}"`, assertion: 'visible' };
    }
  }

  const assertPatterns = [
    /^(?:verify|check|assert|expect)\s+(?:that )?(?:the )?["']?(.+?)["']?\s+(?:is )?visible$/i,
    /^(?:verify|check|assert|expect)\s+(?:that )?(?:the )?["']?(.+?)["']?\s+(?:contains?|has)\s+["'](.+?)["']$/i,
    /^(?:should )?see\s+(?:the )?["']?(.+?)["']?$/i,
  ];
  for (const pattern of assertPatterns) {
    const match = sentence.match(pattern);
    if (match) {
      const selector = textToSelector(match[1].trim());
      const assertion = match[2] ? `contains:${match[2]}` : 'visible';
      return { type: 'assert', selector, assertion };
    }
  }

  // Hover patterns
  if (/^hover (?:over )?(?:the )?["']?(.+?)["']?$/i.test(sentence)) {
    const match = sentence.match(/^hover (?:over )?(?:the )?["']?(.+?)["']?$/i);
    if (match) {
      return { type: 'hover', selector: textToSelector(match[1].trim()) };
    }
  }

  // Scroll patterns
  if (/^scroll\s+(?:to|down|up)/i.test(sentence)) {
    const match = sentence.match(/^scroll\s+(?:to\s+)?(?:the )?["']?(.+?)["']?$/i);
    if (match) {
      return { type: 'scroll', selector: textToSelector(match[1].trim()) };
    }
    return { type: 'scroll' };
  }

  // Clear patterns
  if (/^clear\s+(?:the )?["']?(.+?)["']?$/i.test(sentence)) {
    const match = sentence.match(/^clear\s+(?:the )?["']?(.+?)["']?$/i);
    if (match) {
      return { type: 'clear', selector: textToSelector(match[1].trim()) };
    }
  }

  // If no pattern matches, return null (caller will handle as AI step)
  return null;
}

function normalizeNavigationTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    return trimmed;
  }

  // Preserve relative paths so the caller can resolve them against a provided
  // base URL later in the authoring flow.
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('www.')) {
    return `https://${trimmed}`;
  }

  // Heuristic: host-like values get https:// prepended, plain-language values
  // fall back to the original text so they can be handled by AI/runtime later.
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Convert descriptive text to a CSS selector.
 * Smart heuristics for common UI elements.
 */
function textToSelector(text: string): string {
  const t = text.toLowerCase().trim();

  // Already a selector (starts with #, ., or contains [)
  if (/^[#.]|[\[\]=]/.test(text)) {
    return text;
  }

  // Common button patterns
  if (t.includes('button')) {
    const btnText = t.replace(/\s*button\s*/i, '').trim();
    if (btnText) {
      return `button:has-text("${btnText}"), [role="button"]:has-text("${btnText}")`;
    }
    return 'button';
  }

  // Common link patterns  
  if (t.includes('link')) {
    const linkText = t.replace(/\s*link\s*/i, '').trim();
    if (linkText) {
      return `a:has-text("${linkText}")`;
    }
    return 'a';
  }

  // Input field patterns
  const inputPatterns = ['input', 'field', 'textbox', 'text box', 'text field'];
  for (const p of inputPatterns) {
    if (t.includes(p)) {
      const fieldName = t.replace(new RegExp(`\\s*${p}\\s*`, 'i'), '').trim();
      if (fieldName) {
        // Try label, placeholder, or name
        return `input[placeholder*="${fieldName}" i], input[name*="${fieldName}" i], label:has-text("${fieldName}") + input, label:has-text("${fieldName}") input`;
      }
      return 'input';
    }
  }

  // Common named elements
  const namedElements: Record<string, string> = {
    'login': 'button:has-text("login"), a:has-text("login"), [data-testid*="login"]',
    'sign in': 'button:has-text("sign in"), a:has-text("sign in")',
    'sign up': 'button:has-text("sign up"), a:has-text("sign up")',
    'submit': 'button[type="submit"], input[type="submit"], button:has-text("submit")',
    'search': 'input[type="search"], input[name*="search" i], input[placeholder*="search" i]',
    'email': 'input[type="email"], input[name*="email" i], input[placeholder*="email" i]',
    'password': 'input[type="password"], input[name*="password" i]',
    'username': 'input[name*="user" i], input[placeholder*="user" i]',
    'menu': 'nav, [role="navigation"], .menu, #menu',
    'header': 'header, [role="banner"], .header',
    'footer': 'footer, [role="contentinfo"], .footer',
    'sidebar': 'aside, [role="complementary"], .sidebar',
    'modal': '[role="dialog"], .modal, [class*="modal"]',
    'close': 'button:has-text("close"), button:has-text("×"), [aria-label*="close" i]',
  };

  if (namedElements[t]) {
    return namedElements[t];
  }

  // Default: try text-based selector
  return `text="${text}"`;
}

// =============================================================================
// UNIFIED PARSER
// =============================================================================

export type ScriptFormat = 'natural' | 'yaml' | 'json';

export function detectFormat(content: string): ScriptFormat {
  const trimmed = content.trim();
  
  // Check for JSON array
  if (trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }
  
  // Check for YAML markers
  if (trimmed.startsWith('-') || trimmed.includes(':\n') || trimmed.includes(': ')) {
    try {
      const parsed = yaml.load(trimmed);
      if (Array.isArray(parsed)) {
        return 'yaml';
      }
    } catch {}
  }
  
  // Default to natural language
  return 'natural';
}

export async function parseTestScript(
  content: string,
  format?: ScriptFormat,
  aiFallback?: (sentence: string) => Promise<TestStep | null>,
): Promise<ParseResult> {
  const actualFormat = format || detectFormat(content);

  logger.info(`Parsing test script as ${actualFormat}`);

  switch (actualFormat) {
    case 'json':
      return { steps: JSON.parse(content) };
    case 'yaml':
      return parseYamlScript(content);
    case 'natural':
    default:
      return parseNaturalLanguage(content, aiFallback);
  }
}

export default {
  parseYamlScript,
  parseNaturalLanguage,
  parseTestScript,
  detectFormat,
};
