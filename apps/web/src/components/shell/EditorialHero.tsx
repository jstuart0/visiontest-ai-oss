'use client';

// EditorialHero — repurposed as the Blueprint sheet masthead.
// Each page opens with: sheet number + revision stamp + title + lede.
// Kept the old component name so callers don't break.

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Back {
  href?: string;
  label?: string;
}

export interface EditorialHeroProps {
  eyebrow?: string;           // e.g. "SHT · 03 · RUNS"
  title: React.ReactNode;
  lead?: React.ReactNode;
  back?: Back;
  actions?: React.ReactNode;
  width?: 'narrow' | 'wide' | 'fluid';
  children?: React.ReactNode;
  /** Optional section number to show in the title-block style. */
  sheet?: string;             // "03 OF 14"
  /** Optional revision stamp on the right of the masthead. */
  revision?: React.ReactNode; // "REV · 02 · 2026.04.23"
}

export function EditorialHero({
  eyebrow,
  title,
  lead,
  back,
  actions,
  width = 'wide',
  children,
  sheet,
  revision,
}: EditorialHeroProps) {
  const router = useRouter();
  const max =
    width === 'narrow' ? 'max-w-[860px]' :
    width === 'fluid' ? 'max-w-none' :
    'max-w-[1440px]';

  return (
    <div className={`${max} mx-auto px-6 md:px-10 py-6 vt-reveal`}>
      <header className="pb-5" style={{ borderBottom: '1px solid var(--rule-strong)' }}>
        {(back || eyebrow || sheet || revision) && (
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {back && (
              <button
                type="button"
                onClick={() => (back.href ? router.push(back.href) : router.back())}
                className="vt-kicker inline-flex items-center gap-2 transition-colors"
                style={{ color: 'var(--ink-2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
              >
                <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
                {back.label || 'BACK'}
              </button>
            )}
            {sheet && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                  paddingRight: '16px',
                  borderRight: '1px solid var(--rule)',
                }}
              >
                SHT · {sheet}
              </span>
            )}
            {eyebrow && (
              <span className="vt-kicker" style={{ color: 'var(--accent)' }}>
                {eyebrow}
              </span>
            )}
            {revision && (
              <span className="ml-auto">
                <span className="vt-rev-stamp">{revision}</span>
              </span>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <h1
              className="vt-display"
              style={{
                fontSize: 'clamp(26px, 3.5vw, 44px)',
                lineHeight: 1.0,
                letterSpacing: '-0.01em',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
              }}
            >
              {title}
            </h1>
            {lead && (
              <p
                className="mt-4"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '15px',
                  color: 'var(--ink-1)',
                  maxWidth: '64ch',
                  lineHeight: 1.5,
                }}
              >
                {lead}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </header>
      {children && <div className="mt-8 space-y-8">{children}</div>}
    </div>
  );
}

export default EditorialHero;
