#!/usr/bin/env npx tsx
/**
 * VisionTest VRT Upload Script
 *
 * Reads screenshots from a directory, groups them by variant (desktop-light,
 * desktop-dark, mobile), and uploads them to VisionTest as baselines and/or
 * comparison runs.
 *
 * Usage:
 *   npx tsx scripts/upload-vrt.ts --baseline          # Upload baselines only
 *   npx tsx scripts/upload-vrt.ts --compare           # Upload comparison run only
 *   npx tsx scripts/upload-vrt.ts --baseline --compare # Both
 *   npx tsx scripts/upload-vrt.ts                     # Default: both
 *
 * Options:
 *   --dir <path>       Screenshot directory (default: ./screenshots/)
 *   --api <url>        API base URL (default: http://localhost:3001/api/v1)
 *   --project <id>     Project ID
 *   --email <email>    Login email (default: admin@visiontest.local)
 *   --password <pass>  Login password
 *   --baseline         Upload as baselines
 *   --compare          Upload as comparison runs
 *   --clean            Delete existing baselines before uploading
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIG
// =============================================================================

const args = process.argv.slice(2);

function getArg(flag: string, defaultValue: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const SCREENSHOT_DIR = getArg('--dir', './screenshots');
const API_BASE = getArg('--api', process.env.VISIONTEST_API_URL || 'http://localhost:3001/api/v1');
const PROJECT_ID = getArg('--project', process.env.VISIONTEST_PROJECT_ID || '');
const EMAIL = getArg('--email', process.env.VISIONTEST_EMAIL || 'admin@visiontest.local');
const PASSWORD = getArg('--password', process.env.VISIONTEST_PASSWORD || '');
const DO_BASELINE = args.includes('--baseline') || (!args.includes('--compare'));
const DO_COMPARE = args.includes('--compare') || (!args.includes('--baseline'));
const DO_CLEAN = args.includes('--clean');

// =============================================================================
// HELPERS
// =============================================================================

interface ScreenshotGroup {
  suiteName: string;
  theme: string;
  device: string;
  viewport: { width: number; height: number };
  screenshots: Array<{
    name: string;
    filePath: string;
    theme: string;
    deviceType: string;
  }>;
}

function groupScreenshots(dir: string): ScreenshotGroup[] {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();

  const groups: Record<string, ScreenshotGroup> = {};

  for (const file of files) {
    // Pattern: {pageName}-{theme}-{device}.png
    // e.g., admin-dark-desktop.png, ai-chat-light-mobile.png
    const match = file.match(/^(.+)-(light|dark)-(desktop|mobile)\.png$/);
    if (!match) {
      console.warn(`Skipping unrecognized file: ${file}`);
      continue;
    }

    const [, pageName, theme, device] = match;
    const groupKey = `${device}-${theme}`;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        suiteName: groupKey,
        theme,
        device,
        viewport: device === 'mobile'
          ? { width: 375, height: 812 }
          : { width: 1280, height: 720 },
        screenshots: [],
      };
    }

    groups[groupKey].screenshots.push({
      name: `${pageName}-${theme}-${device}`,
      filePath: path.join(dir, file),
      theme,
      deviceType: device,
    });
  }

  return Object.values(groups);
}

async function apiRequest(
  endpoint: string,
  method: string,
  token: string,
  body?: unknown
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${endpoint} failed (${response.status}): ${text}`);
  }

  return response.json();
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('=== VisionTest VRT Upload ===');
  console.log(`Directory: ${SCREENSHOT_DIR}`);
  console.log(`API: ${API_BASE}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Baseline: ${DO_BASELINE}, Compare: ${DO_COMPARE}, Clean: ${DO_CLEAN}`);
  console.log();

  // Verify directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    console.error(`Screenshot directory not found: ${SCREENSHOT_DIR}`);
    process.exit(1);
  }

  // Group screenshots
  const groups = groupScreenshots(SCREENSHOT_DIR);
  const totalScreenshots = groups.reduce((sum, g) => sum + g.screenshots.length, 0);
  console.log(`Found ${totalScreenshots} screenshots in ${groups.length} groups:`);
  for (const group of groups) {
    console.log(`  ${group.suiteName}: ${group.screenshots.length} screenshots`);
  }
  console.log();

  // Authenticate
  console.log('Authenticating...');
  const loginResp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!loginResp.ok) {
    const text = await loginResp.text();
    console.error(`Login failed: ${text}`);
    process.exit(1);
  }

  const loginData = await loginResp.json();
  const token = loginData.data?.accessToken || loginData.accessToken;
  console.log('Authenticated ✓\n');

  // Clean existing baselines if requested
  if (DO_CLEAN) {
    console.log('Cleaning existing baselines...');
    const baselinesResp = await apiRequest(`/baselines?projectId=${PROJECT_ID}`, 'GET', token);
    const baselines = baselinesResp.data || baselinesResp;
    for (const baseline of baselines) {
      console.log(`  Deleting baseline: ${baseline.name} (${baseline.id})`);
      await apiRequest(`/baselines/${baseline.id}`, 'DELETE', token);
    }
    console.log(`Deleted ${baselines.length} baselines\n`);
  }

  // Upload baselines
  if (DO_BASELINE) {
    console.log('=== Uploading Baselines ===\n');

    for (const group of groups) {
      console.log(`Uploading baseline: ${group.suiteName} (${group.screenshots.length} screenshots)...`);

      const screenshotPayloads = group.screenshots.map((s) => {
        const imageBuffer = fs.readFileSync(s.filePath);
        const base64 = imageBuffer.toString('base64');
        return {
          name: s.name,
          image: `data:image/png;base64,${base64}`,
          viewport: group.viewport,
          theme: s.theme as 'light' | 'dark',
          deviceType: s.deviceType,
          deviceName: s.deviceType === 'mobile' ? 'iPhone 15' : 'Desktop Chrome',
        };
      });

      const reportBody = {
        projectId: PROJECT_ID,
        testName: 'VRT Upload',
        suiteName: group.suiteName,
        branch: 'main',
        platform: group.device === 'mobile' ? 'MOBILE_WEB' : 'WEB',
        isBaseline: true,
        screenshots: screenshotPayloads,
        metadata: {
          source: 'upload-script',
          uploadedAt: new Date().toISOString(),
        },
      };

      const result = await apiRequest('/executions/report', 'POST', token, reportBody);
      const data = result.data || result;
      console.log(`  ✓ Baseline created: ${data.baseline}`);
      console.log(`  Execution: ${data.execution?.id}`);
      console.log(`  Screenshots uploaded: ${data.screenshots?.length || 0}\n`);
    }
  }

  // Upload comparison runs
  if (DO_COMPARE) {
    console.log('=== Uploading Comparison Runs ===\n');

    for (const group of groups) {
      console.log(`Uploading comparison: ${group.suiteName} (${group.screenshots.length} screenshots)...`);

      const screenshotPayloads = group.screenshots.map((s) => {
        const imageBuffer = fs.readFileSync(s.filePath);
        const base64 = imageBuffer.toString('base64');
        return {
          name: s.name,
          image: `data:image/png;base64,${base64}`,
          viewport: group.viewport,
          theme: s.theme as 'light' | 'dark',
          deviceType: s.deviceType,
          deviceName: s.deviceType === 'mobile' ? 'iPhone 15' : 'Desktop Chrome',
        };
      });

      const reportBody = {
        projectId: PROJECT_ID,
        testName: 'VRT Upload',
        suiteName: group.suiteName,
        branch: 'main',
        platform: group.device === 'mobile' ? 'MOBILE_WEB' : 'WEB',
        isBaseline: false,
        screenshots: screenshotPayloads,
        metadata: {
          source: 'upload-script',
          uploadedAt: new Date().toISOString(),
        },
      };

      const result = await apiRequest('/executions/report', 'POST', token, reportBody);
      const data = result.data || result;
      console.log(`  Execution: ${data.execution?.id}`);
      console.log(`  Screenshots uploaded: ${data.screenshots?.length || 0}`);

      if (data.comparisons) {
        console.log(`  Comparisons: ${data.comparisons.total} total`);
        console.log(`    Matched: ${data.comparisons.matched}`);
        console.log(`    Diffs: ${data.comparisons.diffDetected}`);
        console.log(`    New: ${data.comparisons.newScreenshots}`);
      } else {
        console.log(`  No comparisons generated (no matching baseline?)`);
      }
      console.log();
    }
  }

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
