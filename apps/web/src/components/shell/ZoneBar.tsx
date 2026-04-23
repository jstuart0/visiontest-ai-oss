'use client';

// ZoneBar — drawing-sheet index. Each zone is a numbered sheet in the set.
// Active zone shows an ochre revision dot + chalk underline.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Zone {
  label: string;
  href: string;
  match?: (pathname: string) => boolean;
}

const ZONES: Zone[] = [
  { label: 'Dashboard',    href: '/dashboard',   match: (p) => p === '/dashboard' || p === '/' },
  { label: 'Tests',        href: '/tests',       match: (p) => p.startsWith('/tests') },
  { label: 'Runs',         href: '/executions',  match: (p) => p.startsWith('/executions') || p.startsWith('/runs') },
  { label: 'Scans',        href: '/scan',        match: (p) => p.startsWith('/scan') },
  { label: 'Baselines',    href: '/baselines',   match: (p) => p.startsWith('/baselines') },
  { label: 'Features',     href: '/features',    match: (p) => p.startsWith('/features') },
  { label: 'Templates',    href: '/templates',   match: (p) => p.startsWith('/templates') },
  { label: 'Credentials',  href: '/credentials', match: (p) => p.startsWith('/credentials') },
];

export function ZoneBar() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky top-[60px] z-30 overflow-x-auto"
      style={{
        background: 'color-mix(in oklab, var(--bg-0) 85%, transparent)',
        borderBottom: '1px solid var(--rule)',
        backdropFilter: 'blur(6px)',
      }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch gap-0 px-6 md:px-10 min-w-max">
        {ZONES.map((zone, idx) => {
          const active = zone.match ? zone.match(pathname) : pathname.startsWith(zone.href);
          const sheetNum = String(idx + 1).padStart(2, '0');
          return (
            <li key={zone.href}>
              <Link
                href={zone.href}
                className="relative inline-flex items-center gap-3 h-[44px] px-5 transition-colors"
                style={{
                  color: active ? 'var(--ink-0)' : 'var(--ink-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontVariantNumeric: 'tabular-nums',
                  borderRight: idx === ZONES.length - 1 ? '1px solid transparent' : '1px solid var(--rule-soft)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-0)')}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = active ? 'var(--ink-0)' : 'var(--ink-2)';
                }}
              >
                <span
                  style={{
                    color: active ? 'var(--accent)' : 'var(--ink-3)',
                    fontSize: '9px',
                    letterSpacing: '0.24em',
                  }}
                >
                  SHT{sheetNum}
                </span>
                <span>{zone.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 bottom-0 h-[1px]"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-[50%] w-[6px] h-[6px] -translate-y-1/2 -translate-x-1/2"
                    style={{ background: 'var(--accent)', transform: 'translate(-50%, -50%) rotate(45deg)' }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ZoneBar;
