'use client';

// Fixes — Sheet 09 · Case files.
// Each auto-fix candidate is a folder on the desk. Open cases show
// prominently at top; the rest file below. Sections on the individual
// case page follow the §01 observation / §02 patch / §03 verify / §04
// PR convention; here we preview that structure in the row itself.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  GitMerge,
  Loader2,
  Eye,
  ArrowRight,
} from 'lucide-react';

interface BugCandidate {
  id: string;
  title: string;
  plainLanguageSummary: string | null;
  failureType: string;
  severity: string;
  confidenceScore: number;
  riskScore: number;
  status: string;
  classification: string;
  branch: string | null;
  createdByMode: string;
  createdAt: string;
  updatedAt: string;
  fixSessions?: { id: string; status: string; mode: string; confidenceScore: number | null }[];
  _count?: { fixSessions: number; analyses: number };
}

// Open vs closed classification for the case file split
const OPEN_STATUSES = new Set([
  'NEW',
  'TRIAGING',
  'INVESTIGATING',
  'AWAITING_APPROVAL',
  'APPLYING',
  'VERIFYING',
  'READY',
]);

const STATUS_META: Record<string, { icon: typeof Clock; tone: string }> = {
  NEW: { icon: Clock, tone: 'var(--accent)' },
  TRIAGING: { icon: Search, tone: 'var(--accent)' },
  INVESTIGATING: { icon: Eye, tone: 'var(--warn)' },
  AWAITING_APPROVAL: { icon: AlertTriangle, tone: 'var(--warn)' },
  APPLYING: { icon: Loader2, tone: 'var(--accent)' },
  VERIFYING: { icon: Loader2, tone: 'var(--accent)' },
  READY: { icon: CheckCircle2, tone: 'var(--pass)' },
  MERGED: { icon: GitMerge, tone: 'var(--pass)' },
  DISMISSED: { icon: XCircle, tone: 'var(--ink-2)' },
};

