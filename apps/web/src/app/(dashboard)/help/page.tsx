'use client';

import { useState } from 'react';
import {
  MousePointer,
  Type,
  Navigation,
  Clock,
  Camera,
  CheckCircle,
  Eye,
  Scroll,
  Trash2,
  Wand2,
  ChevronDown,
  ChevronRight,
  Copy,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
      }}
      className="vt-btn vt-btn--ghost"
      style={{ padding: '4px 8px', fontSize: '10px' }}
    >
      <Copy className="w-3 h-3" strokeWidth={1.5} />
    </button>
  );
}

interface ActionDoc {
  name: string;
  type: string;
  icon: React.ReactNode;
  description: string;
  naturalExamples: string[];
  yamlExamples: string[];
  parameters: { name: string; required: boolean; description: string }[];
}

const ACTIONS: ActionDoc[] = [
  {
    name: 'Navigate',
    type: 'navigate',
    icon: <Navigation className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Navigate the browser to a URL. Usually the first step in a test.',
    naturalExamples: [
      'Go to https://example.com',
      'Navigate to https://myapp.com/login',
      'Visit https://staging.example.com',
      'Open https://example.com/dashboard',
    ],
    yamlExamples: [
      '- navigate: https://example.com',
      '- goto: https://myapp.com/login',
      '- visit: https://staging.example.com',
    ],
    parameters: [
      { name: 'url', required: true, description: 'The URL to navigate to (must include https://)' },
    ],
  },
  {
    name: 'Click',
    type: 'click',
    icon: <MousePointer className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Click on an element. Use CSS selectors, text content, or a description.',
    naturalExamples: [
      'Click the login button',
      'Click on "Sign Up"',
      'Press the submit button',
      'Click #submit-btn',
      'Tap the menu icon',
    ],
    yamlExamples: [
      '- click: "#login-button"',
      '- click: "button[type=submit]"',
      '- click: text="Sign Up"',
      '- click:\n    selector: ".nav-menu"\n    options:\n      force: true',
    ],
    parameters: [
      { name: 'selector', required: true, description: 'CSS selector, text selector, or element description' },
      { name: 'options.force', required: false, description: 'Force click even if element is covered' },
    ],
  },
  {
    name: 'Type',
    type: 'type',
    icon: <Type className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Type text into an input field. Automatically clears existing content first.',
    naturalExamples: [
      'Type "hello@example.com" in the email field',
      'Enter "mypassword" in the password input',
      'Fill the username field with "testuser"',
      'Input "John Doe" into the name textbox',
    ],
    yamlExamples: [
      '- type:\n    selector: "#email"\n    value: "hello@example.com"',
      '- fill:\n    selector: "input[name=password]"\n    value: "secret123"',
      '- type:\n    selector: ".search-box"\n    value: "search query"',
    ],
    parameters: [
      { name: 'selector', required: true, description: 'CSS selector for the input field' },
      { name: 'value', required: true, description: 'Text to type into the field' },
    ],
  },
  {
    name: 'Wait',
    type: 'waitFor',
    icon: <Clock className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Wait for an element to appear or for a specified duration.',
    naturalExamples: [
      'Wait for the dashboard to appear',
      'Wait for ".loading" to disappear',
      'Wait 2 seconds',
      'Pause for 500ms',
      'Wait for the page to load',
    ],
    yamlExamples: [
      '- waitFor: ".dashboard"',
      '- wait: 2000',
      '- waitFor:\n    selector: ".modal"\n    timeout: 10000',
    ],
    parameters: [
      { name: 'selector', required: false, description: 'Element to wait for' },
      { name: 'timeout', required: false, description: 'Time to wait in milliseconds' },
    ],
  },
  {
    name: 'Screenshot',
    type: 'screenshot',
    icon: <Camera className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Capture a screenshot for visual comparison. Full page or specific element.',
    naturalExamples: [
      'Take a screenshot',
      'Capture screenshot named "login-page"',
      'Screenshot the hero section',
      'Grab a screenshot of the results',
    ],
    yamlExamples: [
      '- screenshot: "homepage"',
      '- capture: "after-login"',
      '- screenshot:\n    name: "hero-section"\n    selector: ".hero"',
    ],
    parameters: [
      { name: 'name', required: false, description: 'Name for the screenshot (used in comparisons)' },
      { name: 'selector', required: false, description: 'Capture only this element' },
    ],
  },
  {
    name: 'Assert',
    type: 'assert',
    icon: <CheckCircle className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Verify that an element exists, is visible, or contains specific text.',
    naturalExamples: [
      'Verify the welcome message is visible',
      'Check that "Success" appears on the page',
      'Assert the error message contains "Invalid"',
      'Expect the submit button to be visible',
      'Should see "Dashboard"',
    ],
    yamlExamples: [
      '- assert: ".welcome-message"',
      '- expect:\n    selector: ".alert"\n    contains: "Success"',
      '- check:\n    selector: "#error"\n    visible: true',
    ],
    parameters: [
      { name: 'selector', required: true, description: 'Element to check' },
      { name: 'assertion', required: false, description: 'Type: visible, hidden, contains:text, exists' },
    ],
  },
  {
    name: 'Hover',
    type: 'hover',
    icon: <Eye className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Hover over an element to trigger hover states or dropdown menus.',
    naturalExamples: [
      'Hover over the menu',
      'Hover on the dropdown button',
      'Mouse over the profile icon',
    ],
    yamlExamples: [
      '- hover: ".dropdown-trigger"',
      '- hover: "#user-menu"',
    ],
    parameters: [
      { name: 'selector', required: true, description: 'Element to hover over' },
    ],
  },
  {
    name: 'Scroll',
    type: 'scroll',
    icon: <Scroll className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Scroll the page or scroll an element into view.',
    naturalExamples: [
      'Scroll to the footer',
      'Scroll down to the pricing section',
      'Scroll to #contact-form',
    ],
    yamlExamples: [
      '- scroll: "#footer"',
      '- scroll:\n    selector: ".pricing"\n    behavior: smooth',
    ],
    parameters: [
      { name: 'selector', required: false, description: 'Element to scroll to' },
    ],
  },
  {
    name: 'Clear',
    type: 'clear',
    icon: <Trash2 className="w-4 h-4" strokeWidth={1.5} />,
    description: 'Clear the content of an input field.',
    naturalExamples: ['Clear the search field', 'Clear the email input'],
    yamlExamples: ['- clear: "#search"', '- clear: "input[name=email]"'],
    parameters: [{ name: 'selector', required: true, description: 'Input field to clear' }],
  },
  {
    name: 'AI Action',
    type: 'ai',
    icon: <Wand2 className="w-4 h-4" strokeWidth={1.5} />,
    description:
      'Use AI to interpret and execute a complex action. Great for dynamic or hard-to-describe elements.',
    naturalExamples: [
      'Find and click the third product in the list',
      'Accept the cookie banner if it appears',
      'Dismiss any popup modals',
    ],
    yamlExamples: [
      '- ai: "Click the most prominent call-to-action button"',
      '- ai: "Fill out the contact form with test data"',
    ],
    parameters: [
      { name: 'value', required: true, description: 'Natural language description of the action' },
    ],
  },
];

