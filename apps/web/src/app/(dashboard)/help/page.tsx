'use client';

import { useState } from 'react';
import {
  BookOpen,
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
  Code,
  FileText,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
      }}
    >
      <Copy className="h-3 w-3" />
    </Button>
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
    icon: <Navigation className="w-5 h-5" />,
    description: 'Navigate the browser to a URL. This is usually the first step in a test.',
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
    icon: <MousePointer className="w-5 h-5" />,
    description: 'Click on an element. You can use CSS selectors, text content, or describe the element.',
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
    icon: <Type className="w-5 h-5" />,
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
    icon: <Clock className="w-5 h-5" />,
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
    icon: <Camera className="w-5 h-5" />,
    description: 'Capture a screenshot for visual comparison. Can capture full page or specific element.',
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
    icon: <CheckCircle className="w-5 h-5" />,
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
    icon: <Eye className="w-5 h-5" />,
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
    icon: <Scroll className="w-5 h-5" />,
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
    icon: <Trash2 className="w-5 h-5" />,
    description: 'Clear the content of an input field.',
    naturalExamples: [
      'Clear the search field',
      'Clear the email input',
    ],
    yamlExamples: [
      '- clear: "#search"',
      '- clear: "input[name=email]"',
    ],
    parameters: [
      { name: 'selector', required: true, description: 'Input field to clear' },
    ],
  },
  {
    name: 'AI Action',
    type: 'ai',
    icon: <Wand2 className="w-5 h-5" />,
    description: 'Use AI to interpret and execute a complex action. Great for dynamic or hard-to-describe elements.',
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
  { pattern: 'text="..."', description: 'Select by text content', example: 'text="Sign In"' },
  { pattern: ':has-text("...")', description: 'Contains text', example: 'button:has-text("Login")' },
];

const SMART_SELECTORS = [
  { keyword: 'login button', generates: 'button:has-text("login"), [data-testid*="login"]' },
  { keyword: 'email field', generates: 'input[type="email"], input[name*="email" i]' },
  { keyword: 'password field', generates: 'input[type="password"]' },
  { keyword: 'submit', generates: 'button[type="submit"], input[type="submit"]' },
  { keyword: 'search', generates: 'input[type="search"], input[placeholder*="search" i]' },
];

