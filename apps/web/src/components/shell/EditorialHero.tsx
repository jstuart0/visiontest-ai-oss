'use client';

// EditorialHero — the shared masthead that every dashboard page opens
// with. Accepts an optional back-link (for detail pages), an eyebrow
// kicker, a Fraunces display headline (React node so you can embed an
// <em>), an italic lede, and a right-aligned action slot. Keeps the
// redesign consistent without re-copying the boilerplate on every page.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Back {
  href?: string;            // explicit href, or omit for router.back()
  label?: string;           // short, lowercase — "back", "all tests"
}

export interface EditorialHeroProps {
  eyebrow?: string;                         // "§ Runs · History"
  title: React.ReactNode;                   // full Fraunces heading
  lead?: React.ReactNode;                   // italic serif sub-line
  back?: Back;                              // optional back affordance
  actions?: React.ReactNode;                // right-side action area
  /** Max width of the page container (the editorial "column"). */
  width?: 'narrow' | 'wide' | 'fluid';
  /** Children render INSIDE the max-width container but under the header. */
  children?: React.ReactNode;
}

export function EditorialHero({
  eyebrow,
  title,
  lead,
  back,
  actions,
  width = 'wide',
  children,
}: EditorialHeroProps) {
  const router = useRouter();
  const max =
    width === 'narrow' ? 'max-w-[860px]' :
    width === 'fluid' ? 'max-w-none' :
    'max-w-[1320px]';

  return (
    <div className={`${max} mx-auto px-6 md:px-12 py-10 vt-reveal`}>
      <header className="pb-7 border-b" style={{ borderColor: 'var(--rule)' }}>
        {(back || eyebrow) && (
          <div className="flex items-center gap-4 mb-5 flex-wrap">
            {back && (
              <button
                type="button"
                onClick={() => (back.href ? router.push(back.href) : router.back())}
                className="vt-kicker inline-flex items-center gap-2 transition-colors"
                style={{ color: 'var(--ink-2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
              >
                <ArrowLeft className="w-3 h-3" />
                {back.label || 'back'}
              </button>
            )}
            {eyebrow && (
              <span
                className="vt-kicker"
                style={{ color: back ? 'var(--brass)' : 'var(--accent)' }}
              >
                {eyebrow}
              </span>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <h1
              className="vt-display"
              style={{
                fontSize: 'clamp(36px, 5.5vw, 72px)',
                lineHeight: 0.98,
                letterSpacing: '-0.028em',
              }}
            >
              {title}
            </h1>
            {lead && (
              <p
                className="mt-4 vt-italic"
                style={{
                  fontVariationSettings: '"opsz" 24',
                  fontSize: '17px',
                  color: 'var(--ink-1)',
                  maxWidth: '62ch',
                }}
              >
                {lead}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </header>
      {children && <div className="mt-10 space-y-10">{children}</div>}
    </div>
  );
}

export default EditorialHero;
