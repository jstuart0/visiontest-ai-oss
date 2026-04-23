'use client';

// Approvals — Sheet 06 · Verdicts log.
// Every pending change is a ruled row awaiting a rev-stamp. Delegation
// rules are the standing orders that govern how new changes get routed.

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsApi, ApprovalRequest } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
} from 'lucide-react';

export default function ApprovalsPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: ['approvals', 'pending', project?.id],
    queryFn: () => approvalsApi.pending(project!.id),
    enabled: !!project?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ['approvals', 'stats', project?.id],
    queryFn: () => approvalsApi.stats(project!.id),
    enabled: !!project?.id,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Approved');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id, 'Rejected via approvals page'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Rejected');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to reject'),
  });

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
          Pick a <em>project</em> — then the verdicts log opens.
        </h1>
      </VtStage>
    );
  }

  const rows = (pending || []) as ApprovalRequest[];
  const pendingCount = rows.length;
  const approvedToday = stats?.approvedToday ?? 0;
  const rejectedToday = stats?.rejectedToday ?? 0;
  const avgEscalations = stats?.avgEscalations ?? 0;
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`06 / 12`}
        eyebrow={`§ 06 · TRIBUNAL`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            who decides <em>what</em>.
          </>
        }
        lead="Verdicts log. Each pending change sits ruled and numbered until a human stamps it. The review itself happens next door; this sheet is just the routing."
      >
        {/* Figure plate — the single number that matters */}
        <section aria-labelledby="count-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="count-head">pending count</span>
            <span className="rule" />
            <span className="stamp">FIG. 1 · TRIBUNAL DOCKET</span>
          </div>

          <div
            className="relative grid grid-cols-1 lg:grid-cols-[1fr_320px]"
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
                AWAITING VERDICT · {isoDate}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontVariationSettings: '"opsz" 144',
                  fontWeight: 300,
                  fontSize: 'clamp(96px, 12vw, 180px)',
                  lineHeight: 0.88,
                  letterSpacing: '-0.04em',
                  color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(pendingCount).padStart(2, '0')}
              </div>
              <div className="mt-4 vt-kicker" style={{ color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-2)' }}>
                {pendingCount === 1 ? 'change awaiting verdict' : 'changes awaiting verdict'}
              </div>

              <div className="mt-10 relative">
                <div className="vt-dim-h">
                  <span className="tick-l" />
                  <span className="tick-r" />
                  <span className="v">DOCKET · {pendingCount === 0 ? 'CLEAR' : `${pendingCount} OPEN`}</span>
                </div>
              </div>
            </div>

            {/* Detail — daily tallies as title-block meta */}
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
                DETAIL A · TODAY · 24H
              </div>
              <dl className="m-0 space-y-3">
                <MetaRow k="APPROVED" v={String(approvedToday).padStart(2, '0')} tone="pass" />
                <MetaRow k="REJECTED" v={String(rejectedToday).padStart(2, '0')} tone="fail" />
                <MetaRow
                  k="ESCAL · AVG"
                  v={typeof avgEscalations === 'number' ? avgEscalations.toFixed(1) : '0.0'}
                />
                <MetaRow k="ROUTE" v="MANUAL" />
              </dl>
            </aside>
          </div>
        </section>

        {/* §02 — the docket (ruled rows) */}
        <section aria-labelledby="docket-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="docket-head">the docket</span>
            <span className="rule" />
            <span className="stamp">
              {isLoading ? 'LOADING…' : pendingCount === 0 ? 'NIL · CLEAR' : `${pendingCount} PLATES ON FILE`}
            </span>
          </div>

          {isLoading ? (
            <DashedFrame>loading docket…</DashedFrame>
          ) : pendingCount === 0 ? (
            <EmptyDocket />
          ) : (
            <Docket
              rows={rows}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => rejectMutation.mutate(id)}
              pending={approveMutation.isPending || rejectMutation.isPending}
            />
          )}
        </section>

        {/* §03 — standing orders (delegation rules) */}
        <section aria-labelledby="rules-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="rules-head">standing orders</span>
            <span className="rule" />
            <span className="stamp">DELEGATION RULES</span>
          </div>
          <RulesSection projectId={project.id} />
        </section>

        <Colophon projectName={project.name} slug={project.slug} />
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────── primitives ── */