function severityChip(sev: string): string {
  const u = sev.toUpperCase();
  if (u === 'CRITICAL' || u === 'HIGH') return 'vt-chip vt-chip--fail';
  if (u === 'MEDIUM') return 'vt-chip vt-chip--warn';
  return 'vt-chip';
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

export default function FixesInboxPage() {
  const { project: currentProject } = useCurrentProject();
  const [candidates, setCandidates] = useState<BugCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadCandidates();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, statusFilter]);

  async function loadCandidates() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentProject?.id) params.projectId = currentProject.id;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.get<{ data: BugCandidate[] }>('/fixes/candidates', params);
      setCandidates((data as any) || []);
    } catch (error) {
      console.error('Failed to load bug candidates:', error);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const params: Record<string, string> = {};
      if (currentProject?.id) params.projectId = currentProject.id;
      const data = await api.get('/fixes/stats', params);
      setStats(data);
    } catch (error) {
      console.error('Failed to load fix stats:', error);
    }
  }

  const filtered = candidates.filter((c) =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const openCases = filtered.filter((c) => OPEN_STATUSES.has(c.status));
  const closedCases = filtered.filter((c) => !OPEN_STATUSES.has(c.status));

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const openCount = stats?.openCandidates ?? openCases.length;

  if (!currentProject) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
          Pick a <em>project</em> — then the case files open.
        </h1>
      </VtStage>
    );
  }

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`09 / 12`}
        eyebrow={`§ 09 · CASEFILES`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            every failure is a <em>case</em>.
          </>
        }
        lead="A classifier reads each failure, opens a candidate file, and hands it to an investigator. Review, approve, or dismiss — the machine does the typing."
      >
        {/* Figure plate — open case count */}
        <section aria-labelledby="cover-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="cover-head">docket cover</span>
            <span className="rule" />
            <span className="stamp">FIG. 1 · CASELOAD</span>
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
                OPEN · ON THE DESK · {isoDate}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontVariationSettings: '"opsz" 144',
                  fontWeight: 300,
                  fontSize: 'clamp(96px, 12vw, 180px)',
                  lineHeight: 0.88,
                  letterSpacing: '-0.04em',
                  color: openCount > 0 ? 'var(--fail)' : 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(openCount).padStart(2, '0')}
              </div>
              <div
                className="mt-4 vt-kicker"
                style={{ color: openCount > 0 ? 'var(--fail)' : 'var(--ink-2)' }}
              >
                {openCount === 1 ? 'open case' : 'open cases'}
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
                DETAIL A · DESK META
              </div>
              <dl className="m-0 space-y-3">
                <MetaRow
                  k="READY"
                  v={String(stats?.highConfidenceReady ?? 0).padStart(2, '0')}
                  tone="pass"
                />
                <MetaRow
                  k="AUTO-FIX"
                  v={`${stats?.autoFixSuccessRate ?? 0}%`}
                />
                <MetaRow
                  k="CLOSED · 7D"
                  v={String(stats?.recentFixes ?? 0).padStart(2, '0')}
                />
                <MetaRow k="SCAN RATE" v="CONTINUOUS" />
              </dl>
            </aside>
          </div>
        </section>

        {/* Filters strip */}
        <section aria-label="filter">
          <div
            className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-0"
            style={{ border: '1px solid var(--rule)' }}
          >
            <label className="relative block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                strokeWidth={1.5}
                style={{ color: 'var(--ink-2)' }}
              />
              <input
                type="text"
                className="vt-input"
                placeholder="SEARCH CASEFILES…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', border: 'none' }}
              />
            </label>
            <select
              className="vt-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ border: 'none', borderLeft: '1px solid var(--rule)' }}
            >
              <option value="all">ALL STATUSES</option>
              <option value="NEW">NEW</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="AWAITING_APPROVAL">AWAITING APPROVAL</option>
              <option value="READY">READY</option>
              <option value="MERGED">MERGED</option>
              <option value="DISMISSED">DISMISSED</option>
            </select>
          </div>
        </section>

        {/* §02 — open cases */}
        <section aria-labelledby="open-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="open-head">open cases</span>
            <span className="rule" />
            <span className="stamp">
              {loading ? 'LOADING…' : openCases.length === 0 ? 'NIL · DESK CLEAR' : `${openCases.length} ON DESK`}
            </span>
          </div>

          {loading ? (
            <DashedFrame>pulling case files…</DashedFrame>
          ) : openCases.length === 0 ? (
            <EmptyDesk label="no open cases" copy="Investigators are idle. New failures will open files here automatically." />
          ) : (
            <CaseTable cases={openCases} emphasis />
          )}
        </section>

        {/* §03 — archive (closed) */}
        {!loading && closedCases.length > 0 && (
          <section aria-labelledby="archive-head">
            <div className="vt-section-head">
              <span className="num">§ 03</span>
              <span className="ttl" id="archive-head">archive</span>
              <span className="rule" />
              <span className="stamp">{closedCases.length} CLOSED</span>
            </div>
            <CaseTable cases={closedCases} />
          </section>
        )}

        <Colophon projectName={currentProject.name} slug={currentProject.slug} />
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────── primitives ── */

