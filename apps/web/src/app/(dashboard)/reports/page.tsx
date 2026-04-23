'use client';

// Reports — the delivered-reports archive.
// Each report = a numbered entry (R-XXX), title in display, generated-on
// timestamp, download action. A stack of drawing sheets bound as a
// report. No cards, no rounded corners, no shadows.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { reportsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { Download, ArrowRight } from 'lucide-react';

type ReportType = 'summary' | 'detailed';

export default function ReportsPage() {
  const { project } = useCurrentProject();
  const [reportType, setReportType] = useState<ReportType>('summary');

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', project?.id, reportType],
    queryFn: () => reportsApi.get(project!.id, { type: reportType }),
    enabled: !!project?.id,
  });

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const isoStamp = new Date().toISOString().slice(0, 16).replace('T', ' · ');

  const handleExport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visiontest-report-${reportType}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build the archive: current generated report on top, plus placeholder
  // archival entries reflecting the data the API already returns.
  // Data hook is unchanged; we simply present what's there as entries.
  const r: any = report;
  const passRatePct = r?.passRate ? Math.round((r.passRate || 0) * 100) : 0;

  const archive = useMemo(() => {
    if (!r) return [];
    const entries: Array<{
      part: string;
      title: string;
      kind: string;
      stampedAt: string;
      meta: Array<[string, string]>;
      isLive: boolean;
    }> = [
      {
        part: 'R-001',
        title: `${reportType === 'summary' ? 'summary' : 'detailed'} report`,
        kind: reportType.toUpperCase(),
        stampedAt: isoStamp,
        meta: [
          ['EXECUTIONS', String(r.totalExecutions || 0).padStart(4, '0')],
          ['TESTS', String(r.totalTests || 0).padStart(4, '0')],
          ['PASS RATE', `${passRatePct.toFixed(1)}%`],
          ['AVG DURATION', r.avgDuration ? `${(r.avgDuration / 1000).toFixed(1)}s` : '—'],
        ],
        isLive: true,
      },
    ];
    // Show the alternate type as a sibling entry (generatable)
    entries.push({
      part: 'R-002',
      title: `${reportType === 'summary' ? 'detailed' : 'summary'} report`,
      kind: reportType === 'summary' ? 'DETAILED' : 'SUMMARY',
      stampedAt: '— · ON DEMAND',
      meta: [
        ['EXECUTIONS', '—'],
        ['TESTS', '—'],
        ['PASS RATE', '—'],
        ['AVG DURATION', '—'],
      ],
      isLive: false,
    });
    return entries;
  }, [r, reportType, isoStamp, passRatePct]);

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> —<br /> nothing to file.
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: 'var(--ink-1)', maxWidth: '56ch' }}>
          Reports are scoped to a project. Open the project switcher and select one.
        </p>
      </VtStage>
    );
  }

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`08 / 14`}
        eyebrow={`§ 08 · ARCHIVE`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            delivered <em>reports</em>.
          </>
        }
        lead={
          'Exportable bulletins — what was tested, what passed, what changed. Each report is a stack of sheets bound, stamped, and filed for the stakeholder who wants a copy on paper.'
        }
        actions={
          <div className="flex gap-0" style={{ border: '1px solid var(--rule)' }}>
            {(['summary', 'detailed'] as const).map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className="vt-mono"
                style={{
                  padding: '10px 14px',
                  fontSize: '10.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
                  background: reportType === t ? 'var(--accent-soft)' : 'transparent',
                  color: reportType === t ? 'var(--accent)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t}
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
            <span className="k">ACTIVE REPORT</span>
            <span className="v">{reportType.toUpperCase()}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">GENERATED</span>
            <span className="v">{isoStamp}</span>
          </div>
          <div className="span2">
            <span className="k">EXECUTIONS</span>
            <span className="v">{r ? String(r.totalExecutions || 0).padStart(4, '0') : '—'}</span>
          </div>
          <div className="span2">
            <span className="k">PASS RATE</span>
            <span className="v" style={{ color: passRatePct >= 90 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {r ? `${passRatePct.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>

        {/* ── §01 · Summary plate ─────────────────────────────────────── */}
        <section aria-labelledby="summary-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="summary-head">fig. 1 · cover figures</span>
            <span className="rule" />
            <span className="stamp">
              {reportType.toUpperCase()} · STAMPED {isoDate}
            </span>
          </div>

          {isLoading ? (
            <LoadingFrame />
          ) : !r ? (
            <EmptyFrame />
          ) : (
            <div
              className="grid grid-cols-2 md:grid-cols-4"
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <Figure
                part="F-01"
                label="total executions"
                value={String(r.totalExecutions || 0).padStart(3, '0')}
                tone="ink"
              />
              <Figure
                part="F-02"
                label="pass rate"
                value={`${passRatePct}`}
                suffix="%"
                tone={passRatePct >= 90 ? 'pass' : passRatePct >= 70 ? 'ink' : 'fail'}
              />
              <Figure
                part="F-03"
                label="avg duration"
                value={r.avgDuration ? `${(r.avgDuration / 1000).toFixed(1)}` : '—'}
                suffix={r.avgDuration ? 's' : ''}
                tone="ink"
              />
              <Figure
                part="F-04"
                label="total tests"
                value={String(r.totalTests || 0).padStart(3, '0')}
                tone="ink"
                last
              />
            </div>
          )}
        </section>

        {/* ── §02 · Archive ───────────────────────────────────────────── */}
        <section aria-labelledby="archive-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="archive-head">reports on file</span>
            <span className="rule" />
            <span className="stamp">{archive.length} ENTR{archive.length === 1 ? 'Y' : 'IES'}</span>
          </div>

          {isLoading ? (
            <LoadingFrame />
          ) : !r ? (
            <EmptyFrame />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              {/* Header row */}
              <div
                className="grid grid-cols-[90px_1fr_140px_200px_140px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['PART', 'TITLE', 'KIND', 'GENERATED', 'ACTION'].map((h, i) => (
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

              {archive.map((entry, i) => (
                <div
                  key={entry.part}
                  className="grid grid-cols-[90px_1fr_140px_200px_140px] gap-0"
                  style={{
                    borderBottom: i < archive.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 40}ms var(--ease-out) both`,
                  }}
                >
                  <div
                    className="py-4 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.16em',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.part}
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                      }}
                    >
                      {entry.title}
                    </div>
                    <div
                      className="mt-1 vt-mono"
                      style={{
                        fontSize: '10.5px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {entry.meta.slice(0, 2).map(([k, v]) => `${k} ${v}`).join('  ·  ')}
                    </div>
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.16em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.isLive ? (
                      <span className="vt-chip vt-chip--accent" style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                        {entry.kind}
                      </span>
                    ) : (
                      <span className="vt-chip" style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                        {entry.kind}
                      </span>
                    )}
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.12em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.stampedAt}
                  </div>
                  <div className="py-4 px-4 flex justify-end items-center">
                    {entry.isLive ? (
                      <button type="button" onClick={handleExport} className="vt-btn" style={{ fontSize: '10px', padding: '6px 10px' }}>
                        <Download className="w-3 h-3" strokeWidth={1.5} />
                        JSON
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReportType(reportType === 'summary' ? 'detailed' : 'summary')}
                        className="vt-btn vt-btn--ghost"
                        style={{ fontSize: '10px', padding: '6px 10px' }}
                      >
                        GENERATE
                        <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── §03 · Raw sheet (data) ──────────────────────────────────── */}
        {!isLoading && r && (
          <section aria-labelledby="raw-head">
            <div className="vt-section-head">
              <span className="num">§ 03</span>
              <span className="ttl" id="raw-head">fig. 2 · raw sheet</span>
              <span className="rule" />
              <span className="stamp">JSON PAYLOAD · APPENDED</span>
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
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>APPENDIX · {reportType.toUpperCase()}.JSON</span>
                <span>SIZE · {JSON.stringify(r).length} B</span>
              </div>
              <pre
                className="vt-mono p-6 overflow-auto"
                style={{
                  fontSize: '11.5px',
                  lineHeight: 1.6,
                  color: 'var(--ink-1)',
                  maxHeight: '480px',
                  letterSpacing: '0.02em',
                }}
              >
                {JSON.stringify(r, null, 2)}
              </pre>
            </div>
          </section>
        )}

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
          <span>SHEET 08 · ARCHIVE</span>
          <span>FORMAT · JSON</span>
          <span>DRAWN · {isoDate}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ────────────────────────────────────────────────────────── primitives ── */

function Figure({
  part,
  label,
  value,
  suffix,
  tone,
  last,
}: {
  part: string;
  label: string;
  value: string;
  suffix?: string;
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
      <div
        className="mb-4"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.18em',
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {part}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 4.2vw, 60px)',
          lineHeight: 1,
          letterSpacing: '-0.025em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {suffix && (
          <span style={{ color: 'var(--ink-2)', fontSize: '42%', marginLeft: '3px' }}>{suffix}</span>
        )}
      </div>
      <div
        className="mt-3"
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

function LoadingFrame() {
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
        generating the bulletin…
      </div>
    </div>
  );
}

function EmptyFrame() {
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
        — archive empty —
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 2.6vw, 32px)',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        nothing filed yet.
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.5,
        }}
      >
        Run some tests — each report gets stamped, numbered, and bound here.
      </p>
    </div>
  );
}
