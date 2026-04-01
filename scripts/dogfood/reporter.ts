/**
 * VisionTest AI Dogfood - Report Generator
 *
 * Writes a progressive markdown checklist to docs/dogfood-results.md.
 * Updated after each test completes so you can watch progress in real time.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestResult {
  group: string;
  name: string;
  testId: string;
  executionId: string;
  status: 'PASSED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED' | 'SKIPPED' | 'ERROR';
  duration?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

export class Reporter {
  private results: TestResult[] = [];
  private outputPath: string;
  private startTime: number;

  constructor(outputDir: string = path.resolve(__dirname, '../../docs')) {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    this.outputPath = path.join(outputDir, 'dogfood-results.md');
    this.startTime = Date.now();
  }

  /** Record a result and rewrite the report file. */
  record(result: TestResult) {
    this.results.push(result);
    this.write();
  }

  /** Get the output file path. */
  getOutputPath(): string {
    return this.outputPath;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private write() {
    const passed = this.results.filter((r) => r.status === 'PASSED').length;
    const failed = this.results.filter((r) => r.status !== 'PASSED').length;
    const total = this.results.length;
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);

    const lines: string[] = [
      '# VisionTest AI - Dogfood Test Results',
      '',
      `**Run date:** ${new Date().toISOString()}`,
      `**Elapsed:** ${elapsed}s`,
      `**Total tests:** ${total}`,
      `**Passed:** ${passed} | **Failed:** ${failed} | **Pass rate:** ${pct}%`,
      '',
    ];

    // Group results
    const groups = new Map<string, TestResult[]>();
    for (const r of this.results) {
      const arr = groups.get(r.group) || [];
      arr.push(r);
      groups.set(r.group, arr);
    }

    for (const [group, items] of groups) {
      lines.push(`## ${group}`, '');
      for (const r of items) {
        const check = r.status === 'PASSED' ? 'x' : ' ';
        const dur = r.duration ? ` (${(r.duration / 1000).toFixed(1)}s)` : '';
        const note = r.status !== 'PASSED' ? ` - **${r.status}**` : '';
        const err = r.error ? `: ${r.error.slice(0, 120)}` : '';
        lines.push(`- [${check}] ${r.name}${dur}${note}${err}`);
      }
      lines.push('');
    }

    // Summary table
    lines.push('## Summary', '', '| Group | Pass | Fail | Total |', '|-------|------|------|-------|');
    for (const [group, items] of groups) {
      const p = items.filter((r) => r.status === 'PASSED').length;
      const f = items.length - p;
      lines.push(`| ${group} | ${p} | ${f} | ${items.length} |`);
    }
    lines.push('');

    fs.writeFileSync(this.outputPath, lines.join('\n'), 'utf-8');
  }
}
