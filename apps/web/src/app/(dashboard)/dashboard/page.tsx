'use client';

// Dashboard — authenticated home.
// Editorial hierarchy: a project headline + last-run hero + three
// attention lanes (drafts in progress, pending reviews, baselines
// drifting). Deliberately NOT a grid of 12 equal-weight stat cards.
// The user should see ONE thing they're meant to do, and three things
// waiting in line.

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Compass,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useCurrentProject } from '@/hooks/useProject';
import {
  api,
  dashboardApi,
  testsApi,
  visualApi,
  executionsApi,
} from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';

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
    queryFn: () => executionsApi.list(project!.id, { limit: '6' } as any),
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

  const tests = recentTests || [];
  const visuals = pendingVisuals || [];
  const runs = recentRuns || [];

  const totalTests = stats?.totalTests ?? 0;
  const passRate = stats
    ? Math.round((stats.passingTests / Math.max(totalTests, 1)) * 100)
    : 0;
  const lastRun = (runs as any[])[0];

  return (
    <VtStage width="wide">
      {/* ── Masthead ─────────────────────────────────── */}
      <header className="mb-14 pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="flex items-baseline justify-between gap-6 flex-wrap">
          <div className="vt-stagger">
            <div className="vt-eyebrow">Project · {project.slug || project.id.slice(-8)}</div>
            <h1
              className="mt-6 vt-display"
              style={{
                fontSize: 'clamp(48px, 7vw, 88px)',
                lineHeight: 0.95,
              }}
            >
              {project.name.split(' ').slice(0, -1).join(' ') || project.name}{' '}
              <em>{project.name.split(' ').slice(-1)}</em>
            </h1>
            {project.description && (
              <p
                className="mt-3 vt-italic"
                style={{
                  fontVariationSettings: '"opsz" 24',
                  fontSize: '17px',
                  color: 'var(--ink-1)',
                }}
              >
                {project.description}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/scan/new" className="vt-btn">
              <Compass className="w-4 h-4" />
              Scan project
            </Link>
            <Link href="/tests/new" className="vt-btn vt-btn--primary">
              <Plus className="w-4 h-4" />
              New test
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stat ledger — editorial numbers row ─────────────────────── */}
      <section
        className="mb-16 grid grid-cols-2 md:grid-cols-4 divide-x"
        style={{ borderColor: 'var(--rule)' }}
      >
        <Stat num={totalTests} unit="" label="Tests" accent />
        <Stat num={passRate} unit="%" label="Passing" />
        <Stat num={visuals.length} unit="" label="Pending review" tone={visuals.length > 0 ? 'warn' : undefined} />
        <Stat num={stats?.flakyTests ?? 0} unit="" label="Flaky" tone={(stats?.flakyTests ?? 0) > 0 ? 'fail' : undefined} />
      </section>

      {/* ── Last run — hero card (editorial) ─────────────────────────── */}
      <section className="mb-20 vt-editorial">
        <article>
          <div className="vt-kicker mb-3" style={{ color: 'var(--brass)' }}>
            § Last run
          </div>
          {lastRun ? (
            <>
              <h2
                className="vt-display"
                style={{
                  fontSize: 'clamp(32px, 4vw, 52px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {lastRun.test?.name || 'Untitled run'}
              </h2>
              <div
                className="mt-3 vt-mono text-[12px] tracking-[0.1em]"
                style={{ color: 'var(--ink-2)' }}
              >
                {new Date(lastRun.createdAt).toLocaleString()} ·{' '}
                {lastRun.duration
                  ? `${(lastRun.duration / 1000).toFixed(1)}s`
                  : '—'}{' '}
                · {lastRun.platform || 'WEB'}
              </div>
              <div className="mt-6">
                <StatusChip status={lastRun.status} />
              </div>
              {lastRun.errorMessage && (
                <p
                  className="mt-4 p-4 font-mono text-[12.5px] leading-[1.6]"
                  style={{
                    background: 'var(--fail-soft)',
                    borderLeft: '2px solid var(--fail)',
                    color: 'var(--fail)',
                  }}
                >
                  {String(lastRun.errorMessage).slice(0, 320)}
                </p>
              )}
              <div className="mt-8 flex gap-3">
                <Link
                  href={`/executions/${lastRun.id}`}
                  className="vt-btn"
                >
                  Open run
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2
                className="vt-display"
                style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}
              >
                <em>No runs</em> yet.
              </h2>
              <p className="mt-4 text-[17px]" style={{ color: 'var(--ink-1)' }}>
                Write a story, hit Run. We&apos;ll photograph every step and
                file the report here.
              </p>
              <div className="mt-8">
                <Link href="/tests/new" className="vt-btn vt-btn--primary">
                  <Plus className="w-4 h-4" />
                  Author a first test
                </Link>
              </div>
            </>
          )}
        </article>

        <aside className="relative">
          <div
            className="p-5 border-l"
            style={{ borderColor: 'var(--rule)' }}
          >
            <div
              className="vt-kicker mb-3"
              style={{ color: 'var(--ink-2)' }}
            >
              Recent activity
            </div>
            <ol className="space-y-3 m-0 p-0 list-none">
              {runs.slice(0, 6).map((r: any) => (
                <li key={r.id}>
                  <Link
                    href={`/executions/${r.id}`}
                    className="group flex items-baseline gap-3 py-2 border-b"
                    style={{ borderColor: 'var(--rule-soft)' }}
                  >
                    <StatusDot status={r.status} />
                    <span
                      className="flex-1 text-[14px] truncate group-hover:text-[color:var(--ink-0)] transition-colors"
                      style={{ color: 'var(--ink-1)' }}
                    >
                      {r.test?.name || 'Untitled run'}
                    </span>
                    <span
                      className="vt-mono text-[10.5px] tracking-[0.08em]"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {timeAgo(r.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
              {runs.length === 0 && (
                <li
                  className="vt-italic py-2 text-[14px]"
                  style={{ color: 'var(--ink-2)' }}
                >
                  No runs to show yet.
                </li>
              )}
            </ol>
          </div>
        </aside>
      </section>

      {/* ── Three lanes ─────────────────────────────────────────── */}
      <section
        className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-10 border-t"
        style={{ borderColor: 'var(--rule)' }}
      >
        <Lane
          kicker="§ tests · drafts"
          title="Recent tests"
          more={{ href: '/tests', label: 'All tests' }}
          empty="You haven't written a test yet. The editor is a minute away."
          items={tests.slice(0, 5).map((t: any) => ({
            id: t.id,
            href: `/tests/${t.id}`,
            title: t.name,
            meta: (t as any).goal
              ? (t as any).goal.slice(0, 80)
              : 'No goal set',
            chip:
              t.status === 'ACTIVE'
                ? { label: 'active', tone: 'default' as const }
                : { label: t.status.toLowerCase(), tone: 'mute' as const },
          }))}
        />

        <Lane
          kicker="§ pending review"
          title="Visual changes"
          more={{ href: '/visual', label: 'All changes' }}
          empty="No visual changes waiting. You're caught up."
          items={visuals.slice(0, 5).map((v: any) => ({
            id: v.id,
            href: `/visual/${v.id}`,
            title: v.test?.name || 'Unattributed comparison',
            meta: `Δ ${(v.diffScore * 100).toFixed(1)}%`,
            chip: { label: 'review', tone: 'warn' as const },
          }))}
        />

        <Lane
          kicker="§ fixes"
          title="Bug candidates"
          more={{ href: '/fixes', label: 'All fixes' }}
          empty="No open fix candidates."
          items={(stats as any)?.bugCandidates?.slice?.(0, 5)?.map?.((b: any) => ({
            id: b.id,
            href: `/fixes/${b.id}`,
            title: b.title,
            meta: b.failureType || '—',
            chip: { label: b.severity?.toLowerCase() || 'med', tone: 'fail' as const },
          })) ?? []}
        />
      </section>

      {/* ── Colophon ──────────────────────────────────── */}
      <footer
        className="mt-20 pt-6 border-t vt-mono text-[11px] tracking-[0.14em] uppercase flex justify-between gap-4 flex-wrap"
        style={{ borderColor: 'var(--rule)', color: 'var(--ink-2)' }}
      >
        <span>
          Dashboard · {project.name}
        </span>
        <span>
          Press{' '}
          <kbd
            className="px-1.5 py-0.5"
            style={{ background: 'var(--bg-2)', color: 'var(--ink-1)' }}
          >
            ⌘K
          </kbd>{' '}
          anywhere to jump
        </span>
      </footer>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function Stat({
  num,
  unit,
  label,
  accent,
  tone,
}: {
  num: number;
  unit?: string;
  label: string;
  accent?: boolean;
  tone?: 'warn' | 'fail';
}) {
  const color =
    tone === 'warn'
      ? 'var(--warn)'
      : tone === 'fail'
      ? 'var(--fail)'
      : accent
      ? 'var(--ink-0)'
      : 'var(--ink-0)';
  return (
    <div className="px-6 first:pl-0 py-2" style={{ borderColor: 'var(--rule)' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontVariationSettings: '"opsz" 144',
          fontWeight: 380,
          fontSize: 'clamp(44px, 5vw, 68px)',
          letterSpacing: '-0.035em',
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {num.toLocaleString()}
        {unit && (
          <span
            className="vt-mono text-[40%] ml-1"
            style={{ color: 'var(--ink-2)' }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        className="mt-2 vt-kicker"
        style={{ color: tone ? color : 'var(--ink-2)' }}
      >
        {label}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
    PASSED: { className: 'vt-chip vt-chip--pass', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Passed' },
    FAILED: { className: 'vt-chip vt-chip--fail', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed' },
    RUNNING: { className: 'vt-chip vt-chip--accent', icon: <Clock className="w-3.5 h-3.5 animate-pulse" />, label: 'Running' },
    QUEUED: { className: 'vt-chip', icon: <Clock className="w-3.5 h-3.5" />, label: 'Queued' },
  };
  const c = cfg[status] || { className: 'vt-chip', icon: <AlertCircle className="w-3.5 h-3.5" />, label: status };
  return (
    <span className={c.className}>
      {c.icon}
      {c.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'PASSED'
      ? 'var(--pass)'
      : status === 'FAILED'
      ? 'var(--fail)'
      : status === 'RUNNING' || status === 'QUEUED'
      ? 'var(--accent)'
      : 'var(--ink-2)';
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 10px 0 ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

function Lane({
  kicker,
  title,
  more,
  items,
  empty,
}: {
  kicker: string;
  title: string;
  more: { href: string; label: string };
  empty: string;
  items: Array<{
    id: string;
    href: string;
    title: string;
    meta: string;
    chip?: { label: string; tone: 'default' | 'mute' | 'warn' | 'fail' };
  }>;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div className="vt-kicker" style={{ color: 'var(--brass)' }}>
          {kicker}
        </div>
        <Link
          href={more.href}
          className="vt-kicker transition-colors"
          style={{ color: 'var(--ink-2)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
        >
          {more.label} →
        </Link>
      </div>
      <h3
        className="mb-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontVariationSettings: '"opsz" 72',
          fontWeight: 360,
          fontSize: '26px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p
          className="vt-italic text-[14.5px] py-2"
          style={{ color: 'var(--ink-2)' }}
        >
          {empty}
        </p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {items.map((it, i) => (
            <li
              key={it.id}
              className="border-b last:border-0"
              style={{
                borderColor: 'var(--rule)',
                animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 50}ms var(--ease-out) both`,
              }}
            >
              <Link
                href={it.href}
                className="group flex items-baseline gap-3 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[15px] font-medium truncate group-hover:text-[color:var(--accent)] transition-colors"
                    style={{ color: 'var(--ink-0)' }}
                  >
                    {it.title}
                  </div>
                  <div
                    className="vt-mono text-[11px] tracking-[0.05em] mt-1 truncate"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {it.meta}
                  </div>
                </div>
                {it.chip && (
                  <span
                    className={
                      it.chip.tone === 'fail'
                        ? 'vt-chip vt-chip--fail'
                        : it.chip.tone === 'warn'
                        ? 'vt-chip vt-chip--warn'
                        : 'vt-chip'
                    }
                  >
                    {it.chip.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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
