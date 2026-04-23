import { describe, it, expect } from 'vitest';
import { importBugReport } from './bugReportImport.service';

describe('importBugReport', () => {
  it('extracts title from markdown heading', () => {
    const r = importBugReport(`# Login fails with valid credentials

## Steps to reproduce
1. Go to /login
2. Enter valid email + password
3. Click "Sign in"

## Expected result
User is redirected to /dashboard

## Actual result
"Invalid credentials" toast appears`);
    expect(r.title).toBe('Login fails with valid credentials');
  });

  it('extracts steps as story sentences (numeric prefixes stripped)', () => {
    const r = importBugReport(`## Steps to reproduce
1. Go to /login
2. Click "Sign in"
`);
    expect(r.story.split('\n')).toEqual(['Go to /login', 'Click "Sign in"']);
  });

  it('converts expected "redirected to X" into URL contains goal', () => {
    const r = importBugReport(`## Expected result
User is redirected to /dashboard.`);
    expect(r.goal).toContain('The URL contains /dashboard');
  });

  it('converts expected "X is displayed" into visible goal', () => {
    const r = importBugReport(`## Expected
"Welcome back" is displayed`);
    expect(r.goal).toContain('"Welcome back" is visible');
  });

  it('converts actual result error quotes into NOT visible assertions', () => {
    const r = importBugReport(`## Actual
"Invalid credentials" toast appears`);
    expect(r.negativeAssertions).toContain('"Invalid credentials" is NOT visible');
  });

  it('handles bold-style headings (GitHub-flavoured)', () => {
    const r = importBugReport(`**Steps to reproduce**
- Click "Sign in"

**Expected**
Page shows "Dashboard"

**Actual**
Page shows "Error"`);
    expect(r.story).toContain('Click "Sign in"');
    expect(r.goal).toContain('"Dashboard" is visible');
    expect(r.negativeAssertions).toContain('"Error" is NOT visible');
  });

  it('returns leftover lines that were not classified', () => {
    const r = importBugReport(`Just a loose sentence that isn't in any section.

## Steps
1. Go to /x`);
    expect(r.story.split('\n')).toContain('Go to /x');
    expect(r.leftoverLines.length).toBeGreaterThan(0);
  });
});
