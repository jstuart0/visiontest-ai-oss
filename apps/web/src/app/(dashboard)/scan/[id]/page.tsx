'use client';

// Scan · Detail — the survey report.
//
// Title-block with scan metadata, four summary cells (OK · WARN · FAIL ·
// SKIP), then the primary figure — a ruled hierarchical coverage tree.
// Every discovered page / interaction is a node with a safety
// classification chip. Failed interactions get a separate §04 ledger.

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldOff,
  Loader2,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

interface ExploreNode {
  id: string;
  executionId: string;
  url: string;
  parentId: string | null;
  orderIndex: number;
  interactionKind: string;
  interactionLabel: string;
  interactionSelector: string | null;
  status: 'ok' | 'warn' | 'fail' | 'skipped';
  skipReason: string | null;
  errorText: string | null;
  httpStatus: number | null;
  screenshotPre: string | null;
  screenshotPost: string | null;
  consoleErrors: string[] | null;
  durationMs: number | null;
}

interface ScanData {
  executionId: string;
  status: string;
  mode: string;
  summary: {
    pagesVisited: number;
    interactionsTried: number;
    ok: number;
    warn: number;
    fail: number;
    skipped: number;
  } | null;
  nodes: ExploreNode[];
}

const STATUS_MARK: Record<
  ExploreNode['status'],
  { label: string; color: string; chipClass: string; Icon: React.ElementType }
