'use client';

// Flaky — Sheet 08 · Quarantine ledger.
// Each flaky test is a ruled row; the flake score reads as a dimensioned
// meter, and the last N runs show as a tiny sparkline of pass/fail dots.

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flakyApi, testsApi, type FlakyTest } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { toast } from 'sonner';
import { Play, Shield, ShieldOff, ArrowRight } from 'lucide-react';

export default function FlakyPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  const { data: flakyTests, isLoading } = useQuery({
    queryKey: ['flaky', project?.id],
    queryFn: () => flakyApi.list(project!.id),
    enabled: !!project?.id,
  });

  const quarantineMutation = useMutation({
    mutationFn: (testId: string) => flakyApi.quarantine(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flaky', project?.id] });
      toast.success('Test quarantined');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to quarantine test');
    },
  });

  const unquarantineMutation = useMutation({
    mutationFn: (testId: string) => flakyApi.unquarantine(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flaky', project?.id] });
      toast.success('Released from quarantine');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to release test');
    },
  });

  const runMutation = useMutation({
    mutationFn: (testId: string) => testsApi.run(project!.id, testId),
    onSuccess: () => {
      toast.success('Run queued');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to run test');
    },
  });

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
          Pick a <em>project</em> — the quarantine ward opens once you do.
        </h1>
      </VtStage>
    );
  }

  const tests = (flakyTests || []) as FlakyTest[];
  const quarantinedCount = tests.filter((t) => t.status === 'QUARANTINED').length;
  const avgFlakyScore =
    tests.length > 0
      ? Math.round(tests.reduce((acc, t) => acc + (t.flakinessScore || 0), 0) / tests.length)
      : 0;
  const worst = tests.reduce(
    (m, t) => ((t.flakinessScore || 0) > m ? t.flakinessScore || 0 : m),
    0,
  );
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`08 / 12`}
        eyebrow={`§ 08 · QUARANTINE`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            tests that <em>flicker</em>.
          </>
        }
        lead="Quarantine ledger. Inconsistent pass/fail patterns — not quite broken, not quite working. Release, hold, or draft a fix at your own pace."
      >
        {/* Figure plate — flake score meter */}
        <section aria-labelledby="meter-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="meter-head">flake meter</span>
            <span className="rule" />
            <span className="stamp">FIG. 1 · WARD READING</span>
          </div>

          <div
            className="grid grid-cols-1 lg:grid-cols-[1fr_320px]"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div className="p-8 lg:p-12" style={{ borderRight: '1px solid var(--rule)' }}>
              <div
                className="vt-mono"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  color: 'var(--ink-2)',
                  marginBottom: '18px',
                }}
              >
                FLICKERING · POPULATION READING
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontVariationSettings: '"opsz" 144',
                  fontWeight: 300,
                  fontSize: 'clamp(96px, 12vw, 180px)',
                  lineHeight: 0.88,
                  letterSpacing: '-0.04em',
                  color: tests.length > 0 ? 'var(--warn)' : 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(tests.length).padStart(2, '0')}
              </div>
              <div
                className="mt-4 vt-kicker"
                style={{ color: tests.length > 0 ? 'var(--warn)' : 'var(--ink-2)' }}
              >
                {tests.length === 1 ? 'flickering test' : 'flickering tests'}
              </div>

              {/* Dimensioned meter for population flakiness */}
              <div className="mt-10">
                <ScoreMeter label="POPULATION AVG" value={avgFlakyScore} />
                <div className="mt-6">
                  <ScoreMeter label="WORST CASE" value={worst} />
                </div>
              </div>
            </div>

            <aside
              className="p-6"
              style={{ background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)' }}
            >
              <div
                className="vt-mono"
                style={{
                  fontSize: '9.5px',
                  letterSpacing: '0.24em',
                  color: 'var(--ink-2)',
                  paddingBottom: '10px',
                  marginBottom: '16px',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                DETAIL A · WARD META
              </div>
              <dl className="m-0 space-y-3">
                <MetaRow k="QUARANTINED" v={String(quarantinedCount).padStart(2, '0')} />
                <MetaRow
                  k="AVG FLAKE"
                  v={`${avgFlakyScore}%`}
                  tone={avgFlakyScore > 60 ? 'warn' : avgFlakyScore > 20 ? 'warn' : 'pass'}
                />
                <MetaRow k="DETECTION" v="AUTOMATIC" />
                <MetaRow k="SOURCE" v="EVERY RUN" />
              </dl>
            </aside>
          </div>
        </section>

        {/* §02 — the ledger */}
        <section aria-labelledby="ledger-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="ledger-head">quarantine ledger</span>
            <span className="rule" />
            <span className="stamp">
              {isLoading ? 'LOADING…' : tests.length === 0 ? 'NIL · STABLE' : `${tests.length} ROWS`}
            </span>
          </div>

          {isLoading ? (
            <DashedFrame>reading ward vitals…</DashedFrame>
          ) : tests.length === 0 ? (
            <EmptyWard />
          ) : (
            <Ledger
              tests={tests}
              onRun={(id) => runMutation.mutate(id)}
              onQuarantine={(id) => quarantineMutation.mutate(id)}
              onRelease={(id) => unquarantineMutation.mutate(id)}
              pending={
                runMutation.isPending ||
                quarantineMutation.isPending ||
                unquarantineMutation.isPending
              }
            />
          )}
        </section>

        <Colophon projectName={project.name} slug={project.slug} />
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────── primitives ── */

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const tone =
    value > 50 ? 'var(--fail)' : value > 20 ? 'var(--warn)' : 'var(--pass)';
  return (
    <div>
      <div
        className="flex items-baseline justify-between mb-2 vt-mono"
        style={{
          fontSize: '10px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        <span>{label}</span>
        <span style={{ color: tone, fontVariantNumeric: 'tabular-nums' }}>
          {value}%
        </span>
      </div>
      <div style={{ position: 'relative', height: '10px', border: '1px solid var(--rule)' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: tone,
            opacity: 0.4,
          }}
        />
      </div>
      <div
        className="mt-2 vt-mono"
        style={{
          fontSize: '9.5px',
          letterSpacing: '0.14em',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
          textTransform: 'uppercase',
        }}
      >
        ⊢ 0% · STABLE ·— 20% — 50% ·— 100% · UNSTABLE ⊣
      </div>
    </div>
  );
}

function Sparkline({ history }: { history: FlakyTest['runHistory'] }) {
  const tail = (history || []).slice(-8);
  if (tail.length === 0) {
    return (
      <span
        className="vt-mono"
        style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.1em' }}
      >
        —
      </span>
    );
  }
  return (
    <div className="flex items-center gap-[3px]">
      {tail.map((h, i) => (
        <span
          key={i}
          aria-label={h.passed ? 'pass' : 'fail'}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            border: '1px solid var(--rule)',
            background: h.passed ? 'var(--pass)' : 'var(--fail)',
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

function Ledger({
  tests,
  onRun,
  onQuarantine,
  onRelease,
  pending,
}: {
  tests: FlakyTest[];
  onRun: (testId: string) => void;
  onQuarantine: (testId: string) => void;
  onRelease: (testId: string) => void;
  pending: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      <div
        className="grid grid-cols-[96px_1fr_150px_140px_120px_220px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['T-ID', 'TEST', 'FLAKE SCORE', 'LAST 8 RUNS', 'STATUS', 'ACTIONS'].map((h, i) => (
          <div
            key={h}
            className="py-3 px-4"
            style={{
              borderRight: i < 5 ? '1px solid var(--rule)' : 'none',
              textAlign: i === 5 ? 'right' : 'left',
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {tests.map((ft, i) => {
        const score = ft.flakinessScore || 0;
        const statusMap: Record<string, { cls: string; label: string }> = {
          QUARANTINED: { cls: 'vt-chip', label: 'QUARANTINED' },
          WARNING: { cls: 'vt-chip vt-chip--warn', label: 'WARNING' },
          STABLE: { cls: 'vt-chip vt-chip--pass', label: 'STABLE' },
          WATCHING: { cls: 'vt-chip vt-chip--warn', label: 'WATCHING' },
          INVESTIGATING: { cls: 'vt-chip vt-chip--accent', label: 'INVESTIGATING' },
        };
        const s = statusMap[ft.status] || { cls: 'vt-chip', label: ft.status };
        return (
          <div
            key={ft.id}
            className="grid grid-cols-[96px_1fr_150px_140px_120px_220px] gap-0 group"
            style={{
              borderBottom: i < tests.length - 1 ? '1px solid var(--rule-soft)' : 'none',
              animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
            }}
          >
            <div
              className="py-4 px-4 vt-mono"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontSize: '10.5px',
                letterSpacing: '0.14em',
                color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              T-{ft.testId.slice(0, 6).toUpperCase()}
            </div>
            <div
              className="py-4 px-4 min-w-0"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <Link
                href={`/tests/${ft.testId}`}
                className="block truncate group-hover:text-[color:var(--accent)] transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                  lineHeight: 1.15,
                  textDecoration: 'none',
                }}
              >
                {ft.test.name}
              </Link>
              {ft.test.tags && ft.test.tags.length > 0 && (
                <div
                  className="mt-1 vt-mono"
                  style={{
                    fontSize: '9.5px',
                    letterSpacing: '0.14em',
                    color: 'var(--ink-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {ft.test.tags.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
            <div
              className="py-4 px-4"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <div
                className="flex items-center gap-3 vt-mono"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  color:
                    score > 50 ? 'var(--fail)' : score > 20 ? 'var(--warn)' : 'var(--pass)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ minWidth: 36 }}>{score}%</span>
                <div
                  style={{
                    position: 'relative',
                    flex: 1,
                    height: '6px',
                    border: '1px solid var(--rule)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, Math.max(0, score))}%`,
                      background:
                        score > 50
                          ? 'var(--fail)'
                          : score > 20
                          ? 'var(--warn)'
                          : 'var(--pass)',
                      opacity: 0.4,
                    }}
                  />
                </div>
              </div>
            </div>
            <div
              className="py-4 px-4 flex items-center"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <Sparkline history={ft.runHistory} />
            </div>
            <div
              className="py-4 px-4 flex items-center"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <span className={s.cls} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                {s.label}
              </span>
            </div>
            <div className="py-3 px-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="vt-btn vt-btn--ghost"
                style={{ padding: '6px 10px', fontSize: '10px' }}
                onClick={() => onRun(ft.testId)}
                disabled={pending}
              >
                <Play className="w-3 h-3" strokeWidth={1.5} />
                RUN
              </button>
              {ft.status === 'QUARANTINED' ? (
                <button
                  type="button"
                  className="vt-btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: '10px',
                    color: 'var(--pass)',
                    borderColor: 'color-mix(in oklab, var(--pass) 55%, var(--rule))',
                  }}
                  onClick={() => onRelease(ft.testId)}
                  disabled={pending}
                >
                  <ShieldOff className="w-3 h-3" strokeWidth={1.5} />
                  RELEASE
                </button>
              ) : (
                <button
                  type="button"
                  className="vt-btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: '10px',
                    color: 'var(--warn)',
                    borderColor: 'color-mix(in oklab, var(--warn) 55%, var(--rule))',
                  }}
                  onClick={() => onQuarantine(ft.testId)}
                  disabled={pending}
                >
                  <Shield className="w-3 h-3" strokeWidth={1.5} />
                  HOLD
                </button>
              )}
              <Link
                href={`/tests/${ft.testId}`}
                className="vt-btn vt-btn--ghost"
                style={{ padding: '6px 8px', fontSize: '10px' }}
              >
                <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyWard() {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div className="vt-kicker" style={{ color: 'var(--pass)', justifyContent: 'center' }}>
        WARD CLEAR · NO FLICKER
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3vw, 40px)',
          color: 'var(--ink-0)',
        }}
      >
        every test reads stable.
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.5,
        }}
      >
        Keep the runs coming — every pass/fail feeds the flake detector. The
        moment a test starts flickering it gets filed here.
      </p>
    </div>
  );
}

function DashedFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-10 text-center vt-mono"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 20%, transparent)',
        fontSize: '10.5px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--ink-2)',
      }}
    >
      {children}
    </div>
  );
}

function MetaRow({
  k,
  v,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  tone?: 'pass' | 'fail' | 'warn';
}) {
  const color =
    tone === 'pass'
      ? 'var(--pass)'
      : tone === 'fail'
      ? 'var(--fail)'
      : tone === 'warn'
      ? 'var(--warn)'
      : 'var(--ink-0)';
  return (
    <div
      className="grid grid-cols-[100px_1fr] gap-3 items-baseline py-1.5"
      style={{ borderBottom: '1px solid var(--rule-soft)' }}
    >
      <dt
        className="vt-mono"
        style={{
          fontSize: '9.5px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {k}
      </dt>
      <dd
        className="m-0 vt-mono"
        style={{
          fontSize: '11.5px',
          letterSpacing: '0.06em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {v}
      </dd>
    </div>
  );
}

function Colophon({ projectName, slug }: { projectName: string; slug?: string }) {
  return (
    <footer
      className="pt-6 flex justify-between gap-4 flex-wrap"
      style={{
        borderTop: '1px solid var(--rule)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--ink-2)',
      }}
    >
      <span>SHEET 08 · QUARANTINE · {projectName}</span>
      <span>CHECKED · {(slug || 'VT').toUpperCase()}</span>
      <span>FLAKE BELOW 20% READS STABLE</span>
    </footer>
  );
}