const SELECTOR_TIPS = [
  { pattern: '#id', description: 'Select by ID', example: '#login-button' },
  { pattern: '.class', description: 'Select by class', example: '.btn-primary' },
  { pattern: 'tag', description: 'Select by tag', example: 'button' },
  { pattern: '[attr=value]', description: 'Select by attribute', example: '[data-testid="submit"]' },
  { pattern: 'text="…"', description: 'Select by text content', example: 'text="Sign In"' },
  { pattern: ':has-text("…")', description: 'Contains text', example: 'button:has-text("Login")' },
];

const SMART_SELECTORS = [
  { keyword: 'login button', generates: 'button:has-text("login"), [data-testid*="login"]' },
  { keyword: 'email field', generates: 'input[type="email"], input[name*="email" i]' },
  { keyword: 'password field', generates: 'input[type="password"]' },
  { keyword: 'submit', generates: 'button[type="submit"], input[type="submit"]' },
  { keyword: 'search', generates: 'input[type="search"], input[placeholder*="search" i]' },
];

const TIPS = [
  {
    kind: 'DO',
    body:
      'Use data-testid attributes for stable selectors that don’t break with UI changes.',
  },
  {
    kind: 'DO',
    body:
      'Add waitFor after actions that trigger page loads or API calls.',
  },
  {
    kind: 'DO',
    body:
      'Name screenshots descriptively, e.g. "checkout-step-2" instead of "screenshot1".',
  },
  {
    kind: 'DO',
    body:
      'Use the AI action for complex interactions that are hard to describe with selectors.',
  },
  {
    kind: 'WARN',
    body:
      'Avoid brittle selectors like .class1.class2.class3 that may change.',
  },
  {
    kind: 'WARN',
    body:
      'Keep tests focused — one test per user flow for easier debugging.',
  },
];