function CaseTable({
  cases,
  emphasis,
}: {
  cases: BugCandidate[];
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${emphasis ? 'var(--rule-strong)' : 'var(--rule)'}`,
        background: emphasis
          ? 'color-mix(in oklab, var(--bg-1) 40%, transparent)'
          : 'color-mix(in oklab, var(--bg-1) 20%, transparent)',
      }}
    >
      {/* header row */}
      <div
        className="grid grid-cols-[110px_1fr_110px_110px_120px_80px] gap-0"
        style={{
          borderBottom: '1px solid var(--rule-strong)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {['CASE', 'SUBJECT', 'SEVERITY', 'STATUS', 'FILED', ''].map((h, i) => (
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
      {cases.map((c, i) => {
        const meta = STATUS_META[c.status] ?? STATUS_META.NEW;
        const Icon = meta.icon;
        const latestSession = c.fixSessions?.[0];
        const spin = c.status === 'APPLYING' || c.status === 'VERIFYING';
        return (
          <Link
            key={c.id}
            href={`/fixes/${c.id}`}
            className="grid grid-cols-[110px_1fr_110px_110px_120px_80px] gap-0 group"
            style={{
              borderBottom: i < cases.length - 1 ? '1px solid var(--rule-soft)' : 'none',
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
              className="py-4 px-4 vt-mono"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontSize: '10.5px',
                letterSpacing: '0.14em',
                color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              C-{c.id.slice(0, 6).toUpperCase()}
            </div>
            <div
              className="py-4 px-4 min-w-0"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={`w-3.5 h-3.5 flex-shrink-0 ${spin ? 'animate-spin' : ''}`}
                  strokeWidth={1.5}
                  style={{ color: meta.tone }}
                />
                <span
                  className="truncate group-hover:text-[color:var(--accent)] transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '17px',
                    color: 'var(--ink-0)',
                    textTransform: 'lowercase',
                    lineHeight: 1.15,
                  }}
                >
                  {c.title}
                </span>
              </div>
              {c.plainLanguageSummary && (
                <p
                  className="mt-1 truncate"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12.5px',
                    color: 'var(--ink-2)',
                    lineHeight: 1.4,
                  }}
                >
                  {c.plainLanguageSummary}
                </p>
              )}
              <div
                className="mt-2 flex flex-wrap items-center gap-2 vt-mono"
                style={{
                  fontSize: '9.5px',
                  letterSpacing: '0.14em',
                  color: 'var(--ink-2)',
                  textTransform: 'uppercase',
                }}
              >
                <span>{c.failureType.replace(/_/g, ' ')}</span>
                {c.classification !== 'UNCLASSIFIED' && (
                  <>
                    <span>·</span>
                    <span>{c.classification.replace(/_/g, ' ')}</span>
                  </>
                )}
                {c.branch && (
                  <>
                    <span>·</span>
                    <span style={{ color: 'var(--ink-1)' }}>{c.branch}</span>
                  </>
                )}
                <span>·</span>
                <span>
                  CONF {Math.round(c.confidenceScore * 100)}%
                </span>
                {latestSession && (
                  <>
                    <span>·</span>
                    <span>SESSION {latestSession.mode.replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
            </div>
            <div
              className="py-4 px-4 flex items-center"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <span className={severityChip(c.severity)} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                {c.severity}
              </span>
            </div>
            <div
              className="py-4 px-4 flex items-center"
              style={{ borderRight: '1px solid var(--rule-soft)' }}
            >
              <span
                className="vt-chip"
                style={{
                  fontSize: '9.5px',
                  padding: '3px 8px',
                  color: meta.tone,
                  borderColor: 'color-mix(in oklab, var(--rule-strong) 80%, transparent)',
                }}
              >
                {c.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div
              className="py-4 px-4 vt-mono"
              style={{
                borderRight: '1px solid var(--rule-soft)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {timeAgo(c.createdAt)}
            </div>
            <div className="py-4 px-4 flex items-center justify-end">
              <ArrowRight
                className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                strokeWidth={1.5}
                style={{ color: 'var(--ink-2)' }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyDesk({ label, copy }: { label: string; copy: string }) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div className="vt-kicker" style={{ color: 'var(--pass)', justifyContent: 'center' }}>
        {label.toUpperCase()}
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3vw, 40px)',
          color: 'var(--ink-0)',
        }}
      >
        desk clear.
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
        {copy}
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
      <span>SHEET 09 · CASEFILES · {projectName}</span>
      <span>CHECKED · {(slug || 'VT').toUpperCase()}</span>
      <span>FIRST RESPONDER IS A CLASSIFIER</span>
    </footer>
  );
}
