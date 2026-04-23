'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { useCurrentProject } from '@/hooks/useProject';
import { visualApi, getApiBaseUrl, type VisualComparison } from '@/lib/api';

// Status → stamp copy. Kept in one place so the list row and the filter chips
// agree about what to call each state.
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  AUTO_APPROVED: 'AUTO · APPROVED',
  REJECTED: 'REJECTED',
  ESCALATED: 'ESCALATED',
  CHANGED: 'CHANGED',
};

const STATUS_CHIP: Record<string, string> = {
  PENDING: 'vt-chip--warn',
  APPROVED: 'vt-chip--pass',
  AUTO_APPROVED: 'vt-chip--pass',
  REJECTED: 'vt-chip--fail',
  ESCALATED: 'vt-chip--accent',
  CHANGED: 'vt-chip--accent',
};

function screenshotProxyUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith('/api/') || rawUrl.startsWith('http')) return rawUrl;
  return `${getApiBaseUrl()}/screenshots/${rawUrl}`;
}

function baselineThumb(c: VisualComparison): string | undefined {
  if (c.baselineUrl) return c.baselineUrl;
  if (c.baseline?.url) return screenshotProxyUrl(c.baseline.url);
  const screenshots = c.baseline?.screenshots as unknown;
  if (screenshots) {
    const arr = typeof screenshots === 'string' ? JSON.parse(screenshots) : screenshots;
    if (Array.isArray(arr) && arr.length > 0) {
      const name = c.screenshot?.name;
      const match = name ? arr.find((s: any) => s.name === name) : arr[0];
      return screenshotProxyUrl((match || arr[0]).url);
    }
  }
  return undefined;
}

