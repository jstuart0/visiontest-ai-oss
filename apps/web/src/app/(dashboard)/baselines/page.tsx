'use client';

// Baselines — Sheet 07 · Approved drawings archive.
// A baseline is a reference print a test compares against. This sheet
// is the ledger of every approved print: REF · TEST · ENV · ESTABLISHED
// · BY · REVISION. Hero number is the archive count.

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { baselinesApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { toast } from 'sonner';
import { Plus, Play, Trash2, ArrowRight } from 'lucide-react';

export default function BaselinesPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  const { data: baselines, isLoading } = useQuery({
    queryKey: ['baselines', project?.id],
    queryFn: () => baselinesApi.list(project!.id),
    enabled: !!project?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => baselinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines'] });
      toast.success('Baseline deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete'),
  });

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
          Pick a <em>project</em> — then the baseline archive opens.
        </h1>
      </VtStage>
    );
  }

  const rows = (baselines || []) as any[];
  const total = rows.length;
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const branches = new Set(rows.map((r: any) => r.branch || 'main')).size;
  const totalFrames = rows.reduce((acc: number, b: any) => {
    const shots = typeof b.screenshots === 'string' ? safeParse(b.screenshots) : b.screenshots;
    return acc + (Array.isArray(shots) ? shots.length : 0);
  }, 0);

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`07 / 12`}
        eyebrow={`§ 07 · ARCHIVE`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            the <em>reference</em> print.
          </>
        }
        lead="Approved screenshot sets future runs get compared against. One baseline per test, per branch. Diffs open a review room where you approve or reject."
        actions={
          <>
            <Link href="/tests" className="vt-btn">
              <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
              RUN A TEST
            </Link>
            <Link href="/baselines/new" className="vt-btn vt-btn--primary">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              NEW BASELINE
            </Link>
          </>
        }
      >
        {/* Figure plate — archive count hero */}
        <section aria-labelledby="hero-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="hero-head">archive index</span>
            <span className="rule" />
            <span className="stamp">FIG. 1 · REFERENCE PRINTS</span>
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
                APPROVED · ON FILE · {isoDate}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontVariationSettings: '"opsz" 144',
                  fontWeight: 300,
                  fontSize: 'clamp(96px, 12vw, 180px)',
                  lineHeight: 0.88,
                  letterSpacing: '-0.04em',
                  color: total > 0 ? 'var(--accent)' : 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(total).padStart(2, '0')}
              </div>
              <div className="mt-4 vt-kicker" style={{ color: total > 0 ? 'var(--accent)' : 'var(--ink-2)' }}>
                {total === 1 ? 'baseline on file' : 'baselines on file'}
              </div>
              <div className="mt-10 relative">
                <div className="vt-dim-h">
                  <span className="tick-l" />
                  <span className="tick-r" />
                  <span className="v">ARCHIVE · {branches} BRANCH · {totalFrames} FRAMES</span>
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
                DETAIL A · ARCHIVE META
              </div>
              <dl className="m-0 space-y-3">
                <MetaRow k="TOTAL" v={String(total).padStart(3, '0')} />
                <MetaRow k="BRANCHES" v={String(branches).padStart(2, '0')} />
                <MetaRow k="FRAMES" v={String(totalFrames).padStart(3, '0')} />
                <MetaRow k="FORMAT" v="PNG · FULL" />
              </dl>
            </aside>
          </div>
        </section>

        {/* §02 — the archive ledger */}
        <section aria-labelledby="ledger-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="ledger-head">archive ledger</span>
            <span className="rule" />
            <span className="stamp">
              {isLoading ? 'LOADING…' : total === 0 ? 'NIL · NOTHING ESTABLISHED' : `${total} PRINTS`}
            </span>
          </div>

          {isLoading ? (
            <DashedFrame>pulling prints from the archive…</DashedFrame>
          ) : total === 0 ? (
            <EmptyArchive />
          ) : (
            <ArchiveTable
              rows={rows}
              onDelete={(id, name) => {
                if (confirm(`Delete baseline "${name}"?`)) deleteMutation.mutate(id);
              }}
            />
          )}
        </section>

        <Colophon projectName={project.name} slug={project.slug} />
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────── primitives ── */

