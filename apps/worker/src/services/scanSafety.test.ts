import { describe, it, expect } from 'vitest';
import { classifyElement, isLogout, shouldExercise } from './scanSafety';

describe('classifyElement', () => {
  it('marks "Delete" buttons as destructive', () => {
    const r = classifyElement({ text: 'Delete', selector: 'button.delete' });
    expect(r.destructive).toBe(true);
    expect(r.matchedPhrase).toBe('Delete');
  });

  it('allows benign "View" buttons', () => {
    const r = classifyElement({ text: 'View', selector: 'button.view' });
    expect(r.destructive).toBe(false);
  });

  it('matches aria-label "Remove item"', () => {
    const r = classifyElement({
      text: '',
      selector: 'button[aria-label="Remove item"]',
      ariaLabel: 'Remove item',
    });
    expect(r.destructive).toBe(true);
  });

  it('matches marker attributes (data-destructive)', () => {
    const r = classifyElement({
      text: 'Confirm',
      selector: '[data-destructive]',
      markerAttrs: ['data-destructive'],
    });
    expect(r.destructive).toBe(true);
  });

  it('matches destructive form action URL', () => {
    const r = classifyElement({
      text: 'Go',
      selector: 'button',
      formAction: '/api/orders/42/delete',
    });
    expect(r.destructive).toBe(true);
  });

  it('allowedSelectors override beats destructive text', () => {
    const r = classifyElement(
      { text: 'Delete this stale tag (safe)', selector: '#cleanup' },
      { allowedSelectors: ['#cleanup'] },
    );
    expect(r.destructive).toBe(false);
  });

  it('blockedSelectors override flags even benign text', () => {
    const r = classifyElement(
      { text: 'View', selector: '#risky-view' },
      { blockedSelectors: ['#risky-view'] },
    );
    expect(r.destructive).toBe(true);
  });

  it('augments default phrases with custom destructivePhrases', () => {
    const r = classifyElement(
      { text: 'Escalate', selector: 'button' },
      { destructivePhrases: ['escalate'] },
    );
    expect(r.destructive).toBe(true);
  });
});

describe('isLogout', () => {
  it('matches "Log out"', () => {
    expect(isLogout({ text: 'Log out', selector: 'button' })).toBe(true);
  });
  it('matches aria-label "Sign out of account"', () => {
    expect(
      isLogout({
        text: '',
        selector: 'button',
        ariaLabel: 'Sign out of account',
      }),
    ).toBe(true);
  });
  it('does not match unrelated "Log message"', () => {
    expect(isLogout({ text: 'Log message', selector: 'button' })).toBe(false);
  });
});

describe('shouldExercise', () => {
  it('read-only mode skips destructive elements with a reason', () => {
    const r = shouldExercise(
      { text: 'Delete', selector: 'button' },
      'read-only',
    );
    expect(r.exercise).toBe(false);
    expect(r.skipReason).toContain('read-only');
  });
  it('allow-destructive mode exercises destructive elements', () => {
    const r = shouldExercise(
      { text: 'Delete', selector: 'button' },
      'allow-destructive',
    );
    expect(r.exercise).toBe(true);
  });
  it('any mode skips logout (returns logout protection)', () => {
    const r = shouldExercise(
      { text: 'Log out', selector: 'button' },
      'allow-destructive',
    );
    expect(r.exercise).toBe(false);
    expect(r.skipReason).toBe('logout protection');
  });
  it('safe elements exercised in all modes', () => {
    expect(
      shouldExercise({ text: 'View', selector: 'a' }, 'read-only').exercise,
    ).toBe(true);
    expect(
      shouldExercise({ text: 'View', selector: 'a' }, 'allow-destructive')
        .exercise,
    ).toBe(true);
  });
});
