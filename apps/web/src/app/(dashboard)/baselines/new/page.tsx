'use client';

// Baselines / new — drafting a new reference print.
// This is the advanced entry point (most users use the "Set as baseline"
// button on an execution page). Sheet-style form: §01 pick execution,
// §02 name + environment + supersede note, §03 commit.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { useCurrentProject } from '@/hooks/useProject';
import { baselinesApi, executionsApi } from '@/lib/api';

const STATUS_META: Record<
  string,
  { icon: React.ElementType; tone: string; chip: string }
> = {
  PASSED: { icon: CheckCircle2, tone: 'var(--pass)', chip: 'vt-chip vt-chip--pass' },
  FAILED: { icon: XCircle, tone: 'var(--fail)', chip: 'vt-chip vt-chip--fail' },
  RUNNING: { icon: Activity, tone: 'var(--accent)', chip: 'vt-chip vt-chip--accent' },
  PENDING: { icon: Clock, tone: 'var(--ink-2)', chip: 'vt-chip' },
  QUEUED: { icon: Clock, tone: 'var(--ink-2)', chip: 'vt-chip' },
};

export default function NewBaselinePage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('main');

  const { data: executions, isLoading } = useQuery({
    queryKey: ['executions', project?.id, 'for-baseline'],
    queryFn: () => executionsApi.list(project!.id, { limit: '30' } as any),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Pick an execution');
      return baselinesApi.fromExecution(selected, {
        name: name.trim() || undefined,
        branch: branch.trim() || 'main',
      });
    },
    onSuccess: (res: any) => {
      toast.success(
        res.replaced
          ? `Baseline "${res.name}" updated`
          : `Baseline "${res.name}" created`,
      );
      router.push('/baselines');
    },
    onError: (err: any) => toast.error(err.message || 'Create failed'),
  });

  const selectedExec = executions?.find((e: any) => e.id === selected);
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
          Pick a <em>project</em> first.
        </h1>
        <div className="mt-8">
          <Link href="/" className="vt-btn vt-btn--primary">BACK TO DASHBOARD</Link>
        </div>
      </VtStage>
    );
  }

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`07.1 / 12`}
        eyebrow={`§ 07.1 · NEW REFERENCE`}
        revision={<>REV · DRAFT · {isoDate}</>}
        back={{ href: '/baselines', label: 'BACK TO ARCHIVE' }}
        title={
          <>
            promote an <em>execution</em>.
          </>
        }
        lead="Pick a run; we promote its screenshots into the archive. Future tests with the same name will compare against this print. Most users reach this flow inline from an execution — this sheet is for renaming, rebranding, or pulling from an older run."
      >
        {/* Advisory strip — the "most people use Set as baseline inline" note */}
        <div
          className="p-4 flex items-start gap-3"
          style={{
            border: '1px solid var(--rule)',
            borderLeft: '2px solid var(--accent)',
            background: 'var(--accent-soft)',
          }}
        >
          <div
            className="vt-mono"
            style={{
              fontSize: '9.5px',
              letterSpacing: '0.22em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              minWidth: 72,
            }}
          >
            ADVISORY
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13.5px',
              lineHeight: 1.5,
              color: 'var(--ink-1)',
              margin: 0,
            }}
          >
            Most users click{' '}
            <span style={{ color: 'var(--accent)' }}>Set as baseline</span>{' '}
            directly on an execution page. This sheet is the drafting bench —
            use it to rename a baseline, pull from an older run, or establish a
            print for a test that has never passed.
          </p>
        </div>

        {/* §01 — pick execution */}
        <section aria-labelledby="pick-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="pick-head">pick an execution</span>
            <span className="rule" />
            <span className="stamp">
              {isLoading
                ? 'LOADING…'
                : !executions || executions.length === 0
                ? 'NIL · NO RUNS'
                : `${executions.length} RECENT`}
            </span>
          </div>

          {isLoading ? (
            <DashedFrame>loading recent runs…</DashedFrame>
          ) : !executions || executions.length === 0 ? (
            <DashedFrame>
              no runs on file — run a test first, the inline set-as-baseline
              button will appear.
            </DashedFrame>
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
                maxHeight: 420,
                overflowY: 'auto',
              }}
            >
              <div
                className="grid grid-cols-[28px_110px_1fr_140px_100px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['', 'RUN', 'TEST', 'STAMP', 'STATUS'].map((h, i) => (
                  <div
                    key={i}
                    className="py-3 px-3"
                    style={{
                      borderRight: i < 4 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 4 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {executions.map((e: any, i: number) => {
                const meta = STATUS_META[e.status] ?? STATUS_META.PENDING;
                const Icon = meta.icon;
                const isSelected = e.id === selected;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setSelected(e.id);
                      if (!name && e.test?.name) setName(e.test.name);
                    }}
                    className="grid grid-cols-[28px_110px_1fr_140px_100px] gap-0 w-full text-left group"
                    style={{
                      borderBottom: i < executions.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                      background: isSelected
                        ? 'var(--accent-soft)'
                        : 'transparent',
                      transition: 'background var(--dur-quick) var(--ease-out)',
                    }}
                    onMouseEnter={(ev) => {
                      if (!isSelected)
                        ev.currentTarget.style.background =
                          'color-mix(in oklab, var(--bg-2) 35%, transparent)';
                    }}
                    onMouseLeave={(ev) => {
                      if (!isSelected) ev.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      className="py-3 px-3 flex items-center justify-center"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        color: isSelected ? 'var(--accent)' : 'var(--ink-3)',
                      }}
                    >
                      <span
                        className="vt-mono"
                        style={{ fontSize: '14px', lineHeight: 1 }}
                      >
                        {isSelected ? '●' : '○'}
                      </span>
                    </div>
                    <div
                      className="py-3 px-3 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '10.5px',
                        letterSpacing: '0.12em',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      R-{String(e.id).slice(-6).toUpperCase()}
                    </div>
                    <div
                      className="py-3 px-3 flex items-center gap-2 min-w-0"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <Icon
                        className="w-3.5 h-3.5 flex-shrink-0"
                        strokeWidth={1.5}
                        style={{ color: meta.tone }}
                      />
                      <span
                        className="truncate"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '15px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                          lineHeight: 1.15,
                        }}
                      >
                        {e.test?.name || 'untitled execution'}
                      </span>
                    </div>
                    <div
                      className="py-3 px-3 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {new Date(e.createdAt).toISOString().slice(5, 16).replace('T', ' · ')}
                    </div>
                    <div className="py-3 px-3 flex items-center justify-end">
                      <span className={meta.chip} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                        {e.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* §02 — name + environment */}
        <section aria-labelledby="meta-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="meta-head">baseline meta</span>
            <span className="rule" />
            <span className="stamp">
              {selectedExec ? 'READY TO FILL' : 'AWAITING · §01'}
            </span>
          </div>

          {!selectedExec ? (
            <DashedFrame>select a run above before filling the draft sheet.</DashedFrame>
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-0"
                style={{ borderBottom: '1px solid var(--rule)' }}
              >
                <label
                  className="block p-6"
                  style={{ borderRight: '1px solid var(--rule)' }}
                >
                  <span
                    className="vt-mono block mb-2"
                    style={{
                      fontSize: '9.5px',
                      letterSpacing: '0.22em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    NAME · <span style={{ color: 'var(--fail)' }}>REQUIRED</span>
                  </span>
                  <input
                    className="vt-input"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    placeholder={(selectedExec as any).test?.name || 'reference print'}
                  />
                  <p
                    className="mt-2 vt-mono"
                    style={{
                      fontSize: '9.5px',
                      letterSpacing: '0.12em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    CONVENTION · MATCH THE TEST NAME VERBATIM
                  </p>
                </label>
                <label className="block p-6">
                  <span
                    className="vt-mono block mb-2"
                    style={{
                      fontSize: '9.5px',
                      letterSpacing: '0.22em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    ENVIRONMENT · BRANCH
                  </span>
                  <input
                    className="vt-input"
                    value={branch}
                    onChange={(ev) => setBranch(ev.target.value)}
                    placeholder="main"
                  />
                  <p
                    className="mt-2 vt-mono"
                    style={{
                      fontSize: '9.5px',
                      letterSpacing: '0.12em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    BASELINES ARE PER-BRANCH · LEAVE AS <span style={{ color: 'var(--ink-1)' }}>MAIN</span> IF UNSURE
                  </p>
                </label>
              </div>
              {/* Supersede advisory */}
              <div
                className="p-5 flex items-start gap-4"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                <span
                  className="vt-rev-stamp"
                  style={{ fontSize: '9.5px', padding: '3px 8px' }}
                >
                  ON APPROVAL
                </span>
                <span>
                  SUPERSEDES EXISTING REVISION · ESTABLISHES <span style={{ color: 'var(--accent)' }}>REV 02</span>
                </span>
              </div>
            </div>
          )}
        </section>

        {/* §03 — commit */}
        <section aria-labelledby="commit-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="commit-head">commit draft</span>
            <span className="rule" />
            <span className="stamp">PRESS TO ESTABLISH</span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="vt-btn vt-btn--ghost"
              onClick={() => router.push('/baselines')}
            >
              CANCEL
            </button>
            <button
              type="button"
              className="vt-btn vt-btn--primary"
              disabled={!selected || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  ESTABLISHING…
                </>
              ) : (
                <>
                  ESTABLISH BASELINE
                </>
              )}
            </button>
          </div>
        </section>

        <Colophon projectName={project.name} slug={project.slug} />
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────── primitives ── */

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
      <span>SHEET 07.1 · DRAFT · {projectName}</span>
      <span>CHECKED · {(slug || 'VT').toUpperCase()}</span>
      <span>ON APPROVAL · SUPERSEDES PRIOR</span>
    </footer>
  );
}
