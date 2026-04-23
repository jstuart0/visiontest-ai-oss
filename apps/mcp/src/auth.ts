import type { VisionTestConfig } from './types.js';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function loadVisionTestConfig(): VisionTestConfig {
  const baseUrl = process.env.VISIONTEST_API_URL;
  const bearerToken = process.env.VISIONTEST_API_TOKEN;
  const apiKey = process.env.VISIONTEST_API_KEY;

  if (!baseUrl) {
    throw new Error('VISIONTEST_API_URL is required');
  }

  if (!bearerToken && !apiKey) {
    throw new Error('VISIONTEST_API_TOKEN or VISIONTEST_API_KEY is required');
  }

  return {
    baseUrl: stripTrailingSlash(baseUrl),
    bearerToken,
    apiKey,
  };
}
