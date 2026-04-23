'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCurrentProject } from '@/hooks/useProject';
import { api } from '@/lib/api';

interface Execution {
  id: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  triggeredBy: string;
  triggerRef?: string;
  platform?: string;
  mode?: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
  test?: { id: string; name: string };
  suite?: { id: string; name: string };
}

// Revision-log status labels — lower-case small-caps where they appear.
const statusLabels: Record<Execution['status'], string> = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  PASSED: 'pass',
  FAILED: 'reject',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'RUNNING', label: 'RUNNING' },
  { key: 'PASSED', label: 'PASS' },
  { key: 'FAILED', label: 'REJECT' },
  { key: 'CANCELLED', label: 'CANCELLED' },
];

export default function ExecutionsPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ['executions', project?.id, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: project!.id, limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get<Execution[]>(`/executions?${params}`);
      return res;
    },
    enabled: !!project,
    refetchInterval: 5000,
  });

  const formatDuration = (ms: number | null) => {
    if (!ms) return '——';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const total = executions.length;
  const passedTotal = executions.filter((e) => e.status === 'PASSED').length;
  const failedTotal = executions.filter((e) => e.status === 'FAILED').length;

  if (!project) {
    return (
      <div className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />
        <div
          className="py-24 text-center"
          style={{
            border: '1px dashed var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          — NO PROJECT SELECTED —
        </div>
      </div>
    );
  }

  const grouped = groupByDay(executions);

  return (
    <div className="min-h-screen">
      {/* SHEET · REVISION REGISTER ─────────────────────────────── */}
      <section className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />

        {/* Title-block masthead */}
        <div
          className="flex items-center gap-4 mb-7 flex-wrap"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>SHT · 03 / RUNS</span>
          <span className="flex-1 min-w-[40px]" style={{ height: '1px', background: 'var(--ink-3)' }} />
          <span>{isoDate}</span>
          <span className="vt-rev-stamp">REV · {String(total).padStart(2, '0')}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-end pb-8"
          style={{ borderBottom: '1px solid var(--rule-strong)' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(42px, 6.5vw, 84px)',
                lineHeight: 0.96,
                letterSpacing: '-0.01em',
                textTransform: 'lowercase',
                color: 'var(--ink-0)',
                margin: 0,
              }}
            >
              revision<br />
              <span style={{ color: 'var(--accent)' }}>register</span>
              <span style={{ color: 'var(--ink-2)' }}> — </span>
              <span>every run, logged.</span>
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                color: 'var(--ink-1)',
                maxWidth: '58ch',
                lineHeight: 1.6,
                marginTop: '22px',
              }}
            >
              Each execution is a revision entry against the drawing set. Passes carry the approval stamp; rejects are redlined for review. Read top-down, most recent first.
            </p>
          </div>

          {/* Right meta block — drawing-set tallies */}
          <div
            className="grid grid-cols-3"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              minWidth: '340px',
            }}
          >
            {[
              { k: 'ENTRIES', v: String(total).padStart(3, '0') },
              { k: 'PASS', v: String(passedTotal).padStart(3, '0'), c: 'var(--pass)' },
              { k: 'REJECT', v: String(failedTotal).padStart(3, '0'), c: 'var(--fail)' },
            ].map((x, i) => (
              <div
                key={x.k}
                className="px-4 py-4"
                style={{ borderRight: i < 2 ? '1px solid var(--rule)' : 'none' }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                    marginBottom: '6px',
                  }}
                >
                  {x.k}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '28px',
                    letterSpacing: '0.04em',
                    color: x.c || 'var(--ink-0)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {x.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FILTER BAR — ruled segments, no pills ───────────────── */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${FILTERS.length}, 1fr)`,
            border: '1px solid var(--rule-strong)',
            borderTop: 'none',
            background: 'color-mix(in oklab, var(--bg-1) 30%, transparent)',
          }}
        >
          {FILTERS.map((f, i) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className="py-3 px-4 text-left transition-colors"
                style={{
                  borderRight: i < FILTERS.length - 1 ? '1px solid var(--rule)' : 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: active ? 'var(--accent)' : 'var(--ink-2)',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ color: active ? 'var(--accent)' : 'var(--ink-3)', marginRight: '8px' }}>
                  §{String(i + 1).padStart(2, '0')}
                </span>
                {f.label}
              </button>
            );
          })}
        </div>

        {/* BODY ─────────────────────────────────────────────────── */}
        <div className="mt-12">
          {isLoading ? (
            <div
              className="py-24 text-center"
              style={{
                border: '1px dashed var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              — COMPILING REGISTER —
            </div>
          ) : executions.length === 0 ? (
            <div
              className="py-20 px-8 text-center"
              style={{ border: '1px dashed var(--rule)' }}
            >
              <div
                className="vt-leader"
                style={{ marginBottom: '16px' }}
              >
                — NO ENTRIES RECORDED —
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '32px',
                  lineHeight: 1.15,
                  color: 'var(--ink-1)',
                  textTransform: 'lowercase',
                  margin: '0 0 28px 0',
                  letterSpacing: '-0.005em',
                }}
              >
                run a test and<br />the first entry appears here.
              </p>
              <button
                onClick={() => router.push('/tests')}
                className="vt-btn vt-btn--primary"
              >
                PICK A TEST
              </button>
            </div>
          ) : (
            <div className="space-y-14">
              {Array.from(grouped.entries()).map(([day, rows], groupIdx) => {
                const dayPass = rows.filter((r) => r.status === 'PASSED').length;
                const dayFail = rows.filter((r) => r.status === 'FAILED').length;
                return (
                  <section key={day}>
                    {/* Day header row — stamp left, tallies right in ruled columns */}
                    <div
                      className="grid items-end pb-2 mb-0"
                      style={{
                        gridTemplateColumns: '1fr auto auto auto auto',
                        borderBottom: '1px solid var(--rule-strong)',
                      }}
                    >
                      <div className="pb-1">
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            letterSpacing: '0.24em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-2)',
                            marginBottom: '4px',
                          }}
                        >
                          § DAY {String(groupIdx + 1).padStart(2, '0')} · ENTRY DATE
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '28px',
                            letterSpacing: '-0.005em',
                            textTransform: 'lowercase',
                            color: 'var(--ink-0)',
                          }}
                        >
                          {day}
                        </div>
                      </div>
                      {[
                        { k: 'ENTRIES', v: String(rows.length).padStart(2, '0'), c: 'var(--ink-1)' },
                        { k: 'PASS', v: String(dayPass).padStart(2, '0'), c: 'var(--pass)' },
                        { k: 'REJECT', v: String(dayFail).padStart(2, '0'), c: 'var(--fail)' },
                      ].map((t, i) => (
                        <div
                          key={t.k}
                          className="px-5 py-2"
                          style={{
                            borderLeft: '1px solid var(--rule)',
                            minWidth: '96px',
                            textAlign: 'right',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '9px',
                              letterSpacing: '0.22em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-2)',
                              marginBottom: '4px',
                            }}
                          >
                            {t.k}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '18px',
                              letterSpacing: '0.04em',
                              color: t.c,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {t.v}
                          </div>
                        </div>
                      ))}
                      <div
                        className="px-5 py-2"
                        style={{
                          borderLeft: '1px solid var(--rule)',
                          minWidth: '72px',
                          textAlign: 'right',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-2)',
                            marginBottom: '4px',
                          }}
                        >
                          REV
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '18px',
                            letterSpacing: '0.08em',
                            color: 'var(--accent)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {String(groupIdx + 1).padStart(2, '0')}
                        </div>
                      </div>
                    </div>

                    {/* COLUMN HEADER — mini schedule-log header ─────── */}
                    <div
                      className="grid items-center py-2 px-1"
                      style={{
                        gridTemplateColumns: '56px 88px 1fr 120px 104px 96px',
                        gap: '16px',
                        borderBottom: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        letterSpacing: '0.24em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <span>§ENT</span>
                      <span>TIME</span>
                      <span>DESCRIPTION</span>
                      <span>MODE / PLAT</span>
                      <span style={{ textAlign: 'right' }}>DURATION</span>
                      <span style={{ textAlign: 'right' }}>STATUS</span>
                    </div>

                    {/* ENTRIES ─────────────────────────────────────── */}
                    <ul className="m-0 p-0 list-none">
                      {rows.map((execution, i) => {
                        const isLive = ['PENDING', 'QUEUED', 'RUNNING'].includes(execution.status);
                        const stampClass =
                          execution.status === 'PASSED'
                            ? 'vt-rev-stamp vt-rev-stamp--pass'
                            : execution.status === 'FAILED'
                            ? 'vt-rev-stamp vt-rev-stamp--reject'
                            : 'vt-rev-stamp';
                        const mode = (execution as Execution).mode || execution.platform || 'web';
                        return (
                          <li
                            key={execution.id}
                            style={{
                              borderBottom: '1px solid var(--rule-soft)',
                              animation: `vt-reveal var(--dur-reveal) ${i * 24}ms var(--ease-out) both`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => router.push(`/executions/${execution.id}`)}
                              className="w-full text-left grid items-center py-4 px-1 transition-colors group"
                              style={{
                                gridTemplateColumns: '56px 88px 1fr 120px 104px 96px',
                                gap: '16px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              {/* § entry number */}
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                  letterSpacing: '0.12em',
                                  color: 'var(--accent)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                §{String(i + 1).padStart(2, '0')}
                              </span>

                              {/* time */}
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '13px',
                                  letterSpacing: '0.04em',
                                  color: 'var(--ink-1)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {formatClock(execution.startedAt || execution.createdAt)}
                              </span>

                              {/* title + sub */}
                              <div className="min-w-0">
                                <div
                                  className="truncate transition-colors"
                                  style={{
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '17px',
                                    letterSpacing: '-0.005em',
                                    textTransform: 'lowercase',
                                    color: 'var(--ink-0)',
                                  }}
                                >
                                  {execution.test?.name || execution.suite?.name || 'execution'}
                                </div>
                                <div
                                  className="truncate"
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10px',
                                    letterSpacing: '0.16em',
                                    textTransform: 'uppercase',
                                    color: 'var(--ink-2)',
                                    marginTop: '2px',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  TRIG · {(execution.triggeredBy || 'manual').toUpperCase()}
                                  {execution.triggerRef?.startsWith('workflow:') && ' · WORKFLOW'}
                                  {execution.id && ` · #${execution.id.slice(-6)}`}
                                </div>
                              </div>

                              {/* mode / platform */}
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '10.5px',
                                  letterSpacing: '0.18em',
                                  textTransform: 'uppercase',
                                  color: 'var(--ink-2)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {String(mode).toUpperCase()}
                              </span>

                              {/* duration — right-aligned metric */}
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '13px',
                                  letterSpacing: '0.04em',
                                  color: 'var(--ink-1)',
                                  fontVariantNumeric: 'tabular-nums',
                                  textAlign: 'right',
                                }}
                              >
                                {formatDuration(execution.duration)}
                              </span>

                              {/* status stamp — right-aligned */}
                              <span style={{ textAlign: 'right', justifySelf: 'end' }}>
                                {isLive ? (
                                  <span
                                    className="vt-chip vt-chip--accent vt-breathe"
                                    style={{ letterSpacing: '0.24em', padding: '3px 10px' }}
                                  >
                                    LIVE
                                  </span>
                                ) : (
                                  <span
                                    className={stampClass}
                                    style={{ fontSize: '9.5px', padding: '4px 9px' }}
                                  >
                                    {statusLabels[execution.status].toUpperCase()}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Group executions by calendar day for the revision-log presentation.
function groupByDay(items: Execution[]): Map<string, Execution[]> {
  const map = new Map<string, Execution[]>();
  for (const e of items) {
    const d = new Date(e.startedAt || e.createdAt);
    const key = d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function formatClock(iso: string | null): string {
  if (!iso) return '——:——';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
