'use client';

// ZoneBar — horizontal primary navigation beneath the top chrome.
// Six "zones" cover everything a user needs during authoring and
// reviewing. Secondary surfaces (Teams, Audit Log, API Keys, etc.)
// live in the command palette rather than cluttering the nav.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Zone {
  label: string;
  href: string;
  /** The prefix a path matches against; set to href for exact-only. */
  match?: (pathname: string) => boolean;
}

const ZONES: Zone[] = [
  { label: 'Dashboard', href: '/dashboard', match: (p) => p === '/dashboard' || p === '/' },
  { label: 'Tests',      href: '/tests',       match: (p) => p.startsWith('/tests') },
  { label: 'Runs',       href: '/executions',  match: (p) => p.startsWith('/executions') || p.startsWith('/runs') },
  { label: 'Scans',      href: '/scan',        match: (p) => p.startsWith('/scan') },
  { label: 'Baselines',  href: '/baselines',   match: (p) => p.startsWith('/baselines') },
  { label: 'Features',   href: '/features',    match: (p) => p.startsWith('/features') },
  { label: 'Templates',  href: '/templates',   match: (p) => p.startsWith('/templates') },
  { label: 'Credentials',href: '/credentials', match: (p) => p.startsWith('/credentials') },
];

export function ZoneBar() {
  const pathname = usePathname();
  return (
    <nav
      className="
        sticky top-[60px] z-30
        border-b bg-[var(--bg-0)]
        overflow-x-auto
      "
      style={{ borderColor: 'var(--rule)' }}
      aria-label="Primary"
    >
      <ul
        className="flex items-center gap-0 px-6 md:px-10 min-w-max"
      >
        {ZONES.map((zone) => {
          const active = zone.match ? zone.match(pathname) : pathname.startsWith(zone.href);
          return (
            <li key={zone.href} className="relative">
              <Link
                href={zone.href}
                className={`
                  inline-flex items-center h-[44px] px-4 md:px-5
                  vt-mono text-[11px] tracking-[0.18em] uppercase
                  transition-colors
                `}
                style={{
                  color: active ? 'var(--ink-0)' : 'var(--ink-2)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-0)')}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = active ? 'var(--ink-0)' : 'var(--ink-2)';
                }}
              >
                <span className="relative">
                  {zone.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 right-0 -bottom-[calc(44px/2-7px)] h-[2px]"
                      style={{
                        background: 'var(--accent)',
                        boxShadow: 'var(--accent-glow)',
                      }}
                    />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ZoneBar;
