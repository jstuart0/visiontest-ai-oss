'use client';

// Template gallery — Blueprint / library of reference drawings.
//
// Templates are reference drawings in a shared library. Each row is
// catalogued with a slug (R-XXX), title, goal summary, source (builtin
// / community), and use-count (revisions picked).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, TrendingUp } from 'lucide-react';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { useCurrentProject } from '@/hooks/useProject';
import { templatesApi, type Template } from '@/lib/api';

function refId(slug: string): string {
  let h = 5381;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) + h + slug.charCodeAt(i)) >>> 0;
  const n = (h % 900) + 100;
  return `R-${n}`;
}

function RuledSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex items-stretch"
      style={{ border: '1px solid var(--rule)' }}
    >
      <div
        className="px-3 py-2 shrink-0"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          borderRight: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {label}
      </div>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-2 transition-colors"
            style={{
              borderRight: i < options.length - 1 ? '1px solid var(--rule)' : 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: active ? 'var(--bg-0)' : 'var(--ink-1)',
              background: active ? 'var(--accent)' : 'transparent',
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'builtin' | 'community'>('all');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list(),
  });

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = query.toLowerCase().trim();
    return templates
      .filter((t) => sourceFilter === 'all' || t.source === sourceFilter)
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.storyText.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
        return a.title.localeCompare(b.title);
      });
  }, [templates, query, sourceFilter]);

  const pickTemplate = async (t: Template) => {
    if (project) {
      try {
        await templatesApi.pick(t.slug, project.id);
      } catch {
        /* non-fatal */
      }
    }
    router.push(`/tests/new?template=${encodeURIComponent(t.slug)}`);
  };

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <EditorialHero
      width="wide"
      sheet="03 · REFERENCE LIBRARY"
      eyebrow={`§ ${isoDate} · STORY SCAFFOLDS`}
      revision={<>REV · {String(filtered.length).padStart(3, '0')} · DRAWINGS</>}
      title={
        <>
          library of <em>reference drawings</em>.
        </>
      }
      lead={
        <>
          A catalog of proven story scaffolds. Pick one, substitute the
          tokens (<span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
            {'{{baseUrl}}'}
          </span>
          ,{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
            {'{{password}}'}
          </span>
          ), run it against your app.
        </>
      }
    >
      {/* Filter strip */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div
          className="flex items-stretch"
          style={{
            border: '1px solid var(--rule)',
            minWidth: '260px',
            flex: '1 1 260px',
            maxWidth: '420px',
          }}
        >
          <div
            className="px-3 flex items-center shrink-0"
            style={{
              borderRight: '1px solid var(--rule)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <Search className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
            QUERY
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search title or story…"
            className="vt-input"
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        <RuledSegmented<'all' | 'builtin' | 'community'>
          label="SOURCE"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { value: 'all', label: 'ALL' },
            { value: 'builtin', label: 'BUILTIN' },
            { value: 'community', label: 'COMMUNITY' },
          ]}
        />
      </div>

      {/* Schedule of reference drawings */}
      <div
        style={{
          border: '1px solid var(--rule-strong)',
          background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
        }}
      >
        {/* Header */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '90px minmax(180px, 1.1fr) minmax(260px, 2fr) 120px 100px 140px',
            borderBottom: '1px solid var(--rule-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          {['REF', 'NAME', 'SCAFFOLD', 'SOURCE', 'USED', 'ACTION'].map((h, i) => (
            <div
              key={h}
              className="py-3 px-4"
              style={{
                borderRight: i < 5 ? '1px solid var(--rule-soft)' : 'none',
                textAlign: i === 5 ? 'right' : 'left',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Body */}
        {isLoading ? (
          <div
            className="m-4 py-12 text-center"
            style={{
              border: '1px dashed var(--rule)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <span className="vt-breathe">loading reference library…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="m-4 py-16 text-center"
            style={{ border: '1px dashed var(--rule-strong)' }}
          >
            <div
              className="vt-kicker mb-3"
              style={{ color: 'var(--ink-2)', justifyContent: 'center', display: 'flex' }}
            >
              · · · no drawings match · · ·
            </div>
            <div
              className="vt-display"
              style={{
                fontSize: 'clamp(20px, 2.5vw, 28px)',
                color: 'var(--ink-1)',
              }}
            >
              nothing in the library <span style={{ color: 'var(--accent)' }}>·</span> refine the query
            </div>
          </div>
        ) : (
          filtered.map((t, idx) => (
            <div
              key={t.slug}
              className="grid group"
              style={{
                gridTemplateColumns: '90px minmax(180px, 1.1fr) minmax(260px, 2fr) 120px 100px 140px',
                borderBottom:
                  idx < filtered.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                transition: 'background var(--dur-quick)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--bg-2)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              {/* REF */}
              <div
                className="py-4 px-4 flex items-center"
                style={{
                  borderRight: '1px solid var(--rule-soft)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '0.14em',
                  color: 'var(--accent)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {refId(t.slug)}
              </div>

              {/* NAME */}
              <div
                className="py-4 px-4"
                style={{ borderRight: '1px solid var(--rule-soft)' }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    color: 'var(--ink-0)',
                    textTransform: 'lowercase',
                    letterSpacing: '0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  {t.title}
                </div>
                <div
                  className="mt-1"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--ink-2)',
                    lineHeight: 1.45,
                  }}
                >
                  {t.description}
                </div>
              </div>

              {/* SCAFFOLD PREVIEW */}
              <div
                className="py-4 px-4"
                style={{
                  borderRight: '1px solid var(--rule-soft)',
                }}
              >
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--ink-1)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '72px',
                    overflow: 'hidden',
                    lineHeight: 1.45,
                    border: '1px dashed var(--rule-soft)',
                    padding: '8px 10px',
                    background: 'color-mix(in oklab, var(--bg-2) 40%, transparent)',
                  }}
                >
                  {t.storyText.split('\n').slice(0, 4).join('\n')}
                  {t.storyText.split('\n').length > 4 && '\n…'}
                </pre>
              </div>

              {/* SOURCE */}
              <div
                className="py-4 px-4 flex items-center"
                style={{ borderRight: '1px solid var(--rule-soft)' }}
              >
                <span
                  className={`vt-chip ${
                    t.source === 'community' ? 'vt-chip--accent' : ''
                  }`}
                >
                  {t.source.toUpperCase()}
                </span>
              </div>

              {/* USED */}
              <div
                className="py-4 px-4 flex items-center"
                style={{
                  borderRight: '1px solid var(--rule-soft)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: t.usageCount > 0 ? 'var(--ink-1)' : 'var(--ink-3)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t.usageCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                    {String(t.usageCount).padStart(3, '0')}
                  </span>
                ) : (
                  '—'
                )}
              </div>

              {/* ACTION */}
              <div className="py-3 px-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => pickTemplate(t)}
                  className="vt-btn vt-btn--primary"
                  style={{ padding: '8px 14px' }}
                >
                  USE
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))
        )}

        {!isLoading && filtered.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderTop: '1px solid var(--rule-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>
              {filtered.length} OF {templates?.length || 0} DRAWINGS ·{' '}
              {sourceFilter.toUpperCase()}
            </span>
            <span>CHECKED · {isoDate}</span>
          </div>
        )}
      </div>
    </EditorialHero>
  );
}
