'use client';

// Dashboard — Sheet 01 of N, the cover plate of the drawing set.
// Masthead title block + schedule of sheets + last-run figure plate +
// activity-log ledger. Every zone has a part ID (T-ct, R-ct, V-ct...).
// Numbers are ortho blocks with dimension callouts; edges are sharp.

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Compass, ArrowRight } from 'lucide-react';
import { useCurrentProject } from '@/hooks/useProject';
import {
  api,
  dashboardApi,
  testsApi,
  visualApi,
  executionsApi,
} from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function DashboardPage() {
  const { project } = useCurrentProject();

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats', project?.id],
    queryFn: () => dashboardApi.stats(project!.id),
    enabled: !!project?.id,
  });
  const { data: recentTests } = useQuery({
    queryKey: ['tests', project?.id, 'recent'],
    queryFn: () => testsApi.list(project!.id),
    enabled: !!project?.id,
  });
  const { data: pendingVisuals } = useQuery({
    queryKey: ['visual', project?.id, 'pending'],
    queryFn: () => visualApi.list(project!.id, { status: 'pending' }),
    enabled: !!project?.id,
  });
  const { data: recentRuns } = useQuery({
    queryKey: ['executions', project?.id, 'recent'],
    queryFn: () => executionsApi.list(project!.id, { limit: '10' } as any),
    enabled: !!project?.id,
  });

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1
          className="vt-display mb-6"
          style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
        >
          Pick a <em>project</em> —<br /> or open a fresh one.
        </h1>
        <p className="text-[17px]" style={{ color: 'var(--ink-1)' }}>
          The dashboard, tests, runs, baselines, and scans are all scoped to
          a project. Open the project switcher in the top-left, or create a
          new one.
        </p>
        <div className="mt-10 flex gap-3">
          <Link href="/projects/new" className="vt-btn vt-btn--primary">
            <Plus className="w-4 h-4" />
            New project
          </Link>
        </div>
      </VtStage>
    );
  }

  const tests = (recentTests || []) as any[];
  const visuals = (pendingVisuals || []) as any[];
  const runs = (recentRuns || []) as any[];

  const totalTests = stats?.totalTests ?? 0;
  const passRate = stats
    ? Math.round((stats.passingTests / Math.max(totalTests, 1)) * 100)
    : 0;
  const flakyCt = stats?.flakyTests ?? 0;
  const bugCandidates = ((stats as any)?.bugCandidates ?? []) as any[];
  const lastRun = runs[0];

  // Today's date in drawing-set format: YYYY.MM.DD
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const lastSync = lastRun
    ? new Date(lastRun.createdAt).toISOString().slice(0, 16).replace('T', ' · ')
    : '— · PENDING';

  // Count distinct domains in attention state to set sheet total
  const attentionCount =
    (visuals.length > 0 ? 1 : 0) +
    (flakyCt > 0 ? 1 : 0) +
    (bugCandidates.length > 0 ? 1 : 0);

  // Pass / fail / skip breakdown for the figure plate
  const passed = lastRun?.status === 'PASSED' ? 1 : 0;
  const failed = lastRun?.status === 'FAILED' ? 1 : 0;
  const skipped = lastRun && !['PASSED', 'FAILED'].includes(lastRun.status) ? 1 : 0;

  // ---- schedule of sheets ----------------------------------------------
  const zones: Array<{
    part: string;
    num: number;
    name: string;
    href: string;
    status: string;
    attention: boolean;
    stamp?: string;
  }> = [
    {
      part: `T-${String(totalTests).padStart(2, '0')}`,
      num: totalTests,
      name: 'tests',
      href: '/tests',
      status: totalTests === 0 ? 'no tests drafted' : `${passRate}% passing`,
      attention: totalTests === 0,
      stamp: totalTests === 0 ? 'AWAITING DRAFT' : undefined,
    },
    {
      part: `R-${String(runs.length).padStart(2, '0')}`,
      num: runs.length,
      name: 'runs',
      href: '/runs',
      status: runs.length === 0 ? 'no runs on file' : 'most recent below',
      attention: false,
    },
    {
      part: `V-${String(visuals.length).padStart(2, '0')}`,
      num: visuals.length,
      name: 'visual review',
      href: '/visual',
      status: visuals.length === 0 ? 'caught up' : 'changes waiting',
      attention: visuals.length > 0,
      stamp: visuals.length > 0 ? 'REV · REVIEW' : undefined,
    },
    {
      part: `F-${String(flakyCt).padStart(2, '0')}`,
      num: flakyCt,
      name: 'flaky',
      href: '/tests?filter=flaky',
      status: flakyCt === 0 ? 'no flake detected' : 'quarantined',
      attention: flakyCt > 0,
      stamp: flakyCt > 0 ? 'REV · FLAKE' : undefined,
    },
    {
      part: `S-00`,
      num: 0,
      name: 'scans',
      href: '/scan',
      status: 'probe from URL',
      attention: false,
    },
    {
      part: `A-${String(bugCandidates.length).padStart(2, '0')}`,
      num: bugCandidates.length,
      name: 'approvals',
      href: '/fixes',
      status: bugCandidates.length === 0 ? 'no open fixes' : 'fix candidates',
      attention: bugCandidates.length > 0,
      stamp: bugCandidates.length > 0 ? 'REV · ACTION' : undefined,
    },
  ];

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`01 / ${String(4 + attentionCount).padStart(2, '0')}`}
        eyebrow={`§ 01 · COVER PLATE`}
        revision={
          <>
            REV · 02 · {isoDate}
          </>
        }
        title={
          <>
            {project.name.split(' ').slice(0, -1).join(' ') || project.name}{' '}
            <em>{project.name.split(' ').slice(-1)}</em>
          </>
        }
        lead={
          project.description ||
          'Cover sheet of the drawing set. The schedule below indexes every zone — tests, runs, visual review, flaky, scans, approvals. Ochre revision stamps mark zones requesting attention.'
        }
        actions={
          <>
            <Link href="/scan/new" className="vt-btn">
              <Compass className="w-3.5 h-3.5" strokeWidth={1.5} />
              SCAN
            </Link>
            <Link href="/tests/new" className="vt-btn vt-btn--primary">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              NEW TEST
            </Link>
          </>
        }
      >
        {/* ── Title block — drawing-sheet metadata ────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">SLUG · SHEET ID</span>
            <span className="v">VT-{(project.slug || project.id.slice(-8)).toUpperCase()}</span>
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
            <span className="k">LAST SYNC · UTC</span>
            <span className="v">{lastSync}</span>
          </div>
          <div>
            <span className="k">TESTS</span>
            <span className="v">{String(totalTests).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">PASS</span>
            <span className="v" style={{ color: passRate >= 90 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {passRate}%
            </span>
          </div>
        </div>

        {/* ── §02 · Schedule of sheets ───────────────────────────────── */}
        <section aria-labelledby="schedule-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="schedule-head">schedule of sheets</span>
            <span className="rule" />
            <span className="stamp">6 ZONES · INDEX</span>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            {zones.map((z, i) => (
              <ZoneCard key={z.part} zone={z} idx={i} />
            ))}
          </div>
        </section>

        {/* ── §03 · Last-run figure plate ────────────────────────────── */}
        <section aria-labelledby="lastrun-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="lastrun-head">fig. 1 · last run</span>
            <span className="rule" />
            <span className="stamp">
              {lastRun
                ? `ORTHOGRAPHIC · ${lastRun.platform || 'WEB'}`
                : 'NO DATA — PLATE EMPTY'}
            </span>
          </div>

          {lastRun ? (
            <LastRunPlate
              run={lastRun}
              passed={passed}
              failed={failed}
              skipped={skipped}
            />
          ) : (
            <EmptyPlate />
          )}
        </section>

        {/* ── §04 · Activity log ─────────────────────────────────────── */}
        <section aria-labelledby="activity-head">
          <div className="vt-section-head">
            <span className="num">§ 04</span>
            <span className="ttl" id="activity-head">activity log</span>
            <span className="rule" />
            <span className="stamp">
              LAST {Math.min(runs.length, 10)} ENTRIES
            </span>
          </div>

          <ActivityLedger runs={runs.slice(0, 10)} />
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
          <span>SHEET 01 · COVER · {project.name}</span>
          <span>CHECKED · {(project.slug || 'VT').toUpperCase()}</span>
          <span>
            PRESS{' '}
            <kbd
              className="px-1.5 py-0.5"
              style={{
                background: 'var(--bg-2)',
                color: 'var(--ink-1)',
                border: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
              }}
            >
              ⌘K
            </kbd>{' '}
            TO JUMP
          </span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function ZoneCard({
  zone,
  idx,
}: {
  zone: {
    part: string;
    num: number;
    name: string;
    href: string;
    status: string;
    attention: boolean;
    stamp?: string;
  };
  idx: number;
}) {
  return (
    <Link
      href={zone.href}
      className="block group relative"
      style={{
        borderRight: '1px solid var(--rule-soft)',
        borderBottom: '1px solid var(--rule-soft)',
        padding: '22px 24px 20px',
        textDecoration: 'none',
        animation: `vt-reveal var(--dur-reveal) ${(idx + 1) * 40}ms var(--ease-out) both`,
        transition: 'background var(--dur-quick) var(--ease-out)',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          'color-mix(in oklab, var(--bg-2) 40%, transparent)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* part ID line */}
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.18em',
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {zone.part}
        </span>
        {zone.stamp && (
          <span className="vt-rev-stamp" style={{ fontSize: '8.5px', padding: '3px 7px' }}>
            {zone.stamp}
          </span>
        )}
      </div>

      {/* count — ortho display */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(38px, 4.5vw, 54px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: zone.attention ? 'var(--accent)' : 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
          textTransform: 'lowercase',
        }}
      >
        {String(zone.num).padStart(2, '0')}
      </div>

      {/* name + status */}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            color: 'var(--ink-0)',
            textTransform: 'lowercase',
          }}
        >
          {zone.name}
        </span>
        <ArrowRight
          className="w-3 h-3 transition-transform group-hover:translate-x-1"
          strokeWidth={1.5}
          style={{ color: 'var(--ink-2)' }}
        />
      </div>

      <div
        className="mt-1"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {zone.status}
      </div>
    </Link>
  );
}