// A pending diff in the review room is a redline waiting for a verdict.
// Rendered as a wide ruled row — thumbnails on the left, title + delta in the
// middle, actions on the right. No rounded corners, no shadows.
function RedlineRow({
  comparison,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  comparison: VisualComparison;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const status = (comparison.status || 'PENDING').toUpperCase();
  const baseUrl = baselineThumb(comparison);
  const curUrl = comparison.currentUrl || screenshotProxyUrl(comparison.screenshot?.url);
  const name = comparison.screenshot?.name || (comparison.metadata as any)?.screenshotName || '';
  const displayName =
    name.replace(/-/g, ' ').replace(/\.(png|jpg|jpeg)$/i, '').toLowerCase() ||
    `#${comparison.id.slice(0, 8)}`;
  const delta = (comparison.diffPercentage ?? comparison.diffScore ?? 0) as number;
  const updated = comparison.createdAt ? new Date(comparison.createdAt) : null;
  const stamp = updated
    ? updated.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : '—';
  const idShort = comparison.id.slice(0, 8);
  const executionShort = (comparison.executionId || '').slice(0, 8);
  const pending = status === 'PENDING' || status === 'CHANGED';

  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: '48px 132px 1fr 140px 220px 260px',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      {/* Index diamond */}
      <div
        className="vt-mono flex items-center justify-center"
        style={{
          height: '108px',
          borderRight: '1px solid var(--rule-soft)',
          color: 'var(--ink-2)',
          fontSize: '10px',
          letterSpacing: '0.16em',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            border: '1px solid var(--accent)',
            transform: 'rotate(45deg)',
            display: 'inline-block',
          }}
          aria-hidden
        />
      </div>

      {/* Thumbnail pair — baseline + candidate, tiny so it reads as a marker */}
      <Link
        href={`/visual/${comparison.id}`}
        className="flex items-stretch gap-1 px-3"
        style={{ height: '108px', borderRight: '1px solid var(--rule-soft)' }}
        aria-label={`Open redline for ${displayName}`}
      >
        <div
          className="flex-1 relative overflow-hidden"
          style={{ border: '1px solid var(--rule)', background: 'var(--bg-2)' }}
        >
          {baseUrl ? (
            <img
              src={baseUrl}
              alt=""
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
          ) : null}
          <span
            className="absolute top-0 left-0 vt-mono"
            style={{
              fontSize: '7.5px',
              letterSpacing: '0.2em',
              color: 'var(--ink-2)',
              padding: '1px 4px',
              background: 'color-mix(in oklab, var(--bg-0) 80%, transparent)',
              textTransform: 'uppercase',
            }}
          >
            A
          </span>
        </div>
        <div
          className="flex-1 relative overflow-hidden"
          style={{
            border: '1px solid var(--rule)',
            background: 'var(--bg-2)',
            outline: pending ? '1px dashed var(--accent)' : 'none',
            outlineOffset: '-2px',
          }}
        >
          {curUrl ? (
            <img
              src={curUrl}
              alt=""
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
          ) : null}
          <span
            className="absolute top-0 left-0 vt-mono"
            style={{
              fontSize: '7.5px',
              letterSpacing: '0.2em',
              color: pending ? 'var(--accent)' : 'var(--ink-2)',
              padding: '1px 4px',
              background: 'color-mix(in oklab, var(--bg-0) 80%, transparent)',
              textTransform: 'uppercase',
            }}
          >
            B
          </span>
        </div>
      </Link>

      {/* Name + status stamp */}
      <div className="px-5 py-4" style={{ borderRight: '1px solid var(--rule-soft)' }}>
        <Link href={`/visual/${comparison.id}`} className="block">
          <div
            className="vt-display"
            style={{
              fontSize: '22px',
              lineHeight: 1.05,
              color: 'var(--ink-0)',
              marginBottom: '6px',
            }}
          >
            {displayName}
          </div>
          <div
            className="vt-mono flex items-center gap-3 flex-wrap"
            style={{
              fontSize: '9.5px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <span>CMP · {idShort}</span>
            {executionShort && <span>RUN · {executionShort}</span>}
            {comparison.baseline?.branch && (
              <span style={{ color: 'var(--ink-2)' }}>
                BR · {comparison.baseline.branch}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Delta — mono, tabular, big */}
      <div
        className="px-5 py-4 text-right"
        style={{ borderRight: '1px solid var(--rule-soft)' }}
      >
        <div
          className="vt-mono"
          style={{
            fontSize: '22px',
            letterSpacing: '0.02em',
            color:
              delta > 5 ? 'var(--fail)' : delta > 1 ? 'var(--accent)' : 'var(--pass)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Δ&nbsp;{delta.toFixed(2)}
          <span
            style={{
              fontSize: '11px',
              color: 'var(--ink-2)',
              letterSpacing: '0.18em',
              marginLeft: '4px',
            }}
          >
            %
          </span>
        </div>
        <div
          className="vt-mono mt-1"
          style={{
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          PIXEL · DELTA
        </div>
      </div>

      {/* Timestamp + status */}
      <div
        className="px-5 py-4"
        style={{ borderRight: '1px solid var(--rule-soft)' }}
      >
        <div
          className="vt-mono"
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.14em',
            color: 'var(--ink-1)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {stamp}
        </div>
        <div className="mt-2">
          <span
            className={`vt-chip ${STATUS_CHIP[status] || ''}`}
            style={{ fontSize: '9.5px' }}
          >
            {STATUS_LABEL[status] || status}
          </span>
        </div>
      </div>

      {/* Verdict actions */}
      <div className="px-5 py-4 flex items-center justify-end gap-2">
        {pending ? (
          <>
            <button
              type="button"
              onClick={() => onReject(comparison.id)}
              disabled={rejecting}
              className="vt-btn"
              style={{
                padding: '8px 14px',
                fontSize: '10.5px',
                borderColor: 'var(--fail)',
                color: 'var(--fail)',
              }}
              aria-label={`Reject ${displayName}`}
            >
              <X className="w-3 h-3" strokeWidth={1.5} />
              REJECT
            </button>
            <button
              type="button"
              onClick={() => onApprove(comparison.id)}
              disabled={approving}
              className="vt-btn vt-btn--primary"
              style={{ padding: '8px 14px', fontSize: '10.5px' }}
              aria-label={`Approve ${displayName}`}
            >
              <Check className="w-3 h-3" strokeWidth={1.5} />
              APPROVE
            </button>
          </>
        ) : (
          <Link
            href={`/visual/${comparison.id}`}
            className="vt-btn"
            style={{ padding: '8px 14px', fontSize: '10.5px' }}
          >
            OPEN SHEET
          </Link>
        )}
      </div>
    </div>
  );
}

export default function VisualPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  // Filter strip state — all five ruled filters live in a single object so the
  // query key stays stable and filter pills can be reset at once.
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [ageFilter, setAgeFilter] = useState<'ALL' | '24H' | '7D'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'PIXEL' | 'AI'>('ALL');

  const { data: comparisons, isLoading } = useQuery({
    queryKey: ['visual', project?.id, { status: statusFilter }],
    queryFn: () =>
      visualApi.list(project!.id, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    enabled: !!project?.id,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      visualApi.approve(project!.id, id, { updateBaseline: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visual'] });
      toast.success('Redline approved — baseline updated');
    },
    onError: (e: any) => toast.error(e.message || 'Approve failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      visualApi.reject(project!.id, id, 'Rejected from review room'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visual'] });
      toast.success('Redline rejected');
    },
    onError: (e: any) => toast.error(e.message || 'Reject failed'),
  });

  const rawData = comparisons as any;
  const comparisonList: VisualComparison[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data)
    ? rawData.data
    : [];
  const allForProject = comparisonList.filter((c) => c && c.id);

  // Client-side age filter since the API doesn't accept one directly.
  const nowMs = Date.now();
  const filtered = allForProject.filter((c) => {
    if (!c.createdAt) return true;
    const ageMs = nowMs - new Date(c.createdAt).getTime();
    if (ageFilter === '24H') return ageMs <= 24 * 60 * 60 * 1000;
    if (ageFilter === '7D') return ageMs <= 7 * 24 * 60 * 60 * 1000;
    return true;
  });

  // The pending count is what the reviewer acts on. Treat it like a focus
  // plate — a giant tabular numeral surrounded by dimension callouts.
  const pendingCount = allForProject.filter(
    (c) => c.status === 'PENDING' || c.status === 'CHANGED',
  ).length;
  const approvedToday = allForProject.filter(
    (c) =>
      (c.status === 'APPROVED' || c.status === 'AUTO_APPROVED') &&
      c.createdAt &&
      nowMs - new Date(c.createdAt).getTime() <= 24 * 60 * 60 * 1000,
  ).length;
  const rejectedToday = allForProject.filter(
    (c) =>
      c.status === 'REJECTED' &&
      c.createdAt &&
      nowMs - new Date(c.createdAt).getTime() <= 24 * 60 * 60 * 1000,
  ).length;

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <EditorialHero
      sheet="VIS · 04 · REVIEW"
      eyebrow="§ REDLINE ROOM"
      revision={<>REV · {isoDate}</>}
      title={
        <>
          pending <em>redlines</em>
          <br />
          awaiting verdict.
        </>
      }
      lead={
        <>
          Every differing frame is plated here before it ships. Approve to publish
          the new baseline, reject to hold the revision. Keyboard shortcuts{' '}
          <span className="vt-mono" style={{ color: 'var(--ink-0)' }}>
            A
          </span>{' '}
          and{' '}
          <span className="vt-mono" style={{ color: 'var(--ink-0)' }}>
            R
          </span>{' '}
          work inside an individual sheet.
        </>
      }
      width="wide"
    >
      {/* FOCUS PLATE — pending count as the signature moment. */}
      <section
        aria-label="Pending redlines summary"
        style={{
          border: '1px solid var(--rule-strong)',
          background: 'color-mix(in oklab, var(--bg-1) 50%, transparent)',
          padding: '40px 48px',
        }}
      >
        <div
          className="flex justify-between items-center pb-3 mb-6"
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
          <span>FIG. 01 · PENDING / AWAITING VERDICT</span>
          <span>ORTHOGRAPHIC · 1:1</span>
        </div>

        <div
          className="grid gap-10 items-center"
          style={{ gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 2fr)' }}
        >
          {/* The number itself */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(120px, 16vw, 220px)',
                lineHeight: 0.82,
                letterSpacing: '-0.04em',
                color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'center',
              }}
            >
              {String(pendingCount).padStart(2, '0')}
            </div>
            <div className="vt-dim-h mt-4" aria-hidden>
              <span className="tick-l" />
              <span className="tick-r" />
              <span className="v">IN REVIEW</span>
            </div>
            <div
              className="vt-mono mt-3 text-center"
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-2)',
              }}
            >
              {pendingCount === 0 ? '◇ ALL CLEAR' : '◇ AWAITING VERDICT'}
            </div>
          </div>

          {/* Ledger — approved / rejected / total */}
          <div className="grid grid-cols-3" style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
            {[
              {
                k: 'APPROVED · 24H',
                v: approvedToday,
                tone: 'var(--pass)',
                sub: 'accepted into baseline',
              },
              {
                k: 'REJECTED · 24H',
                v: rejectedToday,
                tone: 'var(--fail)',
                sub: 'held for revision',
              },
              {
                k: 'TOTAL · TRACKED',
                v: allForProject.length,
                tone: 'var(--ink-1)',
                sub: 'across project',
              },
            ].map((x, i) => (
              <div
                key={x.k}
                className="py-5 px-5"
                style={{
                  borderRight: i < 2 ? '1px solid var(--rule-soft)' : 'none',
                }}
              >
                <div
                  className="vt-mono"
                  style={{
                    fontSize: '9px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                    marginBottom: '8px',
                  }}
                >
                  {x.k}
                </div>
                <div
                  className="vt-mono"
                  style={{
                    fontSize: '36px',
                    color: x.tone,
                    letterSpacing: '0.02em',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {String(x.v).padStart(2, '0')}
                </div>
                <div
                  className="vt-mono mt-2"
                  style={{
                    fontSize: '9px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  {x.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FILTER STRIP — one ruled row, five cells. */}
      <section aria-label="Filters">
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr',
            border: '1px solid var(--rule-strong)',
            borderBottom: 'none',
          }}
        >
          <div
            className="vt-mono flex items-center gap-2 px-5"
            style={{
              height: '48px',
              borderRight: '1px solid var(--rule)',
              fontSize: '10px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Filter className="w-3 h-3" strokeWidth={1.5} />
            FILTER · SET
          </div>

          {/* Project cell (read-only indicator) */}
          <div
            className="px-5 py-2"
            style={{ borderRight: '1px solid var(--rule-soft)' }}
          >
            <div
              className="vt-mono"
              style={{
                fontSize: '9px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                marginBottom: '2px',
              }}
            >
              PROJECT
            </div>
            <div
              className="vt-display"
              style={{ fontSize: '14px', color: 'var(--ink-0)' }}
            >
              {project?.name ? project.name.toLowerCase() : '—'}
            </div>
          </div>

          {/* Mode pills */}
          <FilterCell label="MODE">
            {(['ALL', 'PIXEL', 'AI'] as const).map((m) => (
              <FilterPill
                key={m}
                active={modeFilter === m}
                onClick={() => setModeFilter(m)}
                label={m}
              />
            ))}
          </FilterCell>

          {/* Age pills */}
          <FilterCell label="AGE">
            {(['ALL', '24H', '7D'] as const).map((a) => (
              <FilterPill
                key={a}
                active={ageFilter === a}
                onClick={() => setAgeFilter(a)}
                label={a}
              />
            ))}
          </FilterCell>

          {/* Status pills — render on its own full-width row below */}
          <FilterCell label="STATUS" last>
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <FilterPill
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                label={s}
              />
            ))}
          </FilterCell>
        </div>

        {/* The list itself — rules, no cards. */}
        <div
          style={{
            border: '1px solid var(--rule-strong)',
            background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
          }}
        >
          {isLoading ? (
            <div
              className="vt-mono text-center py-16"
              style={{
                fontSize: '11px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              LOADING REDLINES…
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="text-center py-20"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--ink-2)',
              }}
            >
              <div className="vt-display" style={{ fontSize: '28px', marginBottom: '8px' }}>
                no pending redlines.
              </div>
              <div
                className="vt-mono"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {statusFilter === 'PENDING'
                  ? '◇ BASELINE IS CURRENT'
                  : '◇ NO MATCHES FOR FILTER SET'}
              </div>
            </div>
          ) : (
            <div role="list" aria-label="Redline queue">
              {filtered.map((c) => (
                <div key={c.id} role="listitem">
                  <RedlineRow
                    comparison={c}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onReject={(id) => rejectMutation.mutate(id)}
                    approving={approveMutation.isPending}
                    rejecting={rejectMutation.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </EditorialHero>
  );
}

function FilterCell({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="px-5 py-2"
      style={{ borderRight: last ? 'none' : '1px solid var(--rule-soft)' }}
    >
      <div
        className="vt-mono"
        style={{
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginBottom: '4px',
        }}
      >
        {label}
      </div>
      <div className="flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="vt-mono"
      style={{
        padding: '4px 9px',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--rule)',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--ink-1)',
        fontSize: '9.5px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
