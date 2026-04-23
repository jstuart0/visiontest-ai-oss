'use client';

// Audit log — the drafting-log printout.
// Each entry is a timestamped row in a ruled table. Verbs (created /
// updated / deleted / triggered) render lowercase in the display face;
// actor in mono; object in display. No cards. Filters as ruled
// segmented controls.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

type Verb = 'all' | 'created' | 'updated' | 'deleted' | 'triggered' | 'approved' | 'rejected' | 'signed';

export default function AuditLogPage() {
  const { project } = useCurrentProject();
  const orgId = project?.orgId;
  const [filter, setFilter] = useState<Verb>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', orgId],
    queryFn: () => organizationsApi.auditLog(orgId!, { limit: '100' }),
    enabled: !!orgId,
  });

  const logs: any[] = data?.data || data || [];
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const filtered = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((l) => verbFor(l.action) === filter || verbFor(l.action).startsWith(filter));
  }, [logs, filter]);

  // Group entries by calendar day for day-banner rows.
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const l of filtered) {
      const d = new Date(l.createdAt);
      const key = d.toISOString().slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return Array.from(m.entries());
  }, [filtered]);

  if (!orgId) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> —<br /> no record to read.
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: 'var(--ink-1)', maxWidth: '56ch' }}>
          The audit log is scoped to the project&apos;s organization.
        </p>
      </VtStage>
    );
  }

  // Verb counts for the summary strip.
  const counts: Record<Verb, number> = {
    all: logs.length,
    created: 0, updated: 0, deleted: 0, triggered: 0, approved: 0, rejected: 0, signed: 0,
  };
  for (const l of logs) {
    const v = verbFor(l.action);
    if (v in counts) counts[v as Verb] += 1;
  }

  const filters: Array<{ key: Verb; label: string }> = [
    { key: 'all', label: 'all' },
    { key: 'created', label: 'created' },
    { key: 'updated', label: 'updated' },
    { key: 'deleted', label: 'deleted' },
    { key: 'triggered', label: 'triggered' },
    { key: 'approved', label: 'approved' },
    { key: 'rejected', label: 'rejected' },
    { key: 'signed', label: 'signed' },
  ];

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`11 / 14`}
        eyebrow={`§ 11 · RECORD`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            the <em>record</em>.
          </>
        }
        lead={
          'Every action, every actor, every resource. A printed page for when someone asks "who changed that?" — stamped, ruled, filed.'
        }
      >
        {/* ── Title block ─────────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">ORGANIZATION</span>
            <span className="v big">{project!.name}</span>
          </div>
          <div className="span2">
            <span className="k">ENTRIES LOGGED</span>
            <span className="v">{String(logs.length).padStart(4, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div className="span2">
            <span className="k">VIEWING</span>
            <span className="v">
              {filter.toUpperCase()} · {String(filtered.length).padStart(3, '0')} ENTRIES
            </span>
          </div>
          <div className="span2">
            <span className="k">DAYS</span>
            <span className="v">{String(grouped.length).padStart(2, '0')}</span>
          </div>
        </div>

        {/* ── §01 · Filter segmented control ──────────────────────────── */}
        <section aria-labelledby="filter-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="filter-head">filter by verb</span>
            <span className="rule" />
            <span className="stamp">SEGMENTED · {filters.length - 1} VERBS</span>
          </div>

          <div
            className="flex flex-wrap"
            style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}
          >
            {filters.map((f, i) => {
              const isActive = filter === f.key;
              const n = counts[f.key] || 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className="flex items-baseline gap-3 px-5 py-3"
                  style={{
                    borderRight: i < filters.length - 1 ? '1px solid var(--rule)' : 'none',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--ink-1)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '15px',
                      textTransform: 'lowercase',
                      color: isActive ? 'var(--accent)' : 'var(--ink-0)',
                    }}
                  >
                    {f.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      color: isActive ? 'var(--accent)' : 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(n).padStart(2, '0')}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── §02 · Drafting-log printout ─────────────────────────────── */}
        <section aria-labelledby="log-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="log-head">drafting log</span>
            <span className="rule" />
            <span className="stamp">
              {isLoading
                ? 'TRACING…'
                : filtered.length === 0
                ? 'NO ENTRIES'
                : `${filtered.length} ENTR${filtered.length === 1 ? 'Y' : 'IES'}`}
            </span>
          </div>

          {isLoading ? (
            <LoadingFrame />
          ) : filtered.length === 0 ? (
            <EmptyFrame />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              {/* Header row */}
              <div
                className="grid grid-cols-[90px_100px_140px_1fr_140px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['ENTRY', 'STAMP', 'ACTOR', 'VERB · OBJECT', 'CAT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 4 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 4 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Day banners + entry rows */}
              {(() => {
                let entryCount = 0;
                return grouped.map(([day, entries]) => {
                  const banner = new Date(day).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });
                  return (
                    <div key={day}>
                      {/* Day banner */}
                      <div
                        className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5"
                        style={{
                          borderBottom: '1px solid var(--rule)',
                          borderTop: '1px solid var(--rule-soft)',
                          background: 'color-mix(in oklab, var(--bg-2) 30%, transparent)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '14px',
                            textTransform: 'lowercase',
                            color: 'var(--ink-0)',
                          }}
                        >
                          {banner.toLowerCase()}
                        </span>
                        <span
                          className="vt-mono"
                          style={{
                            fontSize: '9.5px',
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-2)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {entries.length} ENTR{entries.length === 1 ? 'Y' : 'IES'}
                        </span>
                      </div>

                      {entries.map((log: any, i: number) => {
                        entryCount += 1;
                        const idx = entryCount;
                        const verb = verbFor(log.action);
                        return (
                          <div
                            key={log.id}
                            className="grid grid-cols-[90px_100px_140px_1fr_140px] gap-0"
                            style={{
                              borderBottom: i < entries.length - 1 ? '1px solid var(--rule-soft)' : '1px solid var(--rule)',
                              animation: `vt-reveal var(--dur-reveal) ${i * 18}ms var(--ease-out) both`,
                            }}
                          >
                            <div
                              className="py-3 px-4"
                              style={{
                                borderRight: '1px solid var(--rule-soft)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10.5px',
                                letterSpacing: '0.14em',
                                color: 'var(--accent)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              L-{String(idx).padStart(4, '0')}
                            </div>
                            <div
                              className="py-3 px-4"
                              style={{
                                borderRight: '1px solid var(--rule-soft)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10.5px',
                                letterSpacing: '0.06em',
                                color: 'var(--ink-2)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {new Date(log.createdAt).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                              })}
                            </div>
                            <div
                              className="py-3 px-4 truncate"
                              style={{
                                borderRight: '1px solid var(--rule-soft)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '12px',
                                letterSpacing: '0.04em',
                                color: 'var(--ink-1)',
                              }}
                            >
                              {log.user?.name || log.user?.email || 'system'}
                            </div>
                            <div
                              className="py-3 px-4"
                              style={{
                                borderRight: '1px solid var(--rule-soft)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '13.5px',
                                color: 'var(--ink-0)',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--font-display)',
                                  fontSize: '15px',
                                  textTransform: 'lowercase',
                                  color: verbColor(verb),
                                  marginRight: '8px',
                                }}
                              >
                                {verb}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-display)',
                                  fontSize: '14px',
                                  textTransform: 'lowercase',
                                  color: 'var(--ink-0)',
                                }}
                              >
                                {log.resource || '—'}
                              </span>
                              {log.resourceId && (
                                <span
                                  className="vt-mono"
                                  style={{
                                    color: 'var(--ink-2)',
                                    fontSize: '10.5px',
                                    letterSpacing: '0.08em',
                                    marginLeft: '8px',
                                  }}
                                >
                                  #{String(log.resourceId).slice(0, 8)}
                                </span>
                              )}
                              {log.details && (
                                <div
                                  className="vt-mono mt-1"
                                  style={{
                                    fontSize: '10.5px',
                                    color: 'var(--ink-2)',
                                    letterSpacing: '0.02em',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {typeof log.details === 'string'
                                    ? log.details
                                    : JSON.stringify(log.details).slice(0, 160)}
                                </div>
                              )}
                            </div>
                            <div className="py-3 px-4 flex justify-end items-center">
                              <span
                                className="vt-chip"
                                style={{
                                  fontSize: '9px',
                                  padding: '3px 8px',
                                  color: verbColor(verb),
                                  borderColor: `color-mix(in oklab, ${verbColor(verb)} 50%, var(--rule))`,
                                  background: 'transparent',
                                }}
                              >
                                {verb.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>

        {/* ── Colophon ───────────────────────────────────────────────── */}
        <footer
          className="pt-6 flex justify-between gap-4 flex-wrap"
          style={{
            borderTop: '1px solid var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>SHEET 11 · RECORD</span>
          <span>LIMIT · 100 · MOST RECENT</span>
          <span>DRAWN · {isoDate}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ────────────────────────────────────────────────────────── primitives ── */

function LoadingFrame() {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="vt-mono vt-breathe"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        tracing the record…
      </div>
    </div>
  );
}

function EmptyFrame() {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="vt-kicker"
        style={{ color: 'var(--ink-2)', justifyContent: 'center' }}
      >
        — no entries logged —
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 2.6vw, 32px)',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        the record is blank.
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.5,
        }}
      >
        Nothing filed under this filter. The next actor to touch the drawing set writes the next line.
      </p>
    </div>
  );
}

function verbFor(action: string): string {
  const a = (action || '').toLowerCase();
  const MAP: Array<[string, string]> = [
    ['created', 'created'], ['create', 'created'],
    ['updated', 'updated'], ['update', 'updated'],
    ['deleted', 'deleted'], ['delete', 'deleted'],
    ['triggered', 'triggered'], ['trigger', 'triggered'], ['run', 'triggered'], ['execute', 'triggered'],
    ['approved', 'approved'], ['approve', 'approved'],
    ['rejected', 'rejected'], ['reject', 'rejected'],
    ['login', 'signed'], ['logout', 'signed'], ['sign', 'signed'],
  ];
  for (const [k, v] of MAP) if (a.includes(k)) return v;
  return a.replace(/_/g, ' ') || '—';
}

function verbColor(verb: string): string {
  switch (verb) {
    case 'created': return 'var(--pass)';
    case 'approved': return 'var(--pass)';
    case 'deleted': return 'var(--fail)';
    case 'rejected': return 'var(--fail)';
    case 'triggered': return 'var(--accent)';
    case 'updated': return 'var(--ink-0)';
    case 'signed': return 'var(--ink-1)';
    default: return 'var(--ink-1)';
  }
}
