// testParser — regression tests for the sentence splitter

import { describe, it, expect } from 'vitest';
import { parseNaturalLanguage } from './testParser.service';

describe('parseNaturalLanguage — sentence splitter', () => {
  it('protects URLs from being split at dots', async () => {
    const r = await parseNaturalLanguage(
      'Go to https://example.com. Click the "Sign in" button.',
    );
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]).toMatchObject({
      type: 'navigate',
      url: 'https://example.com',
    });
    expect(r.steps[1].type).toBe('click');
  });

  it('handles URLs with query strings and paths', async () => {
    const r = await parseNaturalLanguage(
      'Navigate to https://app.test.io/users?role=admin&sort=name. Take a screenshot.',
    );
    expect(r.steps[0]).toMatchObject({
      type: 'navigate',
      url: 'https://app.test.io/users?role=admin&sort=name',
    });
    expect(r.steps[1].type).toBe('screenshot');
  });

  it('protects quoted fragments with internal periods', async () => {
    const r = await parseNaturalLanguage(
      'Click "V1.0. Release". Take a screenshot.',
    );
    // First sentence should contain the full quoted "V1.0. Release"
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].type).toBe('click');
    expect(r.steps[1].type).toBe('screenshot');
  });

  it('splits on newlines', async () => {
    const r = await parseNaturalLanguage(
      'Go to https://example.com\nClick the login button\nTake a screenshot',
    );
    expect(r.steps).toHaveLength(3);
  });

  it('splits on "then"', async () => {
    const r = await parseNaturalLanguage(
      'Go to https://example.com then click the button then take a screenshot',
    );
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0].type).toBe('navigate');
    expect(r.steps[2].type).toBe('screenshot');
  });
});