const TOC = [
  { no: '01', title: 'quick start', stamp: 'two vocabularies' },
  { no: '02', title: 'schedule of actions', stamp: `${ACTIONS.length} · STEPS` },
  { no: '03', title: 'selector guide', stamp: 'DETAIL A' },
  { no: '04', title: 'practice notes', stamp: `${TIPS.length} · RULES` },
];

export default function HelpPage() {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'natural' | 'yaml' | 'params'>>({});
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const getTab = (type: string) => activeTab[type] || 'natural';
  const setTab = (type: string, tab: 'natural' | 'yaml' | 'params') =>
    setActiveTab((prev) => ({ ...prev, [type]: tab }));

  return (
    <VtStage width="narrow">
      <EditorialHero
        width="narrow"
        sheet="M-01"
        eyebrow="§ MANUAL · AUTHORING"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            the <em>manual</em>.
          </>
        }
        lead="Two vocabularies for writing tests: plain English sentences, or YAML for the programmer's convenience. Both compile to the same step array. This sheet is the reference."
      >
        {/* ── Contents ──────────────────────────────────────────────── */}
        <section aria-labelledby="toc-head">
          <div className="vt-section-head">
            <span className="num">§ 00</span>
            <span className="ttl" id="toc-head">contents</span>
            <span className="rule" />
            <span className="stamp">{TOC.length} · SECTIONS</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            {TOC.map((entry, i) => (
              <div
                key={entry.no}
                className="grid grid-cols-[80px_1fr_180px] items-center"
                style={{
                  borderBottom: i < TOC.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                }}
              >
                <div
                  className="py-3 px-4 vt-mono"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontSize: '11px',
                    letterSpacing: '0.18em',
                    color: 'var(--accent)',
                  }}
                >
                  § {entry.no}
                </div>
                <div
                  className="py-3 px-4"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    color: 'var(--ink-0)',
                    textTransform: 'lowercase',
                  }}
                >
                  {entry.title}
                </div>
                <div
                  className="py-3 px-4 vt-mono text-right"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  {entry.stamp}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── §01 Quick start ───────────────────────────────────────── */}
        <section aria-labelledby="qs-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="qs-head">quick start</span>
            <span className="rule" />
            <span className="stamp">TWO VOCABULARIES</span>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div
              className="p-6"
              style={{ borderRight: '1px solid var(--rule)' }}
            >
              <div
                className="vt-mono mb-3"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                A · NATURAL LANGUAGE
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13.5px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.5,
                  marginBottom: '14px',
                }}
              >
                Plain English. Good for non-technical authors and quick prototyping.
              </p>
              <pre
                className="vt-mono"
                style={{
                  background: 'var(--bg-0)',
                  border: '1px solid var(--rule)',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
{`Go to https://example.com
Click the login button
Type "test@email.com" in email
Click submit`}
              </pre>
            </div>
            <div className="p-6">
              <div
                className="vt-mono mb-3"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                B · YAML SCRIPT
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13.5px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.5,
                  marginBottom: '14px',
                }}
              >
                Structured. Precise selectors. Good for complex tests and CI/CD.
              </p>
              <pre
                className="vt-mono"
                style={{
                  background: 'var(--bg-0)',
                  border: '1px solid var(--rule)',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
{`- navigate: https://example.com
- click: "#login-btn"
- type:
    selector: "#email"
    value: "test@email.com"
- click: "[type=submit]"`}
              </pre>
            </div>
          </div>
        </section>

        {/* ── §02 Actions ───────────────────────────────────────────── */}
        <section aria-labelledby="actions-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="actions-head">schedule of actions</span>
            <span className="rule" />
            <span className="stamp">{String(ACTIONS.length).padStart(2, '0')} · STEPS</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            {ACTIONS.map((action, idx) => {
              const open = expandedAction === action.type;
              const tab = getTab(action.type);
              return (
                <div
                  key={action.type}
                  style={{
                    borderBottom: idx < ACTIONS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedAction(open ? null : action.type)}
                    className="w-full grid grid-cols-[80px_40px_1fr_140px_40px] items-center text-left"
                    style={{
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'background var(--dur-quick) var(--ease-out)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        'color-mix(in oklab, var(--bg-2) 35%, transparent)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11px',
                        letterSpacing: '0.18em',
                        color: 'var(--accent)',
                      }}
                    >
                      § {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div
                      className="py-4 px-3 flex items-center justify-center"
                      style={{ borderRight: '1px solid var(--rule-soft)', color: 'var(--ink-1)' }}
                    >
                      {action.icon}
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '17px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {action.name}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '12.5px',
                          color: 'var(--ink-2)',
                          marginTop: '2px',
                        }}
                      >
                        {action.description}
                      </div>
                    </div>
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '10.5px',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {action.type}
                    </div>
                    <div className="py-4 px-3 flex items-center justify-center" style={{ color: 'var(--ink-2)' }}>
                      {open ? (
                        <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                      ) : (
                        <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                      )}
                    </div>
                  </button>
                  {open && (
                    <div
                      className="px-6 py-5"
                      style={{
                        borderTop: '1px solid var(--rule-soft)',
                        background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
                      }}
                    >
                      <div
                        className="flex items-center gap-0 mb-4"
                        style={{ border: '1px solid var(--rule)' }}
                      >
                        {(['natural', 'yaml', 'params'] as const).map((t, ti) => {
                          const active = tab === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTab(action.type, t)}
                              style={{
                                flex: 1,
                                padding: '9px 14px',
                                borderRight: ti < 2 ? '1px solid var(--rule-soft)' : 'none',
                                background: active ? 'var(--accent-soft)' : 'transparent',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10.5px',
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                color: active ? 'var(--accent)' : 'var(--ink-1)',
                                cursor: 'pointer',
                              }}
                            >
                              {t === 'natural' ? 'NATURAL' : t === 'yaml' ? 'YAML' : 'PARAMS'}
                            </button>
                          );
                        })}
                      </div>
                      {tab === 'natural' && (
                        <div className="space-y-2">
                          {action.naturalExamples.map((ex, i) => (
                            <div
                              key={i}
                              className="group flex items-center gap-3 py-2 px-3"
                              style={{ border: '1px solid var(--rule-soft)' }}
                            >
                              <span
                                className="vt-mono"
                                style={{
                                  fontSize: '10px',
                                  letterSpacing: '0.14em',
                                  color: 'var(--ink-2)',
                                }}
                              >
                                ·{String(i + 1).padStart(2, '0')}
                              </span>
                              <code
                                className="vt-mono flex-1"
                                style={{ fontSize: '12.5px', color: 'var(--ink-0)' }}
                              >
                                {ex}
                              </code>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <CopyButton text={ex} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tab === 'yaml' && (
                        <div className="space-y-3">
                          {action.yamlExamples.map((ex, i) => (
                            <div key={i} className="relative group">
                              <pre
                                className="vt-mono"
                                style={{
                                  background: 'var(--bg-0)',
                                  border: '1px solid var(--rule)',
                                  padding: '12px 40px 12px 14px',
                                  fontSize: '12px',
                                  color: 'var(--accent)',
                                  lineHeight: 1.55,
                                  overflowX: 'auto',
                                  margin: 0,
                                }}
                              >
                                {ex}
                              </pre>
                              <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <CopyButton text={ex} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tab === 'params' && (
                        <div style={{ border: '1px solid var(--rule-soft)' }}>
                          <div
                            className="grid grid-cols-[140px_110px_1fr] gap-0"
                            style={{
                              borderBottom: '1px solid var(--rule)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '9.5px',
                              letterSpacing: '0.22em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-2)',
                            }}
                          >
                            {['PARAMETER', 'REQUIRED', 'DESCRIPTION'].map((h, i) => (
                              <div
                                key={h}
                                className="py-2.5 px-3"
                                style={{
                                  borderRight: i < 2 ? '1px solid var(--rule-soft)' : 'none',
                                }}
                              >
                                {h}
                              </div>
                            ))}
                          </div>
                          {action.parameters.map((p, pi) => (
                            <div
                              key={pi}
                              className="grid grid-cols-[140px_110px_1fr] gap-0"
                              style={{
                                borderBottom:
                                  pi < action.parameters.length - 1
                                    ? '1px solid var(--rule-soft)'
                                    : 'none',
                              }}
                            >
                              <div
                                className="py-2.5 px-3 vt-mono"
                                style={{
                                  borderRight: '1px solid var(--rule-soft)',
                                  fontSize: '11.5px',
                                  color: 'var(--accent)',
                                }}
                              >
                                {p.name}
                              </div>
                              <div
                                className="py-2.5 px-3 vt-mono"
                                style={{
                                  borderRight: '1px solid var(--rule-soft)',
                                  fontSize: '10px',
                                  letterSpacing: '0.18em',
                                  textTransform: 'uppercase',
                                  color: p.required ? 'var(--accent)' : 'var(--ink-2)',
                                }}
                              >
                                {p.required ? 'REQUIRED' : 'OPTIONAL'}
                              </div>
                              <div
                                className="py-2.5 px-3"
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '12.5px',
                                  color: 'var(--ink-1)',
                                }}
                              >
                                {p.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── §03 Selector guide ────────────────────────────────────── */}
        <section aria-labelledby="sel-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="sel-head">selector guide</span>
            <span className="rule" />
            <span className="stamp">DETAIL A · TARGETING</span>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div style={{ borderRight: '1px solid var(--rule)' }}>
              <div
                className="px-5 py-3 vt-mono"
                style={{
                  borderBottom: '1px solid var(--rule)',
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                BASIC SELECTORS
              </div>
              {SELECTOR_TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[130px_1fr] gap-0 items-center"
                  style={{
                    borderBottom:
                      i < SELECTOR_TIPS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div
                    className="py-3 px-4 vt-mono"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontSize: '11.5px',
                      color: 'var(--accent)',
                    }}
                  >
                    {tip.pattern}
                  </div>
                  <div className="py-3 px-4">
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '12.5px',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {tip.description}
                    </div>
                    <div
                      className="vt-mono"
                      style={{
                        fontSize: '10.5px',
                        color: 'var(--ink-2)',
                        marginTop: '2px',
                      }}
                    >
                      {tip.example}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div
                className="px-5 py-3 vt-mono"
                style={{
                  borderBottom: '1px solid var(--rule)',
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                SMART · NATURAL-LANGUAGE
              </div>
              {SMART_SELECTORS.map((sel, i) => (
                <div
                  key={i}
                  className="py-3 px-4"
                  style={{
                    borderBottom:
                      i < SMART_SELECTORS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div
                    className="vt-mono"
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--accent)',
                      marginBottom: '3px',
                    }}
                  >
                    "{sel.keyword}"
                  </div>
                  <div
                    className="vt-mono"
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    → {sel.generates}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── §04 Tips ──────────────────────────────────────────────── */}
        <section aria-labelledby="tips-head">
          <div className="vt-section-head">
            <span className="num">§ 04</span>
            <span className="ttl" id="tips-head">practice notes</span>
            <span className="rule" />
            <span className="stamp">{String(TIPS.length).padStart(2, '0')} · RULES</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            {TIPS.map((tip, i) => {
              const color = tip.kind === 'DO' ? 'var(--pass)' : 'var(--warn)';
              const Icon = tip.kind === 'DO' ? CheckCircle2 : AlertTriangle;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[80px_1fr] gap-0 items-start"
                  style={{
                    borderBottom: i < TIPS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div
                    className="py-4 px-4 flex items-center gap-2 vt-mono"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontSize: '10.5px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {tip.kind}
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13.5px',
                      color: 'var(--ink-1)',
                      lineHeight: 1.5,
                    }}
                  >
                    {tip.body}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer
          className="pt-6 flex justify-between gap-4 flex-wrap"
          style={{
            borderTop: '1px solid var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>SHEET · MANUAL</span>
          <span>CHAPTER I · AUTHORING</span>
          <span>DRAWN · {isoDate}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}
