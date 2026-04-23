// Goal Compiler — Layer-1 deterministic pattern tests

import { describe, it, expect } from 'vitest';
import { compileGoal, hasUnresolvedClauses } from './goalCompiler.service';

describe('compileGoal', () => {
  describe('URL patterns', () => {
    it('matches "URL is X"', () => {
      const r = compileGoal('The URL is https://example.com/orders');
      expect(r.checks).toEqual([
        {
          kind: 'url',
          urlOp: 'is',
          value: 'https://example.com/orders',
          source: 'The URL is https://example.com/orders',
        },
      ]);
      expect(r.unresolvedClauses).toEqual([]);
    });

    it('matches "URL contains X"', () => {
      const r = compileGoal('url contains /orders/42');
      expect(r.checks[0].kind).toBe('url');
      expect(r.checks[0].urlOp).toBe('contains');
      expect(r.checks[0].value).toBe('/orders/42');
    });

    it('matches "URL ends with X"', () => {
      const r = compileGoal('The URL ends with /complete');
      expect(r.checks[0].urlOp).toBe('endsWith');
      expect(r.checks[0].value).toBe('/complete');
    });

    it('matches "lands on X" with bare path → contains', () => {
      const r = compileGoal('The page lands on /dashboard');
      expect(r.checks[0].kind).toBe('url');
      expect(r.checks[0].urlOp).toBe('contains');
      expect(r.checks[0].value).toBe('/dashboard');
    });

    it('matches "lands on" full URL → is', () => {
      const r = compileGoal('The page lands on https://example.com/x');
      expect(r.checks[0].urlOp).toBe('is');
    });
  });

  describe('visibility patterns', () => {
    it('matches "X is visible"', () => {
      const r = compileGoal('"Welcome back" is visible');
      expect(r.checks[0]).toMatchObject({
        kind: 'visible',
        selector: 'text=Welcome back',
      });
    });

    it('matches "X is shown"', () => {
      const r = compileGoal('"Acme Inc" is shown');
      expect(r.checks[0].kind).toBe('visible');
      expect(r.checks[0].selector).toBe('text=Acme Inc');
    });

    it('matches "the page shows X"', () => {
      const r = compileGoal('The page shows "Reference copied"');
      expect(r.checks[0].kind).toBe('visible');
      expect(r.checks[0].selector).toBe('text=Reference copied');
    });
  });

  describe('hidden / NOT-visible patterns', () => {
    it('matches "X is not visible"', () => {
      const r = compileGoal('"Error" is not visible');
      expect(r.checks[0]).toMatchObject({
        kind: 'hidden',
        selector: 'text=Error',
      });
    });

    it('matches "X is hidden"', () => {
      const r = compileGoal('"Loading" is hidden');
      expect(r.checks[0].kind).toBe('hidden');
    });

    it('matches "no X"', () => {
      const r = compileGoal('No "Internal Server Error"');
      expect(r.checks[0].kind).toBe('hidden');
      expect(r.checks[0].selector).toBe('text=Internal Server Error');
    });

    it('matches "does not show X"', () => {
      const r = compileGoal('The page does not show "failed to list tokens"');
      expect(r.checks[0].kind).toBe('hidden');
    });
  });

  describe('enabled / disabled patterns', () => {
    it('matches "#id is enabled"', () => {
      const r = compileGoal('#submit-button is enabled');
      expect(r.checks[0]).toMatchObject({
        kind: 'enabled',
        selector: '#submit-button',
      });
    });

    it('matches "#id is disabled"', () => {
      const r = compileGoal('button #submit is disabled');
      expect(r.checks[0].kind).toBe('disabled');
      expect(r.checks[0].selector).toBe('#submit');
    });
  });

  describe('count patterns', () => {
    it('matches "N items are shown"', () => {
      const r = compileGoal('5 items are visible');
      expect(r.checks[0]).toMatchObject({
        kind: 'count',
        value: '5',
      });
    });

    it('matches "N rows visible"', () => {
      const r = compileGoal('3 rows are shown');
      expect(r.checks[0].selector).toBe('tr');
    });

    it('matches "N results"', () => {
      const r = compileGoal('10 results are listed');
      expect(r.checks[0].kind).toBe('count');
      expect(r.checks[0].value).toBe('10');
    });
  });

  describe('multi-clause goals', () => {
    it('splits goal into multiple checks', () => {
      const r = compileGoal(
        'The URL contains /orders. "Acme Inc" is visible. 3 rows are shown.',
      );
      expect(r.checks).toHaveLength(3);
      expect(r.checks[0].kind).toBe('url');
      expect(r.checks[1].kind).toBe('visible');
      expect(r.checks[2].kind).toBe('count');
    });

    it('collects unresolved clauses separately', () => {
      const r = compileGoal(
        'The URL contains /orders. The customer experience should feel smooth and professional.',
      );
      expect(r.checks).toHaveLength(1);
      expect(r.unresolvedClauses).toHaveLength(1);
      expect(r.unresolvedClauses[0]).toMatch(/customer experience/);
    });
  });

  describe('hasUnresolvedClauses', () => {
    it('returns false when all clauses compile', () => {
      expect(
        hasUnresolvedClauses('The URL contains /x. "Y" is visible.'),
      ).toBe(false);
    });

    it('returns true when any clause is unresolved', () => {
      expect(
        hasUnresolvedClauses('The URL contains /x. User feels happy.'),
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('empty goal returns empty result', () => {
      const r = compileGoal('');
      expect(r.checks).toEqual([]);
      expect(r.unresolvedClauses).toEqual([]);
    });

    it('whitespace-only goal returns empty result', () => {
      const r = compileGoal('   \n\n  ');
      expect(r.checks).toEqual([]);
      expect(r.unresolvedClauses).toEqual([]);
    });
  });
});