export default function HelpPage() {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  return (
    <div className="max-w-[960px] mx-auto px-6 md:px-12 py-10 pb-16 vt-reveal">
      {/* Tome masthead — the help page is a bound reference, so it
          opens like a chapter of a book: Roman numeral, long title,
          italic sub-head. */}
      <header className="pb-8 border-b-2 mb-14" style={{ borderColor: 'var(--ink-0)' }}>
        <div className="vt-kicker mb-4" style={{ color: 'var(--ink-2)' }}>
          Chapter I · Authoring tests
        </div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(44px, 6vw, 76px)', lineHeight: 0.97, fontWeight: 310 }}>
          The <em>manual</em>.
        </h1>
        <p
          className="mt-5 vt-italic"
          style={{ fontVariationSettings: '"opsz" 24', fontSize: '19px', color: 'var(--ink-1)', maxWidth: '56ch' }}
        >
          Two vocabularies for writing tests: plain English sentences, or
          YAML for the programmer&apos;s convenience. Both compile to the
          same step array. This is the reference to both.
        </p>
      </header>

      {/* Quick Start */}
      <Card className="vt-panel" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
        <CardHeader>
          <CardTitle className="text-foreground">Quick Start</CardTitle>
          <CardDescription className="text-muted-foreground">
            VisionTest.ai supports two ways to write tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <Wand2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold">Natural Language</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Write tests in plain English. Perfect for non-technical users or quick prototyping.
              </p>
              <pre className="bg-card p-3 rounded-lg text-sm text-muted-foreground overflow-x-auto">
{`Go to https://example.com
Click the login button
Type "test@email.com" in email
Click submit`}
              </pre>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold">YAML Script</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Structured format with precise selectors. Great for complex tests and CI/CD.
              </p>
              <pre className="bg-card p-3 rounded-lg text-sm text-muted-foreground overflow-x-auto">
{`- navigate: https://example.com
- click: "#login-btn"
- type:
    selector: "#email"
    value: "test@email.com"
- click: "[type=submit]"`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Reference */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Supported Actions</h2>
        <div className="space-y-3">
          {ACTIONS.map((action) => (
            <Card 
              key={action.type}
              className="bg-card border-border overflow-hidden"
            >
              <button
                onClick={() => setExpandedAction(expandedAction === action.type ? null : action.type)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-muted rounded-lg text-blue-400">
                    {action.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-foreground">{action.name}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">{action.type}</Badge>
                  {expandedAction === action.type ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {expandedAction === action.type && (
                <div className="px-6 pb-6 border-t border-border pt-4">
                  <Tabs defaultValue="natural" className="w-full">
                    <TabsList className="bg-muted">
                      <TabsTrigger value="natural">Natural Language</TabsTrigger>
                      <TabsTrigger value="yaml">YAML</TabsTrigger>
                      <TabsTrigger value="params">Parameters</TabsTrigger>
                    </TabsList>

                    <TabsContent value="natural" className="mt-4">
                      <div className="space-y-2">
                        {action.naturalExamples.map((ex, i) => (
                          <div key={i} className="flex items-center gap-2 group">
                            <Terminal className="w-4 h-4 text-muted-foreground/70" />
                            <code className="text-sm text-green-400 flex-1">{ex}</code>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={ex} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="yaml" className="mt-4">
                      <div className="space-y-2">
                        {action.yamlExamples.map((ex, i) => (
                          <div key={i} className="relative group">
                            <pre className="bg-background p-3 rounded text-sm text-yellow-400 overflow-x-auto pr-8">
                              {ex}
                            </pre>
                            <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={ex} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="params" className="mt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-muted-foreground">Parameter</th>
                            <th className="text-left py-2 text-muted-foreground">Required</th>
                            <th className="text-left py-2 text-muted-foreground">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {action.parameters.map((param, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 font-mono text-blue-400">{param.name}</td>
                              <td className="py-2">
                                {param.required ? (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Optional</Badge>
                                )}
                              </td>
                              <td className="py-2 text-muted-foreground">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Selectors Guide */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Code className="w-5 h-5" />
            CSS Selector Guide
          </CardTitle>
          <CardDescription>
            Learn how to target elements precisely
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-foreground mb-3">Basic Selectors</h4>
              <table className="w-full text-sm">
                <tbody>
                  {SELECTOR_TIPS.map((tip, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 font-mono text-purple-400">{tip.pattern}</td>
                      <td className="py-2 text-muted-foreground">{tip.description}</td>
                      <td className="py-2 font-mono text-muted-foreground text-xs">{tip.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Smart Selectors</h4>
              <p className="text-sm text-muted-foreground mb-3">
                When using natural language, VisionTest.ai automatically converts common phrases to selectors:
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {SMART_SELECTORS.map((sel, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 text-green-400">"{sel.keyword}"</td>
                      <td className="py-2 text-muted-foreground font-mono text-xs">{sel.generates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">💡 Tips & Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>Use <code className="bg-muted px-1 rounded">data-testid</code> attributes for stable selectors that won't break with UI changes</span>
            </li>
            <li className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>Add <code className="bg-muted px-1 rounded">waitFor</code> steps after actions that trigger page loads or API calls</span>
            </li>
            <li className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>Name your screenshots descriptively (e.g., "checkout-step-2" instead of "screenshot1")</span>
            </li>
            <li className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>Use the AI action for complex interactions that are hard to describe with selectors</span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-400">⚠</span>
              <span>Avoid using brittle selectors like <code className="bg-muted px-1 rounded">.class1.class2.class3</code> that may change</span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-400">⚠</span>
              <span>Keep tests focused - one test per user flow for easier debugging</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
