'use client';

// Analytics — the instrument panel.
// Hero figures of pass-rate (%) and test-count rendered huge via the
// display font, bordered plates with mini title blocks and dimension
// callouts. Trend lines are inline SVG hairlines. No cards.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentProject } from '@/hooks/useProject';
import { analyticsApi } from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function AnalyticsPage() {
  const { project } = useCurrentProject();
  const [period, setPeriod] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', project?.id, period],
    queryFn: () => analyticsApi.get({ projectId: project!.id, days: period }),
    enabled: !!project?.id,
  });

  const analytics = data as any;

  const passRateTrend = useMemo(() => {
    if (!analytics?.trends) return 0;
    const trends = analytics.trends;
    const midpoint = Math.floor(trends.length / 2);
    const recent = trends.slice(midpoint);
    const older = trends.slice(0, midpoint);
    const avgRate = (arr: any[]) =>
      arr.reduce((sum: number, d: any) => sum + (d.total > 0 ? (d.passed / d.total) * 100 : 0), 0) /
      Math.max(arr.length, 1);
    return avgRate(recent) - avgRate(older);
  }, [analytics]);

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> —<br /> instruments offline.
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: 'var(--ink-1)', maxWidth: '56ch' }}>
          Analytics are scoped to a project. Open the project switcher and select one.
        </p>
      </VtStage>
    );
  }

  const summary = analytics?.summary || {
    totalRuns: 0,
    passedRuns: 0,
    failedRuns: 0,
    passRate: 0,
    avgDiff: 0,
    flakyTests: 0,
  };

  const trends: Array<{ date: string; passed: number; failed: number; total: number }> =
    analytics?.trends || [];

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`05 / 14`}
        eyebrow={`§ 05 · INSTRUMENTS`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            instrument <em>panel</em>.
          </>
        }
        lead={
          'Pass rate, trend, flicker, diff, runtime — the readings that tell you if the machine is quieter than yesterday. Each plate is a dial.'
        }
        actions={
          <div className="flex gap-0" style={{ border: '1px solid var(--rule)' }}>
            {(['7', '14', '30', '90'] as const).map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className="vt-mono"
                style={{
                  padding: '10px 14px',
                  fontSize: '10.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
                  background: period === p ? 'var(--accent-soft)' : 'transparent',
                  color: period === p ? 'var(--accent)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {p}D
              </button>
            ))}
          </div>
        }
      >
        {/* ── Title block ─────────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">WINDOW</span>
            <span className="v">{period} DAYS · {isoDate}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">RUNS LOGGED</span>
            <span className="v">{String(summary.totalRuns).padStart(4, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">PASS RATE</span>
            <span className="v" style={{ color: summary.passRate >= 90 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {isLoading ? '—' : `${summary.passRate}%`}
            </span>
          </div>
          <div className="span2">
            <span className="k">TREND</span>
            <span
              className="v"
              style={{
                color: passRateTrend > 0 ? 'var(--pass)' : passRateTrend < 0 ? 'var(--fail)' : 'var(--ink-1)',
              }}
            >
              {passRateTrend === 0 ? '—' : `${passRateTrend > 0 ? '+' : ''}${passRateTrend.toFixed(1)}%`}
            </span>
          </div>
        </div>

        {/* ── §01 · HERO FIGURES — PASS RATE + TEST COUNT ─────────────── */}
        <section aria-labelledby="hero-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="hero-head">fig. 1 · primary readings</span>
            <span className="rule" />
            <span className="stamp">HERO PLATES · PASS · COUNT</span>
          </div>

          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-0"
            style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}
          >
            <HeroPlate
              part="P-01"
              label="pass rate"
              value={isLoading ? '——' : String(summary.passRate)}
              suffix="%"
              tone={summary.passRate >= 90 ? 'pass' : summary.passRate >= 70 ? 'ink' : 'fail'}
              detail={`DETAIL A · ${period}D WINDOW`}
              dim={`⊢ ${isLoading ? '—' : summary.passRate}% ⊣`}
              trend={passRateTrend}
              rightBorder
            />
            <HeroPlate
              part="P-02"
              label="runs logged"
              value={isLoading ? '——' : String(summary.totalRuns).padStart(3, '0')}
              suffix=""
              tone="ink"
              detail={`DETAIL B · ${summary.passedRuns} PASS · ${summary.failedRuns} FAIL`}
              dim={`⊢ ${summary.passedRuns}/${summary.totalRuns} ⊣`}
            />
          </div>

          {/* Secondary dials row */}
          <div
            className="grid grid-cols-2 md:grid-cols-4"
            style={{
              borderLeft: '1px solid var(--rule-strong)',
              borderRight: '1px solid var(--rule-strong)',
              borderBottom: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 30%, transparent)',
            }}
          >
            <Dial part="D-01" label="passed" value={isLoading ? '—' : String(summary.passedRuns).padStart(2, '0')} tone="pass" />
            <Dial part="D-02" label="failed" value={isLoading ? '—' : String(summary.failedRuns).padStart(2, '0')} tone={summary.failedRuns > 0 ? 'fail' : 'ink'} />
            <Dial part="D-03" label="flaky" value={isLoading ? '—' : String(summary.flakyTests).padStart(2, '0')} tone={summary.flakyTests > 0 ? 'warn' : 'ink'} />
            <Dial part="D-04" label="avg diff" value={isLoading ? '—' : `${summary.avgDiff}%`} tone={summary.avgDiff > 5 ? 'fail' : 'ink'} last />
          </div>
        </section>

        {/* ── §02 · TREND TRACES ──────────────────────────────────────── */}
        <section aria-labelledby="trend-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="trend-head">fig. 2 · trend traces</span>
            <span className="rule" />
            <span className="stamp">
              {trends.length > 0 ? `${trends.length} SAMPLES` : 'NO SAMPLES'}
            </span>
          </div>

          {isLoading ? (
            <LoadingFrame lines="tracing signal…" />
          ) : trends.length === 0 ? (
            <EmptyFrame label="no trend samples on file" />
          ) : (
            <TrendPlate trends={trends} />
          )}
        </section>

        {/* ── §03 · DISTRIBUTION ──────────────────────────────────────── */}
        <section aria-labelledby="dist-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="dist-head">fig. 3 · distribution</span>
            <span className="rule" />
            <span className="stamp">PASS · FAIL · DAILY VOLUME</span>
          </div>

          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}
          >
            {/* Pass/fail bars */}
            <div className="p-8" style={{ borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
              <div
                className="mb-5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                DETAIL C · RESULT SPLIT
              </div>

              <DistRow label="pass" value={summary.passedRuns} total={summary.totalRuns} color="var(--pass)" />
              <div className="h-4" />
              <DistRow label="fail" value={summary.failedRuns} total={summary.totalRuns} color="var(--fail)" />
            </div>

            {/* Daily activity bars */}
            <div className="p-8" style={{ borderBottom: '1px solid var(--rule)' }}>
              <div
                className="mb-5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                DETAIL D · DAILY VOLUME
              </div>
              {trends.length === 0 ? (
                <EmptyFrame label="no daily samples" compact />
              ) : (
                <DailyBars trends={trends} />
              )}
            </div>
          </div>
        </section>

        {/* ── §04 · TOP FAILING TESTS ─────────────────────────────────── */}
        {analytics?.topFailingTests?.length > 0 && (
          <section aria-labelledby="failing-head">
            <div className="vt-section-head">
              <span className="num">§ 04</span>
              <span className="ttl" id="failing-head">schedule of failures</span>
              <span className="rule" />
              <span className="stamp">TOP 5 OFFENDERS</span>
            </div>
            <FailingList items={analytics.topFailingTests.slice(0, 5)} />
          </section>
        )}

        {/* ── §05 · RECENT ACTIVITY ───────────────────────────────────── */}
        <section aria-labelledby="activity-head">
          <div className="vt-section-head">
            <span className="num">§ {analytics?.topFailingTests?.length > 0 ? '05' : '04'}</span>
            <span className="ttl" id="activity-head">recent activity</span>
            <span className="rule" />
            <span className="stamp">
              LAST {Math.min(analytics?.recentActivity?.length || 0, 10)} ENTRIES
            </span>
          </div>
          <ActivityList items={analytics?.recentActivity?.slice(0, 10) || []} loading={isLoading} />
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
          <span>SHEET 05 · INSTRUMENTS</span>
          <span>WINDOW · {period}D</span>
          <span>DRAWN · {isoDate}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ────────────────────────────────────────────────────────── primitives ── */

function HeroPlate({
  part,
  label,
  value,
  suffix,
  tone,
  detail,
  dim,
  trend,
  rightBorder,
}: {
  part: string;
  label: string;
  value: string;
  suffix: string;
  tone: 'pass' | 'fail' | 'warn' | 'ink';
  detail: string;
  dim: string;
  trend?: number;
  rightBorder?: boolean;
}) {
  const color =
    tone === 'pass' ? 'var(--pass)' :
    tone === 'fail' ? 'var(--fail)' :
    tone === 'warn' ? 'var(--warn)' : 'var(--ink-0)';
  return (
    <div
      className="relative p-8 lg:p-10"
      style={{
        borderRight: rightBorder ? '1px solid var(--rule)' : 'none',
        borderBottom: '1px solid var(--rule)',
      }}
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
          {part}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {detail}
        </span>
      </div>

      {/* huge figure */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(80px, 12vw, 176px)',
          lineHeight: 0.88,
          letterSpacing: '-0.045em',
          color,
          fontVariantNumeric: 'tabular-nums',
          textTransform: 'lowercase',
        }}
      >
        {value}
        {suffix && (
          <span style={{ color: 'var(--ink-2)', fontSize: '40%', marginLeft: '4px' }}>
            {suffix}
          </span>
        )}
      </div>

      {/* label */}
      <div
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        {label}
      </div>

      {/* dimension callout */}
      <div className="mt-6">
        <div className="vt-dim-h">
          <span className="tick-l" />
          <span className="tick-r" />
          <span className="v">{dim}</span>
        </div>
      </div>

      {/* trend */}
      {typeof trend === 'number' && trend !== 0 && (
        <div
          className="mt-5 vt-mono"
          style={{
            fontSize: '11px',
            letterSpacing: '0.14em',
            color: trend > 0 ? 'var(--pass)' : 'var(--fail)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%{' '}
          <span style={{ color: 'var(--ink-2)', letterSpacing: '0.2em' }}>VS. PRIOR WINDOW</span>
        </div>
      )}
    </div>
  );
}

function Dial({
  part,
  label,
  value,
  tone,
  last,
}: {
  part: string;
  label: string;
  value: string;
  tone: 'pass' | 'fail' | 'warn' | 'ink';
  last?: boolean;
}) {
  const color =
    tone === 'pass' ? 'var(--pass)' :
    tone === 'fail' ? 'var(--fail)' :
    tone === 'warn' ? 'var(--warn)' : 'var(--ink-0)';
  return (
    <div
      className="p-6"
      style={{
        borderRight: last ? 'none' : '1px solid var(--rule)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {part}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3.2vw, 44px)',
          lineHeight: 1,
          letterSpacing: '-0.025em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div
        className="mt-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TrendPlate({ trends }: { trends: Array<{ date: string; passed: number; failed: number; total: number }> }) {
  const width = 800;
  const height = 180;
  const padX = 20;
  const padY = 18;
  const n = trends.length;
  const maxVal = Math.max(...trends.map((d) => Math.max(d.passed, d.failed)), 1);
  const stepX = n > 1 ? (width - padX * 2) / (n - 1) : 0;

  const passPoints = trends
    .map((d, i) => `${padX + i * stepX},${height - padY - (d.passed / maxVal) * (height - padY * 2)}`)
    .join(' ');
  const failPoints = trends
    .map((d, i) => `${padX + i * stepX},${height - padY - (d.failed / maxVal) * (height - padY * 2)}`)
    .join(' ');

  const firstDate = trends[0]?.date
    ? new Date(trends[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const lastDate = trends[n - 1]?.date
    ? new Date(trends[n - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div
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
        <span>FIG. 2 · TRACE · PASS vs. FAIL</span>
        <span>MAX · {maxVal}</span>
      </div>

      <div className="p-6">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
          {/* grid ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={padX}
              x2={width - padX}
              y1={padY + t * (height - padY * 2)}
              y2={padY + t * (height - padY * 2)}
              stroke="var(--rule-soft)"
              strokeWidth="0.5"
              strokeDasharray="2,3"
            />
          ))}
          {/* frame */}
          <rect x={padX} y={padY} width={width - padX * 2} height={height - padY * 2} fill="none" stroke="var(--rule)" strokeWidth="0.5" />
          {/* pass trace */}
          <polyline fill="none" stroke="var(--pass)" strokeWidth="1.25" points={passPoints} />
          {/* fail trace */}
          <polyline fill="none" stroke="var(--fail)" strokeWidth="1.25" points={failPoints} />
        </svg>

        {/* legend + axis stamps */}
        <div
          className="mt-4 flex items-center justify-between gap-6 flex-wrap"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span style={{ display: 'inline-block', width: '16px', height: '1.5px', background: 'var(--pass)' }} />
              <span style={{ color: 'var(--pass)' }}>PASS</span>
            </span>
            <span className="flex items-center gap-2">
              <span style={{ display: 'inline-block', width: '16px', height: '1.5px', background: 'var(--fail)' }} />
              <span style={{ color: 'var(--fail)' }}>FAIL</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>{firstDate}</span>
            <span style={{ color: 'var(--ink-3)' }}>—</span>
            <span>{lastDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DistRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: 'var(--ink-0)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(value).padStart(3, '0')} / {String(total).padStart(3, '0')} · {pct}%
        </span>
      </div>
      <div style={{ height: '8px', border: '1px solid var(--rule)', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: color,
            opacity: 0.35,
          }}
        />
      </div>
    </div>
  );
}

function DailyBars({ trends }: { trends: Array<{ date: string; total: number }> }) {
  const max = Math.max(...trends.map((d) => d.total), 1);
  const first = trends[0]?.date
    ? new Date(trends[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const last = trends[trends.length - 1]?.date
    ? new Date(trends[trends.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  return (
    <>
      <div className="flex items-end gap-[2px]" style={{ height: '80px' }}>
        {trends.map((d, i) => {
          const h = (d.total / max) * 100;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(h, d.total > 0 ? 3 : 0)}%`,
                minHeight: d.total > 0 ? '2px' : 0,
                background: 'var(--ink-1)',
                opacity: 0.65,
                borderTop: '1px solid var(--ink-0)',
              }}
            />
          );
        })}
      </div>
      <div
        className="mt-3 flex justify-between"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{first}</span>
        <span>MAX · {max}</span>
        <span>{last}</span>
      </div>
    </>
  );
}

function FailingList({ items }: { items: any[] }) {
  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      <div
        className="grid grid-cols-[60px_1fr_120px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['RANK', 'TEST', 'FAILURES'].map((h, i) => (
          <div
            key={h}
            className="py-3 px-4"
            style={{
              borderRight: i < 2 ? '1px solid var(--rule)' : 'none',
              textAlign: i === 2 ? 'right' : 'left',
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {items.map((item: any, i: number) => (
        <div
          key={item.test?.id || i}
          className="grid grid-cols-[60px_1fr_120px] gap-0"
          style={{
            borderBottom: i < items.length - 1 ? '1px solid var(--rule-soft)' : 'none',
            animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
          }}
        >
          <div
            className="py-3 px-4"
            style={{
              borderRight: '1px solid var(--rule-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.16em',
              color: 'var(--accent)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            #{String(i + 1).padStart(2, '0')}
          </div>
          <div
            className="py-3 px-4 truncate"
            style={{
              borderRight: '1px solid var(--rule-soft)',
              fontFamily: 'var(--font-display)',
              fontSize: '15px',
              color: 'var(--ink-0)',
              textTransform: 'lowercase',
            }}
          >
            {item.testName || item.test?.name || 'unknown'}
          </div>
          <div className="py-3 px-4 flex justify-end items-center">
            <span className="vt-chip vt-chip--fail" style={{ fontSize: '9.5px', padding: '3px 8px' }}>
              {item.failureCount || item.failures} FAIL
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityList({ items, loading }: { items: any[]; loading: boolean }) {
  if (loading) return <LoadingFrame lines="loading activity…" />;
  if (items.length === 0) return <EmptyFrame label="no recent activity" />;
  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      <div
        className="grid grid-cols-[110px_90px_1fr_160px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['ENTRY', 'STATUS', 'TEST', 'STAMP'].map((h, i) => (
          <div
            key={h}
            className="py-3 px-4"
            style={{
              borderRight: i < 3 ? '1px solid var(--rule)' : 'none',
              textAlign: i === 3 ? 'right' : 'left',
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {items.map((a: any, i: number) => (
        <div
          key={a.id}
          className="grid grid-cols-[110px_90px_1fr_160px] gap-0"
          style={{
            borderBottom: i < items.length - 1 ? '1px solid var(--rule-soft)' : 'none',
            animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 25}ms var(--ease-out) both`,
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
            A-{String(i + 1).padStart(3, '0')}
          </div>
          <div
            className="py-3 px-4"
            style={{ borderRight: '1px solid var(--rule-soft)' }}
          >
            <StatusMark status={a.status} />
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
            {a.testName || 'untitled'}
            {a.projectName && (
              <span className="vt-mono" style={{ color: 'var(--ink-2)', fontSize: '10.5px', marginLeft: '8px', letterSpacing: '0.14em' }}>
                · {a.projectName}
              </span>
            )}
          </div>
          <div
            className="py-3 px-4 text-right vt-mono"
            style={{
              fontSize: '10.5px',
              letterSpacing: '0.08em',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {new Date(a.createdAt).toLocaleString('en-US', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusMark({ status }: { status: string }) {
  const cfg: Record<string, { className: string; label: string }> = {
    PASSED: { className: 'vt-chip vt-chip--pass', label: 'PASS' },
    FAILED: { className: 'vt-chip vt-chip--fail', label: 'FAIL' },
    RUNNING: { className: 'vt-chip vt-chip--accent', label: 'RUN' },
    QUEUED: { className: 'vt-chip', label: 'QUEUE' },
  };
  const c = cfg[status] || { className: 'vt-chip', label: status || '—' };
  return (
    <span className={c.className} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
      {c.label}
    </span>
  );
}

function LoadingFrame({ lines }: { lines: string }) {
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
        {lines}
      </div>
    </div>
  );
}

function EmptyFrame({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div
      className={compact ? 'p-5 text-center' : 'p-12 text-center'}
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="vt-mono"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        — {label} —
      </div>
    </div>
  );
}