function Docket({
  rows,
  onApprove,
  onReject,
  pending,
}: {
  rows: ApprovalRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      {/* header row */}
      <div
        className="grid grid-cols-[96px_120px_1fr_120px_220px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['PLATE', 'SEVERITY', 'SUBJECT', 'FILED', 'VERDICT'].map((h, i) => (
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

      {rows.map((approval, i) => {
        const sev = (approval.severity || 'MEDIUM').toUpperCase();
        const sevTone =
          sev === 'CRITICAL' || sev === 'HIGH'
            ? 'vt-chip--fail'
            : sev === 'MEDIUM'
            ? 'vt-chip--warn'
            : 'vt-chip';
        return (
          <div
            key={approval.id}
            className="grid grid-cols-[96px_120px_1fr_120px_220px] gap-0 group"
            style={{
              borderBottom: i < rows.length - 1 ? '1px solid var(--rule-soft)' : 'none',
              animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
            }}
          >
            <div
              className="py-4 px-4"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                letterSpacing: '0.14em',
                color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              A-{approval.comparisonId.slice(0, 6).toUpperCase()}
            </div>
            <div
              className="py-4 px-4 flex items-center gap-2"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <span className={`vt-chip ${sevTone}`} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                {sev}
              </span>
              {approval.escalations > 0 && (
                <span
                  className="vt-mono"
                  style={{
                    fontSize: '9.5px',
                    letterSpacing: '0.14em',
                    color: 'var(--ink-2)',
                  }}
                >
                  ×{approval.escalations}
                </span>
              )}
            </div>
            <div
              className="py-4 px-4 min-w-0"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                  lineHeight: 1.15,
                }}
                className="truncate"
              >
                comparison · {approval.comparisonId.slice(0, 8)}
              </div>
              <div
                className="mt-1 vt-mono"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: 'var(--ink-2)',
                  textTransform: 'uppercase',
                }}
              >
                {(approval.changeType || 'VISUAL CHANGE').replace(/_/g, ' ')}
              </div>
            </div>
            <div
              className="py-4 px-4"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {timeAgo(approval.createdAt)}
              {approval.dueAt && (
                <div className="mt-1 flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                  <Clock className="w-3 h-3" strokeWidth={1.5} />
                  DUE {new Date(approval.dueAt).toISOString().slice(5, 10).replace('-', '.')}
                </div>
              )}
            </div>
            <div className="py-3 px-4 flex items-center justify-end gap-2">
              <Link
                href={`/visual/${approval.comparisonId}`}
                className="vt-btn vt-btn--ghost"
                style={{ padding: '6px 10px', fontSize: '10px' }}
              >
                OPEN <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                className="vt-btn"
                style={{
                  padding: '6px 10px',
                  fontSize: '10px',
                  color: 'var(--pass)',
                  borderColor: 'color-mix(in oklab, var(--pass) 55%, var(--rule))',
                }}
                onClick={() => onApprove(approval.id)}
                disabled={pending}
              >
                <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                PASS
              </button>
              <button
                type="button"
                className="vt-btn"
                style={{
                  padding: '6px 10px',
                  fontSize: '10px',
                  color: 'var(--fail)',
                  borderColor: 'color-mix(in oklab, var(--fail) 55%, var(--rule))',
                }}
                onClick={() => onReject(approval.id)}
                disabled={pending}
              >
                <XCircle className="w-3 h-3" strokeWidth={1.5} />
                REJECT
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyDocket() {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div className="vt-kicker" style={{ color: 'var(--pass)', justifyContent: 'center' }}>
        DOCKET CLEAR
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3vw, 40px)',
          color: 'var(--ink-0)',
        }}
      >
        no pending verdicts.
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
        Everything routed has been stamped. New visual changes will land on this
        sheet the moment they arrive.
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

function RulesSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: rules, isLoading } = useQuery({
    queryKey: ['approval-rules', projectId],
    queryFn: () => approvalsApi.rules(projectId),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => approvalsApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
      toast.success('Rule deleted');
    },
  });

  if (isLoading) return <DashedFrame>loading standing orders…</DashedFrame>;

  if (!rules?.length) {
    return (
      <DashedFrame>
        no standing orders on file — every change falls to manual review.
      </DashedFrame>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      <div
        className="grid grid-cols-[70px_1fr_120px_48px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['PRIO', 'RULE', 'MODE', ''].map((h, i) => (
          <div
            key={i}
            className="py-3 px-4"
            style={{ borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}
          >
            {h}
          </div>
        ))}
      </div>
      {rules.map((rule: any, i: number) => (
        <div
          key={rule.id}
          className="grid grid-cols-[70px_1fr_120px_48px] gap-0"
          style={{
            borderBottom: i < rules.length - 1 ? '1px solid var(--rule-soft)' : 'none',
          }}
        >
          <div
            className="py-3 px-4 vt-mono"
            style={{
              borderRight: '1px solid var(--rule-soft)',
              fontSize: '10.5px',
              letterSpacing: '0.12em',
              color: 'var(--accent)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            P-{String(rule.priority).padStart(2, '0')}
          </div>
          <div className="py-3 px-4 min-w-0" style={{ borderRight: '1px solid var(--rule-soft)' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '15px',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                lineHeight: 1.15,
              }}
              className="truncate"
            >
              {rule.name}
            </div>
            <div
              className="mt-1 vt-mono"
              style={{
                fontSize: '10px',
                letterSpacing: '0.1em',
                color: 'var(--ink-2)',
                textTransform: 'uppercase',
              }}
            >
              route → {rule.routeType}: {rule.routeTo}
            </div>
          </div>
          <div className="py-3 px-4 flex items-center" style={{ borderRight: '1px solid var(--rule-soft)' }}>
            <span
              className={`vt-chip ${rule.autoApprove ? 'vt-chip--pass' : ''}`}
              style={{ fontSize: '9.5px', padding: '3px 8px' }}
            >
              {rule.autoApprove ? 'AUTO' : 'MANUAL'}
            </span>
          </div>
          <div className="py-3 px-2 flex items-center justify-center">
            <button
              type="button"
              className="vt-btn vt-btn--ghost"
              style={{
                padding: '6px 8px',
                color: 'var(--fail)',
              }}
              onClick={() => deleteRuleMutation.mutate(rule.id)}
              aria-label="Delete rule"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetaRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'pass' | 'fail' | 'warn' }) {
  const color =
    tone === 'pass' ? 'var(--pass)' : tone === 'fail' ? 'var(--fail)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-0)';
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
      <span>SHEET 06 · TRIBUNAL · {projectName}</span>
      <span>CHECKED · {(slug || 'VT').toUpperCase()}</span>
      <span>VERDICT BINDS — NO APPEAL</span>
    </footer>
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
