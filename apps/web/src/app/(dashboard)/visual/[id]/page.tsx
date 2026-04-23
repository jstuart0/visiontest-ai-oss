'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X, Flag, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { useCurrentProject } from '@/hooks/useProject';
import { api, visualApi, getApiBaseUrl, type VisualComparison } from '@/lib/api';

function screenshotProxyUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith('/api/') || rawUrl.startsWith('http')) return rawUrl;
  return `${getApiBaseUrl()}/screenshots/${rawUrl}`;
}

// Tiny sub-component so the three plates stay structurally identical and
// the diff against the proof stays legible.
function Plate({
  letter,           // "A" | "B" | "C"
  stamp,            // top-right stamp label
  stampTone,        // 'chalk' | 'accent' | 'reject'
  titleLeft,        // "PLATE 03-A · baseline"
  titleRight,       // right-side mini-tb text
  imageUrl,
  imageAlt,
  footer,           // [{k, v}, ...]
  children,         // optional overlay (leader layer)
}: {
  letter: string;
  stamp: string;
  stampTone: 'chalk' | 'accent' | 'reject';
  titleLeft: string;
  titleRight: string;
  imageUrl?: string;
  imageAlt: string;
  footer: Array<{ k: string; v: string }>;
  children?: React.ReactNode;
}) {
  const toneColor =
    stampTone === 'accent'
      ? 'var(--accent)'
      : stampTone === 'reject'
      ? 'var(--fail)'
      : 'var(--ink-1)';

  return (
    <div
      className="relative"
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 55%, transparent)',
        padding: '14px 16px 18px',
      }}
    >
      {/* Top-right sheet stamp */}
      <div
        className="absolute"
        style={{
          top: '-12px',
          right: '12px',
          background: 'var(--bg-0)',
          padding: '0 8px',
        }}
      >
        <span
          className="vt-mono inline-flex items-center gap-2"
          style={{
            border: `1px solid ${toneColor}`,
            color: toneColor,
            background:
              stampTone === 'reject'
                ? 'var(--fail-soft)'
                : stampTone === 'accent'
                ? 'var(--accent-soft)'
                : 'var(--bg-0)',
            padding: '4px 10px',
            fontSize: '9.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              border: `1px solid ${toneColor}`,
              transform: 'rotate(45deg)',
              display: 'inline-block',
            }}
            aria-hidden
          />
          {stamp}
        </span>
      </div>

      {/* Mini title block */}
      <div
        className="flex justify-between items-center pb-2 mb-3"
        style={{
          borderBottom: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{titleLeft}</span>
        <span>{titleRight}</span>
      </div>

      {/* Stage — 4:3 grid-paper, image contained inside. */}
      <div
        className="relative"
        style={{
          aspectRatio: '4 / 3',
          border: '1px solid var(--rule)',
          backgroundImage: `
            linear-gradient(to right, var(--rule-soft) 1px, transparent 1px),
            linear-gradient(to bottom, var(--rule-soft) 1px, transparent 1px)
          `,
          backgroundSize: '16px 16px, 16px 16px',
          backgroundColor: 'var(--bg-3)',
          overflow: 'hidden',
        }}
      >
        {/* Plate letter in the corner — reads as a figure marker */}
        <span
          className="vt-mono absolute z-10"
          style={{
            top: '8px',
            left: '8px',
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: toneColor,
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          FIG · {letter}
        </span>

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-contain"
            style={{ background: 'var(--bg-3)' }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center vt-mono"
            style={{
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            NO PLATE CAPTURED
          </div>
        )}

        {children}
      </div>

      {/* Footer — ruled key/value grid */}
      <div
        className="grid mt-3"
        style={{
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {footer.map((row, i) => (
          <div
            key={`${row.k}-${i}`}
            className="flex justify-between"
            style={{
              borderBottom: '1px dotted var(--rule-soft)',
              paddingBottom: '3px',
            }}
          >
            <span style={{ color: 'var(--ink-2)' }}>{row.k}</span>
            <span style={{ color: 'var(--ink-1)' }}>{row.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VisualDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: comparisonId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const { data: comparison, isLoading } = useQuery({
    queryKey: ['visual', project?.id, comparisonId],
    queryFn: () => visualApi.get(project!.id, comparisonId),
    enabled: !!project?.id,
  });

  const { data: allComparisons } = useQuery({
    queryKey: ['visual', project?.id],
    queryFn: () => visualApi.list(project!.id),
    enabled: !!project?.id,
  });

  const comparisonIndex =
    (allComparisons as any)?.findIndex?.((c: any) => c.id === comparisonId) ?? -1;
  const prevComparison =
    comparisonIndex > 0 ? (allComparisons as any)?.[comparisonIndex - 1] : null;
  const nextComparison =
    allComparisons && comparisonIndex < (allComparisons as any).length - 1
      ? (allComparisons as any)[comparisonIndex + 1]
      : null;

  const approveMutation = useMutation({
    // Pass updateBaseline so the baseline image actually moves to match
    // the approved screenshot — otherwise the toast lies and a repeat
    // of the same test would flag the same "diff" again.
    mutationFn: () =>
      visualApi.approve(project!.id, comparisonId, { updateBaseline: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['visual', project?.id, comparisonId],
      });
      queryClient.invalidateQueries({ queryKey: ['visual', project?.id] });
      toast.success('Redline approved — baseline updated');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to approve redline');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      visualApi.reject(project!.id, comparisonId, 'Rejected via UI'),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['visual', project?.id, comparisonId],
      });
      queryClient.invalidateQueries({ queryKey: ['visual', project?.id] });
      toast.success('Redline rejected');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to reject redline');
    },
  });

  // Keyboard shortcuts: ←/→ for navigation, A approve, R reject
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'ArrowLeft' && prevComparison)
        router.push(`/visual/${prevComparison.id}`);
      if (e.key === 'ArrowRight' && nextComparison)
        router.push(`/visual/${nextComparison.id}`);
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) approveMutation.mutate();
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) rejectMutation.mutate();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevComparison, nextComparison, router, approveMutation, rejectMutation]);

  if (isLoading) {
    return (
      <EditorialHero
        eyebrow="§ LOADING"
        title="retrieving redline…"
        back={{ href: '/visual', label: 'BACK TO REVIEW ROOM' }}
      >
        <div
          className="vt-mono text-center py-16"
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          FETCHING PLATE SET…
        </div>
      </EditorialHero>
    );
  }

  if (!comparison) {
    return (
      <EditorialHero
        eyebrow="§ NOT FOUND"
        title="redline not found"
        back={{ href: '/visual', label: 'BACK TO REVIEW ROOM' }}
      >
        <div
          className="text-center py-16"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--ink-2)',
          }}
        >
          <div
            className="vt-display"
            style={{ fontSize: '28px', marginBottom: '12px' }}
          >
            no plate at this address.
          </div>
          <button
            type="button"
            onClick={() => router.push('/visual')}
            className="vt-btn"
          >
            RETURN TO REDLINES
          </button>
        </div>
      </EditorialHero>
    );
  }

  // ---------- Derived display values ----------
  const status = (comparison.status || 'PENDING').toUpperCase();
  const isPending = status === 'PENDING' || status === 'CHANGED';

  const currentUrl =
    (comparison as VisualComparison).currentUrl ||
    screenshotProxyUrl(comparison.screenshot?.url);

  const baselineUrl = (() => {
    if ((comparison as VisualComparison).baselineUrl)
      return (comparison as VisualComparison).baselineUrl;
    if (comparison.baseline?.url) return screenshotProxyUrl(comparison.baseline.url);
    const screenshots = comparison.baseline?.screenshots as unknown;
    if (screenshots) {
      const arr =
        typeof screenshots === 'string' ? JSON.parse(screenshots) : screenshots;
      if (Array.isArray(arr) && arr.length > 0) {
        const name = comparison.screenshot?.name;
        const match = name ? arr.find((s: any) => s.name === name) : arr[0];
        return screenshotProxyUrl((match || arr[0]).url);
      }
    }
    return undefined;
  })();

  const diffUrl = comparison.diffUrl ? screenshotProxyUrl(comparison.diffUrl) : undefined;
  const diffPercentage =
    (comparison as VisualComparison).diffPercentage ?? comparison.diffScore ?? 0;

  const meta = (comparison.metadata as any) || {};
  const ssim = typeof meta.ssim === 'number' ? meta.ssim : null;
  const lpips = typeof meta.lpips === 'number' ? meta.lpips : null;
  const dinov2 = typeof meta.dinov2 === 'number' ? meta.dinov2 : null;
  const commit = meta.commit || meta.gitSha;
  const viewport =
    meta.viewport ||
    (meta.width && meta.height ? `${meta.width} × ${meta.height}` : null);
  const engine = meta.browser || meta.engine || 'CHROMIUM';
  const aiComment: string | undefined =
    meta.aiComment ||
    meta.aiSummary ||
    meta.comment ||
    (comparison.changes as any)?.comment;

  const createdAt = comparison.createdAt ? new Date(comparison.createdAt) : null;
  const captured = createdAt
    ? createdAt.toISOString().slice(11, 19) + ' UTC'
    : '—';
  const dateStr = createdAt
    ? createdAt.toISOString().slice(0, 10).replace(/-/g, ' · ')
    : '—';

  const comparisonShort = comparisonId.slice(0, 8);
  const executionShort = (comparison.executionId || '').slice(0, 8);
  const baselineBranch = comparison.baseline?.branch || 'main';
  const baselineName = comparison.baseline?.name || 'baseline';

  // Detail-A target — pull from AI region data if present, otherwise center.
  const regions: Array<{ x: number; y: number; w: number; h: number }> =
    Array.isArray((comparison.changes as any)?.regions)
      ? (comparison.changes as any).regions
      : Array.isArray(meta.regions)
      ? meta.regions
      : [];
  const biggest = regions.sort(
    (a, b) => (b.w ?? 0) * (b.h ?? 0) - (a.w ?? 0) * (a.h ?? 0),
  )[0];
  // SVG uses a 0-400 × 0-300 viewBox to match the diff-plate aspect.
  const detailA =
    biggest && typeof biggest.x === 'number'
      ? {
          cx: Math.max(40, Math.min(360, biggest.x + (biggest.w || 80) / 2)),
          cy: Math.max(40, Math.min(260, biggest.y + (biggest.h || 60) / 2)),
          r: Math.max(
            24,
            Math.min(60, Math.max(biggest.w || 60, biggest.h || 60) / 2),
          ),
        }
      : { cx: 200, cy: 150, r: 36 };

  const total = Array.isArray(allComparisons) ? allComparisons.length : 0;

  return (
    <EditorialHero
      back={{ href: '/visual', label: 'BACK · REVIEW ROOM' }}
      sheet="VIS · 04 · REDLINE"
      eyebrow={`§ CMP · ${comparisonShort}`}
      revision={
        isPending ? (
          <>PENDING · REV</>
        ) : status === 'APPROVED' || status === 'AUTO_APPROVED' ? (
          <span style={{ color: 'var(--pass)' }}>APPROVED · REV</span>
        ) : status === 'REJECTED' ? (
          <span style={{ color: 'var(--fail)' }}>REJECTED · REV</span>
        ) : (
          <>{status}</>
        )
      }
      title={
        <>
          redline <em>{baselineName.toLowerCase()}</em>
        </>
      }
      lead={
        <>
          Three plates, one verdict. Baseline left, candidate centre, AI-diff right.
          Accept to publish the candidate as the new baseline, reject to hold the
          revision, or flag as flaky if the change is noise.
        </>
      }
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          {comparisonIndex >= 0 && total > 1 && (
            <div
              className="vt-mono hidden md:flex items-center gap-3 pr-3"
              style={{
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
                borderRight: '1px solid var(--rule)',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  prevComparison && router.push(`/visual/${prevComparison.id}`)
                }
                disabled={!prevComparison}
                aria-label="Previous redline"
                className="vt-btn"
                style={{
                  padding: '6px 10px',
                  fontSize: '10px',
                  opacity: prevComparison ? 1 : 0.4,
                }}
              >
                <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
                PREV
              </button>
              <span>
                {String(comparisonIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() =>
                  nextComparison && router.push(`/visual/${nextComparison.id}`)
                }
                disabled={!nextComparison}
                aria-label="Next redline"
                className="vt-btn"
                style={{
                  padding: '6px 10px',
                  fontSize: '10px',
                  opacity: nextComparison ? 1 : 0.4,
                }}
              >
                NEXT
                <ArrowLeft
                  className="w-3 h-3"
                  strokeWidth={1.5}
                  style={{ transform: 'rotate(180deg)' }}
                />
              </button>
            </div>
          )}
        </div>
      }
    >
      {/* § 01 — TITLE BLOCK / RUN METADATA */}
      <section aria-label="Run metadata">
        <div className="vt-title-block">
          <div className="span2">
            <span className="k">COMPARISON · ID</span>
            <span className="v vt-mono">{comparisonShort}</span>
          </div>
          <div className="span2">
            <span className="k">SOURCE · RUN</span>
            <span className="v vt-mono">{executionShort || '—'}</span>
          </div>
          <div>
            <span className="k">BRANCH</span>
            <span className="v vt-mono">{baselineBranch}</span>
          </div>
          <div>
            <span className="k">CAPTURED</span>
            <span className="v vt-mono">{captured}</span>
          </div>

          <div>
            <span className="k">Δ PIXEL</span>
            <span
              className="v vt-mono"
              style={{
                color:
                  diffPercentage > 5
                    ? 'var(--fail)'
                    : diffPercentage > 1
                    ? 'var(--accent)'
                    : 'var(--pass)',
              }}
            >
              {diffPercentage.toFixed(4)}%
            </span>
          </div>
          <div>
            <span className="k">SSIM</span>
            <span className="v vt-mono">
              {ssim !== null ? ssim.toFixed(4) : '—'}
            </span>
          </div>
          <div>
            <span className="k">LPIPS</span>
            <span className="v vt-mono">
              {lpips !== null ? lpips.toFixed(4) : '—'}
            </span>
          </div>
          <div>
            <span className="k">DINOv2 · cos</span>
            <span className="v vt-mono">
              {dinov2 !== null ? dinov2.toFixed(4) : '—'}
            </span>
          </div>
          <div>
            <span className="k">MASKS</span>
            <span className="v vt-mono">
              {String(comparison.masksApplied ?? 0).padStart(2, '0')}
            </span>
          </div>
          <div>
            <span className="k">ISSUED</span>
            <span className="v vt-mono">{dateStr}</span>
          </div>
        </div>
      </section>

      {/* § 03 — DIFF SHEETS (the signature moment) */}
      <section aria-label="Plate set">
        <div className="vt-section-head">
          <span className="num">§ 03</span>
          <span className="ttl">diff sheets · plate set</span>
          <span className="rule" />
          <span className="stamp">BASELINE · CANDIDATE · Δ AI</span>
        </div>

        {/* Axis above the plate row — orientation aid. */}
        <div
          className="vt-mono hidden md:flex items-center justify-between mb-3 px-1"
          style={{
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>PLATE 03-A · baseline</span>
          <span style={{ flex: 1, height: '1px', background: 'var(--rule)', margin: '0 16px' }} />
          <span>PLATE 03-B · candidate</span>
          <span style={{ flex: 1, height: '1px', background: 'var(--rule)', margin: '0 16px' }} />
          <span>PLATE 03-C · Δ overlay</span>
        </div>

        <div
          className="grid gap-6 relative"
          style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
        >
          <Plate
            letter="A"
            stamp={`BASELINE · ${baselineBranch.slice(0, 8).toUpperCase()}`}
            stampTone="chalk"
            titleLeft="PLATE 03-A · baseline"
            titleRight={dateStr}
            imageUrl={baselineUrl}
            imageAlt="Baseline plate"
            footer={[
              { k: 'Commit', v: commit ? String(commit).slice(0, 7) : '—' },
              { k: 'Viewport', v: viewport || '—' },
              { k: 'Engine', v: String(engine).toUpperCase() },
              { k: 'Name', v: baselineName.slice(0, 22) },
            ]}
          />

          <Plate
            letter="B"
            stamp={`CANDIDATE · CMP·${comparisonShort.slice(0, 6).toUpperCase()}`}
            stampTone="accent"
            titleLeft="PLATE 03-B · candidate"
            titleRight={dateStr}
            imageUrl={currentUrl}
            imageAlt="Candidate plate"
            footer={[
              { k: 'Run', v: executionShort || '—' },
              { k: 'Viewport', v: viewport || '—' },
              { k: 'Engine', v: String(engine).toUpperCase() },
              { k: 'Captured', v: captured },
            ]}
          />

          <Plate
            letter="C"
            stamp="Δ DIFF · AI"
            stampTone="reject"
            titleLeft="PLATE 03-C · Δ overlay"
            titleRight="SSIM · LPIPS · DINOv2"
            imageUrl={diffUrl || currentUrl}
            imageAlt="AI difference plate"
            footer={[
              {
                k: 'Δ Pixel',
                v: `${diffPercentage.toFixed(2)}%`,
              },
              { k: 'SSIM', v: ssim !== null ? ssim.toFixed(4) : '—' },
              { k: 'LPIPS', v: lpips !== null ? lpips.toFixed(4) : '—' },
              { k: 'DINOv2', v: dinov2 !== null ? dinov2.toFixed(4) : '—' },
            ]}
          >
            {/* Leader layer — circle around biggest diff region + leader to
                a DETAIL A callout. Uses 400×300 viewBox (non-preserving) so
                it always fills the stage. */}
            <svg
              className="absolute inset-0 pointer-events-none"
              viewBox="0 0 400 300"
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{ width: '100%', height: '100%' }}
            >
              <circle
                cx={detailA.cx}
                cy={detailA.cy}
                r={detailA.r}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1"
              />
              <line
                x1={detailA.cx + detailA.r}
                y1={detailA.cy - detailA.r * 0.6}
                x2={detailA.cx + detailA.r + 40}
                y2={24}
                stroke="var(--accent)"
                strokeWidth="1"
              />
              <line
                x1={detailA.cx + detailA.r + 40}
                y1={24}
                x2={370}
                y2={24}
                stroke="var(--accent)"
                strokeWidth="1"
              />
              <polygon
                points={`370,24 362,20 362,28`}
                fill="var(--accent)"
              />
              <text
                x={366}
                y={18}
                textAnchor="end"
                fill="var(--accent)"
                fontFamily="var(--font-mono), monospace"
                fontSize="10"
                letterSpacing="2"
              >
                DETAIL A
              </text>
            </svg>
          </Plate>

          {/* Overlay leader layer spanning across B → C gap. The leader lives
              in page coords so it can reach between plates. */}
          <div
            className="absolute pointer-events-none"
            style={{ inset: 0 }}
            aria-hidden
          >
            <svg
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                top: '38%',
                left: 'calc(66.666% - 24px)',
                width: '48px',
                height: '24px',
              }}
            >
              <line
                x1="0"
                y1="50"
                x2="300"
                y2="50"
                stroke="var(--accent)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <polygon points="300,50 288,44 288,56" fill="var(--accent)" />
            </svg>
          </div>
        </div>
      </section>

      {/* § 04 — OBSERVATIONS */}
      <section aria-label="Observations">
        <div className="vt-section-head">
          <span className="num">§ 04</span>
          <span className="ttl">observations</span>
          <span className="rule" />
          <span className="stamp">
            {isPending ? 'AWAITING REVIEWER' : 'VERDICT ON RECORD'}
          </span>
        </div>

        <div
          className="grid gap-10"
          style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}
        >
          <div
            style={{
              border: '1px solid var(--rule)',
              background: 'color-mix(in oklab, var(--bg-1) 45%, transparent)',
              padding: '32px 36px',
              position: 'relative',
            }}
          >
            {/* Handwritten annotation — the reviewer marking up the sheet. */}
            <p
              className="vt-annotation"
              style={{
                color: diffPercentage > 5 ? 'var(--fail)' : 'var(--accent)',
                transform: 'rotate(-1.5deg)',
                marginBottom: '16px',
              }}
            >
              see detail A — color shift in CTA row
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                lineHeight: 1.65,
                color: 'var(--ink-1)',
                maxWidth: '62ch',
              }}
            >
              {aiComment ||
                (diffPercentage < 0.5
                  ? 'Candidate plate is statistically indistinguishable from the baseline. Any residual delta sits inside anti-aliasing tolerance; recommend accept and roll baseline forward.'
                  : diffPercentage < 5
                  ? `Candidate diverges from the baseline by ${diffPercentage.toFixed(
                      2,
                    )}% — a focused change clustered around DETAIL A. If the change is intentional, accept to adopt the new baseline; if not, reject and hand back to product.`
                  : `Candidate diverges from the baseline by ${diffPercentage.toFixed(
                      2,
                    )}% — material redesign likely. Review DETAIL A and related regions before accepting the new baseline.`)}
            </p>
            <div
              className="vt-mono mt-5"
              style={{
                fontSize: '9.5px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              OBSERVED · BY VISIONTEST · AI
            </div>
          </div>

          {/* Ledger — how the scores read. */}
          <div
            style={{
              border: '1px solid var(--rule)',
              background: 'color-mix(in oklab, var(--bg-2) 35%, transparent)',
            }}
          >
            {[
              {
                k: 'Δ PIXEL',
                v: `${diffPercentage.toFixed(2)}%`,
                tone:
                  diffPercentage > 5
                    ? 'var(--fail)'
                    : diffPercentage > 1
                    ? 'var(--accent)'
                    : 'var(--pass)',
              },
              {
                k: 'SSIM',
                v: ssim !== null ? ssim.toFixed(4) : '—',
                tone: 'var(--ink-0)',
              },
              {
                k: 'LPIPS',
                v: lpips !== null ? lpips.toFixed(4) : '—',
                tone: 'var(--ink-0)',
              },
              {
                k: 'DINOv2',
                v: dinov2 !== null ? dinov2.toFixed(4) : '—',
                tone: 'var(--ink-0)',
              },
            ].map((row, i, arr) => (
              <div
                key={row.k}
                className="grid items-center"
                style={{
                  gridTemplateColumns: '1fr auto',
                  padding: '14px 18px',
                  borderBottom:
                    i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                }}
              >
                <span
                  className="vt-mono"
                  style={{
                    fontSize: '9.5px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  {row.k}
                </span>
                <span
                  className="vt-mono"
                  style={{
                    fontSize: '18px',
                    color: row.tone,
                    letterSpacing: '0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* § 05 — DECISION BAR */}
      <section aria-label="Decision">
        <div className="vt-section-head">
          <span className="num">§ 05</span>
          <span className="ttl">verdict</span>
          <span className="rule" />
          <span className="stamp">SIGN THE SHEET</span>
        </div>

        <div
          className="grid items-stretch"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            border: '1px solid var(--rule-strong)',
            background: 'color-mix(in oklab, var(--bg-1) 55%, transparent)',
          }}
        >
          <div
            className="py-6 px-8"
            style={{ borderRight: '1px solid var(--rule)' }}
          >
            <div
              className="vt-mono"
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                marginBottom: '6px',
              }}
            >
              CURRENT STATE
            </div>
            <div
              className="vt-display"
              style={{ fontSize: '26px', color: 'var(--ink-0)', lineHeight: 1.1 }}
            >
              {isPending
                ? 'awaiting verdict.'
                : status === 'APPROVED' || status === 'AUTO_APPROVED'
                ? 'approved · baseline rolled forward.'
                : status === 'REJECTED'
                ? 'rejected · revision held.'
                : status.toLowerCase()}
            </div>
            <div
              className="vt-mono mt-3"
              style={{
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              SHORTCUTS ·{' '}
              <span style={{ color: 'var(--ink-0)' }}>A</span> ACCEPT ·{' '}
              <span style={{ color: 'var(--ink-0)' }}>R</span> REJECT ·{' '}
              <span style={{ color: 'var(--ink-0)' }}>←/→</span> NAV
            </div>
          </div>

          <div className="py-6 px-8 flex items-center gap-2 flex-wrap justify-end">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    api
                      .post('/fixes/candidates', {
                        projectId: project?.id,
                        comparisonId,
                        executionId: comparison.executionId,
                        sourceType: 'comparison',
                        title: `Visual regression: ${baselineName}`,
                        plainLanguageSummary: `Visual difference of ${diffPercentage.toFixed(
                          1,
                        )}% detected`,
                        failureType: 'VISUAL',
                        severity: diffPercentage > 20 ? 'HIGH' : 'MEDIUM',
                        classification: 'PRODUCT_BUG',
                      })
                      .then((data: any) => {
                        toast.success('Bug candidate created');
                        router.push(`/fixes/${data.id}`);
                      })
                      .catch(() => toast.error('Failed to create bug candidate'));
                  }}
                  className="vt-btn vt-btn--ghost"
                >
                  <Flag className="w-3 h-3" strokeWidth={1.5} />
                  FLAG AS FLAKY / INVESTIGATE
                </button>
                <button
                  type="button"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="vt-btn"
                  style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }}
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                  REJECT
                </button>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="vt-btn vt-btn--primary"
                >
                  <Check className="w-3 h-3" strokeWidth={1.5} />
                  ACCEPT · AS NEW BASELINE
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/visual')}
                className="vt-btn"
              >
                <GitBranch className="w-3 h-3" strokeWidth={1.5} />
                BACK TO REDLINES
              </button>
            )}
          </div>
        </div>
      </section>
    </EditorialHero>
  );
}