function ArchiveTable({
  rows,
  onDelete,
}: {
  rows: any[];
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      <div
        className="grid grid-cols-[96px_1fr_120px_140px_90px_110px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['REF', 'TEST', 'ENV', 'ESTABLISHED', 'REV', ''].map((h, i) => (
          <div
            key={i}
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
      {rows.map((b: any, i: number) => {
        const shots = typeof b.screenshots === 'string' ? safeParse(b.screenshots) : b.screenshots;
        const shotCount = Array.isArray(shots) ? shots.length : 0;
        const refId = `B-${String(i + 1).padStart(3, '0')}`;
        const established = new Date(b.updatedAt || b.createdAt);
        return (
          <div
            key={b.id}
            className="grid grid-cols-[96px_1fr_120px_140px_90px_110px] gap-0 group"
            style={{
              borderBottom: i < rows.length - 1 ? '1px solid var(--rule-soft)' : 'none',
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
              {refId}
            </div>
            <div
              className="py-4 px-4 min-w-0"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <div
                className="truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                  lineHeight: 1.15,
                }}
              >
                {b.name}
              </div>
              <div
                className="mt-1 flex items-center gap-2 vt-mono"
                style={{
                  fontSize: '9.5px',
                  letterSpacing: '0.14em',
                  color: 'var(--ink-2)',
                  textTransform: 'uppercase',
                }}
              >
                <span>{b.type || 'PROJECT'}</span>
                <span>·</span>
                <span>
                  {shotCount} FRAME{shotCount === 1 ? '' : 'S'}
                </span>
              </div>
            </div>
            <div
              className="py-4 px-4 vt-mono flex items-center gap-1"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontSize: '10.5px',
                letterSpacing: '0.1em',
                color: 'var(--ink-1)',
                textTransform: 'uppercase',
              }}
            >
              {b.branch || 'main'}
            </div>
            <div
              className="py-4 px-4 vt-mono"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontSize: '10.5px',
                letterSpacing: '0.08em',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {established.toISOString().slice(0, 10).replace(/-/g, '.')}
            </div>
            <div
              className="py-4 px-4 vt-mono"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontSize: '10.5px',
                letterSpacing: '0.12em',
                color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              01
            </div>
            <div className="py-3 px-4 flex items-center justify-end gap-1">
              <button
                type="button"
                className="vt-btn vt-btn--ghost"
                style={{
                  padding: '6px 8px',
                  color: 'var(--fail)',
                }}
                onClick={() => onDelete(b.id, b.name)}
                aria-label={`Delete ${b.name}`}
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyArchive() {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div className="vt-kicker" style={{ color: 'var(--ink-2)', justifyContent: 'center' }}>
        ARCHIVE EMPTY
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3vw, 40px)',
          color: 'var(--ink-0)',
        }}
      >
        no reference prints on file.
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          maxWidth: '56ch',
          color: 'var(--ink-1)',
          lineHeight: 1.5,
        }}
      >
        Fastest path: run a test, open the execution, press{' '}
        <span style={{ color: 'var(--accent)' }}>Set as baseline</span>. Every
        step screenshot gets promoted into a new reference print — future runs
        of that test compare against it automatically.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/tests" className="vt-btn vt-btn--primary">
          <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
          PICK A TEST
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Link>
        <Link href="/baselines/new" className="vt-btn">
          OR DRAFT MANUALLY
        </Link>
      </div>
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

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
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
          color: 'var(--ink-0)',
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
      <span>SHEET 07 · ARCHIVE · {projectName}</span>
      <span>CHECKED · {(slug || 'VT').toUpperCase()}</span>
      <span>ONE REFERENCE · PER TEST · PER BRANCH</span>
    </footer>
  );
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