function LastRunPlate({
  run,
  passed,
  failed,
  skipped,
}: {
  run: any;
  passed: number;
  failed: number;
  skipped: number;
}) {
  const total = passed + failed + skipped || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  const blocks = [
    { label: 'pass', value: passed, color: 'var(--pass)', pct: pct(passed) },
    { label: 'fail', value: failed, color: 'var(--fail)', pct: pct(failed) },
    { label: 'skip', value: skipped, color: 'var(--ink-2)', pct: pct(skipped) },
  ];

  return (
    <div
      className="relative"
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      {/* header strip */}
      <div
        className="flex justify-between items-center px-6 py-3"
        style={{
          borderBottom: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>FIG. 1 · RUN {String(run.id).slice(-6).toUpperCase()}</span>
        <span>
          {new Date(run.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* figure — ortho blocks with dimensions */}
        <div
          className="p-8 lg:p-10 relative"
          style={{ borderRight: '1px solid var(--rule)' }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 3.2vw, 42px)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              color: 'var(--ink-0)',
            }}
          >
            {run.test?.name || 'Untitled run'}
          </div>

          {/* ortho blocks */}
          <div className="mt-10 grid grid-cols-3 gap-0">
            {blocks.map((b, i) => (
              <div
                key={b.label}
                style={{
                  position: 'relative',
                  borderLeft: i === 0 ? '1px solid var(--rule)' : 'none',
                  borderRight: '1px solid var(--rule)',
                  borderTop: '1px solid var(--rule)',
                  borderBottom: '1px solid var(--rule)',
                  padding: '24px 20px 20px',
                  background: 'transparent',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9.5px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: b.color,
                    marginBottom: '8px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {b.label}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(32px, 4vw, 56px)',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    color: b.color,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(b.value).padStart(2, '0')}
                </div>
                {/* mini fill bar — chalk linework only */}
                <div
                  style={{
                    marginTop: '14px',
                    height: '6px',
                    border: '1px solid var(--rule)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${b.pct}%`,
                      background: b.color,
                      opacity: 0.35,
                    }}
                  />
                </div>
                {/* dimension callout */}
                <div
                  style={{
                    marginTop: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9.5px',
                    letterSpacing: '0.14em',
                    color: 'var(--ink-2)',
                    fontVariantNumeric: 'tabular-nums',
                    textTransform: 'uppercase',
                  }}
                >
                  ⊢ {b.pct}% ⊣
                </div>
              </div>
            ))}
          </div>

          {/* overall dimension bar */}
          <div className="mt-8 relative">
            <div className="vt-dim-h">
              <span className="tick-l" />
              <span className="tick-r" />
              <span className="v">OVERALL · {pct(passed)}% PASS</span>
            </div>
          </div>

          {run.errorMessage && (
            <p
              className="mt-8 p-4 vt-mono"
              style={{
                fontSize: '12px',
                lineHeight: 1.6,
                background: 'var(--fail-soft)',
                borderLeft: '2px solid var(--fail)',
                color: 'var(--fail)',
                letterSpacing: '0.02em',
              }}
            >
              {String(run.errorMessage).slice(0, 320)}
            </p>
          )}

          <div className="mt-8 flex gap-3">
            <Link href={`/executions/${run.id}`} className="vt-btn">
              OPEN RUN
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Link>
            {run.test?.id && (
              <Link href={`/tests/${run.test.id}`} className="vt-btn vt-btn--ghost">
                VIEW TEST
              </Link>
            )}
          </div>
        </div>

        {/* meta sidebar — title-block style */}
        <aside className="p-6" style={{ background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              paddingBottom: '10px',
              marginBottom: '16px',
              borderBottom: '1px solid var(--rule)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            DETAIL A · RUN META
          </div>

          <dl className="m-0 space-y-3 text-[12px]">
            <MetaRow
              k="STATUS"
              v={
                <StatusMark status={run.status} />
              }
            />
            <MetaRow
              k="DURATION"
              v={
                run.duration
                  ? `${(run.duration / 1000).toFixed(1)}s`
                  : '—'
              }
            />
            <MetaRow k="PLATFORM" v={run.platform || 'WEB'} />
            <MetaRow
              k="BROWSER"
              v={(run.browser || 'CHROMIUM').toString().toUpperCase()}
            />
            {run.viewport && <MetaRow k="VIEWPORT" v={run.viewport} />}
            <MetaRow
              k="STARTED"
              v={new Date(run.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function EmptyPlate() {
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
        PLATE EMPTY
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3vw, 40px)',
          color: 'var(--ink-0)',
        }}
      >
        no runs on file.
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
        Draft a test, press run. Every step gets photographed and filed here
        as a plate — pass, fail, skip — with dimension callouts.
      </p>
      <div className="mt-8 flex justify-center">
        <Link href="/tests/new" className="vt-btn vt-btn--primary">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          AUTHOR FIRST TEST
        </Link>
      </div>
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-[90px_1fr] gap-3 items-baseline py-1.5"
      style={{ borderBottom: '1px solid var(--rule-soft)' }}
    >
      <dt
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {k}
      </dt>
      <dd
        className="m-0"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          letterSpacing: '0.06em',
          color: 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {v}
      </dd>
    </div>
  );
}

function StatusMark({ status }: { status: string }) {
  const cfg: Record<string, { className: string; label: string }> = {
    PASSED: { className: 'vt-chip vt-chip--pass', label: 'PASSED' },
    FAILED: { className: 'vt-chip vt-chip--fail', label: 'FAILED' },
    RUNNING: { className: 'vt-chip vt-chip--accent', label: 'RUNNING' },
    QUEUED: { className: 'vt-chip', label: 'QUEUED' },
  };
  const c = cfg[status] || { className: 'vt-chip', label: status };
  return (
    <span className={c.className} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
      {c.label}
    </span>
  );
}

function ActivityLedger({ runs }: { runs: any[] }) {
  if (runs.length === 0) {
    return (
      <p
        className="vt-italic py-6 text-[14px] text-center"
        style={{
          color: 'var(--ink-2)',
          fontFamily: 'var(--font-hand)',
          fontSize: '20px',
          border: '1px dashed var(--rule)',
        }}
      >
        — no entries logged —
      </p>
    );
  }
  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      {/* header row */}
      <div
        className="grid grid-cols-[110px_90px_1fr_140px_110px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['ENTRY', 'STAMP', 'EVENT', 'DURATION', 'STATUS'].map((h, i) => (
          <div
            key={h}
            className="py-3 px-4"
            style={{
              borderRight: i < 4 ? '1px solid var(--rule)' : 'none',
              textAlign: i === 3 || i === 4 ? 'right' : 'left',
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {runs.map((r, i) => (
        <Link
          key={r.id}
          href={`/executions/${r.id}`}
          className="grid grid-cols-[110px_90px_1fr_140px_110px] gap-0 group"
          style={{
            borderBottom: i < runs.length - 1 ? '1px solid var(--rule-soft)' : 'none',
            textDecoration: 'none',
            transition: 'background var(--dur-quick) var(--ease-out)',
            animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background =
              'color-mix(in oklab, var(--bg-2) 35%, transparent)')
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
            L-{String(i + 1).padStart(3, '0')}
          </div>
          <div
            className="py-3 px-4"
            style={{
              borderRight: '1px solid var(--rule-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              letterSpacing: '0.08em',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeAgo(r.createdAt)}
          </div>
          <div
            className="py-3 px-4 truncate"
            style={{
              borderRight: '1px solid var(--rule-soft)',
              fontFamily: 'var(--font-body)',
              fontSize: '13.5px',
              color: 'var(--ink-0)',
            }}
          >
            <span className="group-hover:text-[color:var(--accent)] transition-colors">
              {r.test?.name || 'untitled run'}
            </span>
          </div>
          <div
            className="py-3 px-4 text-right"
            style={{
              borderRight: '1px solid var(--rule-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              letterSpacing: '0.08em',
              color: 'var(--ink-1)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—'}
          </div>
          <div className="py-3 px-4 flex justify-end items-center">
            <StatusMark status={r.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
