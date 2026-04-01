// VisionTest.ai - SSRF Protection Utility
// Validates external URLs to prevent Server-Side Request Forgery attacks.
// Fail-closed: blocks private/reserved IPs, validates DNS resolution.

import { URL } from 'url';
import { isIP } from 'net';
import dns from 'dns/promises';

const BLOCKED_IPV4 = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
const BLOCKED_IPV6 = [
  /^::1$/, /^fc00:/i, /^fd00:/i, /^fe80:/i, /^::ffff:(127|10|192\.168)\./i,
];

const ALLOWED_INTERNAL_HOSTS = new Set(
  (process.env.INTERNAL_SERVICE_ALLOWLIST || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
);

function isBlockedIp(ip: string): boolean {
  for (const re of BLOCKED_IPV4) {
    if (re.test(ip)) return true;
  }
  for (const re of BLOCKED_IPV6) {
    if (re.test(ip)) return true;
  }
  return false;
}

export async function validateExternalUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`URL scheme '${parsed.protocol}' not allowed`);
  }
  const hostname = parsed.hostname;
  if (ALLOWED_INTERNAL_HOSTS.has(hostname)) return url;
  if (isIP(hostname)) {
    if (isBlockedIp(hostname))
      throw new Error(`IP '${hostname}' is in a blocked range`);
    return url;
  }
  let ipv4: string[] = [];
  let ipv6: string[] = [];
  try {
    ipv4 = await dns.resolve4(hostname);
  } catch {}
  try {
    ipv6 = await dns.resolve6(hostname);
  } catch {}
  const allIps = [...ipv4, ...ipv6];
  if (allIps.length === 0) {
    throw new Error(
      `Cannot resolve hostname '${hostname}' — request blocked`,
    );
  }
  for (const ip of allIps) {
    if (isBlockedIp(ip))
      throw new Error(
        `Hostname '${hostname}' resolves to blocked IP: ${ip}`,
      );
  }
  return url;
}

export async function safeFetch(
  input: string | URL | globalThis.Request,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  await validateExternalUrl(url);
  return fetch(input, { ...init, redirect: 'error' });
}