> = {
  ok:      { label: 'OK',      color: 'var(--pass)', chipClass: 'vt-chip vt-chip--pass', Icon: CheckCircle2 },
  warn:    { label: 'WARN',    color: 'var(--warn)', chipClass: 'vt-chip vt-chip--warn', Icon: AlertTriangle },
  fail:    { label: 'FAIL',    color: 'var(--fail)', chipClass: 'vt-chip vt-chip--fail', Icon: XCircle },
  skipped: { label: 'SKIPPED', color: 'var(--ink-2)', chipClass: 'vt-chip',              Icon: ShieldOff },
};

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const { data, isLoading, refetch } = useQuery<ScanData>({
    queryKey: ['scan', executionId],
    queryFn: async () => api.get(`/executions/${executionId}/nodes`),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'QUEUED' || s === 'RUNNING' ? 2000 : false;
    },
  });

  // Build a tree by parentId for hierarchical rendering.
  const tree = useMemo(() => {
    if (!data) return null;
    const byParent = new Map<string | null, ExploreNode[]>();
    for (const n of data.nodes) {
      const key = n.parentId;
      const list = byParent.get(key) || [];
      list.push(n);
      byParent.set(key, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return byParent;
  }, [data]);

  if (isLoading || !data) {
    return (
      <VtStage width="wide">
        <div
          className="p-12 text-center mt-16"
          style={{
            border: '1px dashed var(--rule)',
            background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
          }}
        >
          <div
            className="inline-flex items-center gap-3"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            LOADING SURVEY
          </div>
        </div>
      </VtStage>
    );
  }

  const stillRunning = data.status === 'QUEUED' || data.status === 'RUNNING';
  const failed = data.nodes.filter((n) => n.status === 'fail');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const shortId = data.executionId.slice(-8).toUpperCase();

  const revStampClass =
    data.status === 'FAILED'
      ? 'vt-rev-stamp vt-rev-stamp--reject'
      : data.status === 'PASSED' || data.status === 'COMPLETED'
      ? 'vt-rev-stamp vt-rev-stamp--pass'
      : 'vt-rev-stamp';

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="08 / 14"
        eyebrow={`§ 08 · SURVEY REPORT · ${shortId}`}
        revision={<>REV · 01 · {today}</>}
        back={{ label: 'BACK' }}
        title={
          <>
            survey <em>report</em>
          </>
        }
        lead={
          'Coverage map of the site from the commissioned entry point. Every discovered page and interaction is filed below with a safety classification.'
        }
        actions={
          stillRunning && (
            <button type="button" onClick={() => refetch()} className="vt-btn">
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              REFRESH
            </button>
          )
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">SURVEY ID</span>
            <span className="v big">VT-SCAN-{shortId}</span>
          </div>
          <div className="span2">
            <span className="k">MODE</span>
            <span className="v">{(data.mode || 'READ-ONLY').toUpperCase()}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>01</span>
          </div>
          <div className="span2">
            <span className="k">STATUS</span>
            <span className="v" style={{ color: stillRunning ? 'var(--accent)' : 'var(--ink-0)' }}>
              {data.status}
            </span>
          </div>
          <div className="span2">
            <span className="k">PAGES · VISITED</span>
            <span className="v">
              {String(data.summary?.pagesVisited ?? 0).padStart(3, '0')}
            </span>
          </div>
          <div className="span2">
            <span className="k">INTERACTIONS</span>
            <span className="v">
              {String(data.summary?.interactionsTried ?? 0).padStart(3, '0')}
            </span>
          </div>
        </div>

        {/* State stamp */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={revStampClass}>
            {stillRunning ? 'IN PROGRESS' : data.status}
          </span>
          {data.summary && !stillRunning && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.summary.pagesVisited} PAGES · {data.summary.interactionsTried} INTERACTIONS
            </span>
          )}
        </div>

        {/* §02 — tally */}
        {data.summary && (
          <section>
            <div className="vt-section-head">
              <span className="num">§ 02</span>
              <span className="ttl">tally of interactions</span>
              <span className="rule" />
              <span className="stamp">FOUR COLUMNS · CLASSIFIED</span>
            </div>
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-0"
              style={{ border: '1px solid var(--rule-strong)' }}
            >
              <TallyCell label="OK" value={data.summary.ok} color="var(--pass)" stamp="S-01" />
              <TallyCell
                label="WARN"
                value={data.summary.warn}
                color="var(--warn)"
                stamp="S-02"
                leftBorder
              />
              <TallyCell
                label="FAIL"
                value={data.summary.fail}
                color="var(--fail)"
                stamp="S-03"
                leftBorder
              />
              <TallyCell
                label="SKIP"
                value={data.summary.skipped}
                color="var(--ink-2)"
                stamp="S-04"
                leftBorder
              />
            </div>
          </section>
        )}

        {/* §03 — coverage tree */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl">fig. 1 · coverage map</span>
            <span className="rule" />
            <span className="stamp">
              {data.nodes.length === 0
                ? stillRunning
                  ? 'AWAITING NODES'
                  : 'NO NODES'
                : `${data.nodes.length} NODES · HIERARCHICAL`}
            </span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div
              className="flex justify-between items-center px-6 py-3"
              style={{
                borderBottom: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>FIG. 1 · COVERAGE · {shortId}</span>
              <span>ORTHOGRAPHIC · RULED LIST</span>
            </div>

            {data.nodes.length === 0 ? (
              <div
                className="p-10 text-center"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {stillRunning
                  ? '⊢ SCAN STARTING · NODES WILL APPEAR ⊣'
                  : '⊢ NO INTERACTIONS RECORDED ⊣'}
              </div>
            ) : (
              <div className="px-6 py-6">
                <TreeNodes
                  parent={null}
                  byParent={tree!}
                  depth={0}
                  idxRef={{ n: 0 }}
                />
              </div>
            )}
          </div>
        </section>

        {/* §04 — failed ledger */}
        {failed.length > 0 && (
          <section>
            <div className="vt-section-head">
              <span className="num">§ 04</span>
              <span className="ttl">failed interactions</span>
              <span className="rule" />
              <span className="stamp" style={{ color: 'var(--fail)' }}>
                {failed.length} REQUIRES ATTENTION
              </span>
            </div>
            <div
              style={{
                border: '1px solid color-mix(in oklab, var(--fail) 40%, var(--rule-strong))',
                background: 'var(--fail-soft)',
              }}
            >
              {failed.map((n, i) => (
                <FailedRow
                  key={n.id}
                  node={n}
                  part={`X-${String(i + 1).padStart(3, '0')}`}
                  isLast={i === failed.length - 1}
                />
              ))}
            </div>
          </section>
        )}

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
          <span>SHEET 08 · SURVEY · {shortId}</span>
          <span>MODE · {(data.mode || 'READ-ONLY').toUpperCase()}</span>
          <span>NODES · {String(data.nodes.length).padStart(3, '0')}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ── primitives ──────────────────────────────────────────────────── */

function TallyCell({
  label,
  value,
  color,
  stamp,
  leftBorder,
}: {
  label: string;
  value: number;
  color: string;
  stamp: string;
  leftBorder?: boolean;
}) {
  return (
    <div
      style={{
        padding: '22px 22px 20px',
        borderLeft: leftBorder ? '1px solid var(--rule)' : 'none',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
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
            fontSize: '9.5px',
            letterSpacing: '0.18em',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {stamp}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 4vw, 54px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(value).padStart(2, '0')}
      </div>
    </div>
  );
}

function TreeNodes({
  parent,
  byParent,
  depth,
  idxRef,
}: {
  parent: string | null;
  byParent: Map<string | null, ExploreNode[]>;
  depth: number;
  idxRef: { n: number };
}) {
  const nodes = byParent.get(parent) || [];
  if (nodes.length === 0) return null;
  return (
    <div>
      {nodes.map((n, i) => {
        idxRef.n += 1;
        const mark = STATUS_MARK[n.status];
        const partNo = `N-${String(idxRef.n).padStart(3, '0')}`;
        const isLast = i === nodes.length - 1;
        return (
          <div key={n.id}>
            <div
              className="flex items-start gap-4 py-2"
              style={{ paddingLeft: `${depth * 24}px` }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  letterSpacing: '0.16em',
                  color: 'var(--accent)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: '60px',
                  paddingTop: '2px',
                }}
              >
                {partNo}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--ink-3)',
                  fontVariantNumeric: 'tabular-nums',
                  paddingTop: '2px',
                  minWidth: '24px',
                }}
              >
                {depth === 0 ? '·' : isLast ? '└─' : '├─'}
              </span>
              <mark.Icon
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                strokeWidth={1.5}
                style={{ color: mark.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="truncate"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12.5px',
                      color: 'var(--ink-0)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {n.interactionLabel || n.interactionKind}
                  </span>
                  {n.httpStatus && (
                    <span
                      className="vt-chip"
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        color:
                          n.httpStatus >= 500
                            ? 'var(--fail)'
                            : n.httpStatus >= 400
                            ? 'var(--warn)'
                            : 'var(--ink-2)',
                        borderColor:
                          n.httpStatus >= 500
                            ? 'color-mix(in oklab, var(--fail) 50%, var(--rule))'
                            : n.httpStatus >= 400
                            ? 'color-mix(in oklab, var(--warn) 50%, var(--rule))'
                            : 'var(--rule)',
                      }}
                    >
                      {n.httpStatus}
                    </span>
                  )}
                  <span
                    className={mark.chipClass}
                    style={{ fontSize: '8.5px', padding: '2px 6px' }}
                  >
                    {mark.label}
                  </span>
                </div>
                {n.skipReason && (
                  <div
                    className="mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.08em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    SKIPPED · {n.skipReason}
                  </div>
                )}
                {n.url && n.interactionKind === 'navigate' && (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 truncate max-w-full"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.04em',
                      color: 'var(--ink-2)',
                      transition: 'color var(--dur-quick) var(--ease-out)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
                  >
                    <span className="truncate">{n.url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </div>
            <TreeNodes
              parent={n.id}
              byParent={byParent}
              depth={depth + 1}
              idxRef={idxRef}
            />
          </div>
        );
      })}
    </div>
  );
}

function FailedRow({
  node,
  part,
  isLast,
}: {
  node: ExploreNode;
  part: string;
  isLast: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[90px_1fr_auto] gap-0"
      style={{
        borderBottom: isLast ? 'none' : '1px solid color-mix(in oklab, var(--fail) 25%, var(--rule-soft))',
      }}
    >
      <div
        className="py-4 px-4"
        style={{
          borderRight: '1px solid color-mix(in oklab, var(--fail) 25%, var(--rule-soft))',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.16em',
          color: 'var(--fail)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {part}
      </div>
      <div
        className="py-4 px-4 min-w-0"
        style={{
          borderRight: '1px solid color-mix(in oklab, var(--fail) 25%, var(--rule-soft))',
        }}
      >
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--fail)',
            letterSpacing: '0.02em',
          }}
        >
          {node.interactionLabel || node.interactionKind}
        </div>
        <div
          className="mt-1 truncate"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            color: 'var(--ink-2)',
            letterSpacing: '0.04em',
          }}
        >
          on {node.url}
        </div>
        {node.errorText && (
          <pre
            className="mt-2 whitespace-pre-wrap m-0"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11.5px',
              color: 'var(--fail)',
              lineHeight: 1.55,
              letterSpacing: '0.02em',
              background: 'color-mix(in oklab, var(--fail) 8%, transparent)',
              padding: '8px 10px',
              borderLeft: '2px solid var(--fail)',
            }}
          >
            {String(node.errorText).slice(0, 400)}
          </pre>
        )}
      </div>
      <div className="py-4 px-4 flex items-center">
        <button type="button" className="vt-btn vt-btn--ghost" disabled>
          CONVERT TO TEST
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
