/**
 * VisionTest AI Dogfood - Test Definitions
 *
 * 40 visual tests that exercise every page and feature area of VisionTest AI.
 * Each dashboard test begins with a login prefix so the Playwright browser
 * session is authenticated before navigating to the target page.
 */

import type { TestStep } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DogfoodTestSpec {
  group: string;
  name: string;
  steps: TestStep[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// Shared step helpers
// ---------------------------------------------------------------------------

const BASE = 'http://localhost:3000';

/** Steps to log in through the UI. Appended before every dashboard test. */
function loginSteps(): TestStep[] {
  return [
    { type: 'navigate', url: `${BASE}/login` },
    { type: 'waitFor', selector: 'input#email', timeout: 10000 },
    { type: 'type', selector: 'input#email', value: 'admin@visiontest.local' },
    { type: 'type', selector: 'input#password', value: 'admin123!' },
    { type: 'click', selector: 'button[type="submit"]' },
    // Wait for the aside (sidebar) to appear — more reliable than a specific link
    { type: 'waitFor', selector: 'aside', timeout: 20000 },
  ];
}

/** Navigate to a dashboard page and take a screenshot. */
function pageTest(
  group: string,
  name: string,
  path: string,
  extraTags: string[] = [],
): DogfoodTestSpec {
  return {
    group,
    name,
    tags: ['dogfood', group.toLowerCase().replace(/[^a-z0-9]/g, '-'), ...extraTags],
    steps: [
      ...loginSteps(),
      { type: 'navigate', url: `${BASE}${path}` },
      { type: 'waitFor', selector: 'body', timeout: 10000 },
      { type: 'screenshot', name: `${path.replace(/\//g, '-').replace(/^-/, '')}-page` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

export const dogfoodTests: DogfoodTestSpec[] = [
  // =========================================================================
  // GROUP 1: Auth & Account (5 tests)
  // =========================================================================
  {
    group: 'Auth',
    name: 'Login page renders',
    tags: ['dogfood', 'auth'],
    steps: [
      { type: 'navigate', url: `${BASE}/login` },
      { type: 'waitFor', selector: 'input#email', timeout: 10000 },
      { type: 'screenshot', name: 'login-page' },
    ],
  },
  {
    group: 'Auth',
    name: 'Register page renders',
    tags: ['dogfood', 'auth'],
    steps: [
      { type: 'navigate', url: `${BASE}/register` },
      { type: 'waitFor', selector: 'input#email', timeout: 10000 },
      { type: 'screenshot', name: 'register-page' },
    ],
  },
  {
    group: 'Auth',
    name: 'Forgot password page renders',
    tags: ['dogfood', 'auth'],
    steps: [
      { type: 'navigate', url: `${BASE}/forgot-password` },
      { type: 'waitFor', selector: 'form', timeout: 10000 },
      { type: 'screenshot', name: 'forgot-password-page' },
    ],
  },
  {
    group: 'Auth',
    name: 'Login flow completes',
    tags: ['dogfood', 'auth'],
    steps: [
      { type: 'navigate', url: `${BASE}/login` },
      { type: 'waitFor', selector: 'input#email', timeout: 10000 },
      { type: 'screenshot', name: 'login-before' },
      { type: 'type', selector: 'input#email', value: 'admin@visiontest.local' },
      { type: 'type', selector: 'input#password', value: 'admin123!' },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'waitFor', selector: 'a[href="/dashboard"]', timeout: 15000 },
      { type: 'screenshot', name: 'login-success-dashboard' },
    ],
  },
  {
    group: 'Auth',
    name: 'Terms page renders',
    tags: ['dogfood', 'auth'],
    steps: [
      { type: 'navigate', url: `${BASE}/terms` },
      { type: 'waitFor', selector: 'body', timeout: 10000 },
      { type: 'screenshot', name: 'terms-page' },
    ],
  },

  // =========================================================================
  // GROUP 2: Dashboard (1 test)
  // =========================================================================
  pageTest('Dashboard', 'Dashboard loads with stats', '/dashboard'),

  // =========================================================================
  // GROUP 3: Visual Tests (3 tests)
  // =========================================================================
  pageTest('Tests', 'Test list page', '/tests'),
  pageTest('Tests', 'Create new test page', '/tests/new'),
  pageTest('Tests', 'Executions list page', '/executions'),

  // =========================================================================
  // GROUP 4: Visual Regression (1 test)
  // =========================================================================
  pageTest('Visual', 'Visual regression page', '/visual'),

  // =========================================================================
  // GROUP 5: API Tests (2 tests)
  // =========================================================================
  pageTest('API Tests', 'API test list page', '/api-tests'),
  pageTest('API Tests', 'Create new API test page', '/api-tests/new'),

  // =========================================================================
  // GROUP 6: Devices (1 test)
  // =========================================================================
  pageTest('Devices', 'Device profile page', '/devices'),

  // =========================================================================
  // GROUP 7: Storybook (1 test)
  // =========================================================================
  pageTest('Storybook', 'Storybook integration page', '/storybook'),

  // =========================================================================
  // GROUP 8: Baselines (1 test)
  // =========================================================================
  pageTest('Baselines', 'Baseline list page', '/baselines'),

  // =========================================================================
  // GROUP 9: Flaky Tests (1 test)
  // =========================================================================
  pageTest('Flaky Tests', 'Flaky test dashboard', '/flaky'),

  // =========================================================================
  // GROUP 10: Masks (1 test)
  // =========================================================================
  pageTest('Masks', 'Mask management page', '/masks'),

  // =========================================================================
  // GROUP 11: Workflows (2 tests)
  // =========================================================================
  pageTest('Workflows', 'Workflow page', '/workflows'),
  pageTest('Workflows', 'Task blocks page', '/blocks'),

  // =========================================================================
  // GROUP 12: Schedules (1 test)
  // =========================================================================
  pageTest('Schedules', 'Schedule management page', '/schedules'),

  // =========================================================================
  // GROUP 13: Fixes (1 test)
  // =========================================================================
  pageTest('Fixes', 'Fixes dashboard', '/fixes'),

  // =========================================================================
  // GROUP 14: Approvals (1 test)
  // =========================================================================
  pageTest('Approvals', 'Approvals page', '/approvals'),

  // =========================================================================
  // GROUP 15: Analytics & Reports (2 tests)
  // =========================================================================
  pageTest('Analytics', 'Analytics page', '/analytics'),
  pageTest('Analytics', 'Reports page', '/reports'),

  // =========================================================================
  // GROUP 16: Organization & Teams (2 tests)
  // =========================================================================
  pageTest('Organization', 'Organization settings page', '/organization'),
  pageTest('Organization', 'Team management page', '/teams'),

  // =========================================================================
  // GROUP 17: Audit & Security (2 tests)
  // =========================================================================
  pageTest('Security', 'Audit log page', '/audit-log'),
  pageTest('Security', 'API key management page', '/api-keys'),

  // =========================================================================
  // GROUP 18: Webhooks (1 test)
  // =========================================================================
  pageTest('Webhooks', 'Webhook configuration page', '/webhooks'),

  // =========================================================================
  // GROUP 19: Help (1 test)
  // =========================================================================
  pageTest('Help', 'Help & Docs page', '/help'),

  // =========================================================================
  // GROUP 20: Settings (8 tests)
  // =========================================================================
  pageTest('Settings', 'Settings main page', '/settings'),
  pageTest('Settings', 'AI Diff settings', '/settings/ai-diff'),
  pageTest('Settings', 'AI Providers settings', '/settings/ai-providers'),
  pageTest('Settings', 'Repository settings', '/settings/repos'),
  pageTest('Settings', 'Storybook settings', '/settings/storybook'),
  pageTest('Settings', 'Fix policies', '/settings/fix-policies'),
  pageTest('Settings', 'Verification profiles', '/settings/verification-profiles'),
  pageTest('Settings', 'Runners', '/settings/runners'),

  // =========================================================================
  // GROUP 21: Projects (1 test)
  // =========================================================================
  pageTest('Projects', 'Create new project page', '/projects/new'),

  // =========================================================================
  // GROUP 22: Setup Wizards (1 test)
  // =========================================================================
  pageTest('Wizards', 'AI Diff setup wizard', '/settings/ai-diff/wizard'),
];
