'use client';

// Scan · New — commission a survey of a site.
//
// Sheet-style layout. Each input sits in a ruled cell with dimension
// annotations (DEPTH: ⊢ 3 ⊣ MAX). Safety mode is a 3-part segmented
// switch. The destructive and sandbox cells reveal secondary fields
// inline. All mutation logic and handlers are preserved unchanged.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Compass,
  Loader2,
  AlertTriangle,
  Info,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentProject } from '@/hooks/useProject';
import { api, credentialsApi, type Credential } from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

type SafetyMode = 'read-only' | 'allow-destructive' | 'sandbox';

const SAFETY_DETAIL: Record<SafetyMode, { label: string; desc: string; stamp: string }> = {
  'read-only':         { label: 'read-only',         desc: 'Skip destructive elements — delete, submit, pay, log-out. Default.', stamp: 'SAFE' },
  'allow-destructive': { label: 'allow-destructive', desc: 'Click everything. Requires explicit acknowledgement.', stamp: 'WARN' },
  'sandbox':           { label: 'sandbox',           desc: 'Click everything, but call a reset hook before each run.', stamp: 'SANDBOX' },
};

export default function NewScanPage() {
  const router = useRouter();
  const { project } = useCurrentProject();

  const [startUrl, setStartUrl] = useState('');
  const [maxPages, setMaxPages] = useState(25);
  const [maxClicks, setMaxClicks] = useState(15);
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('read-only');
  const [stubWrites, setStubWrites] = useState(false);
  const [resetHookUrl, setResetHookUrl] = useState('');
  const [acknowledgedDestructive, setAcknowledgedDestructive] = useState(false);
  const [credentialId, setCredentialId] = useState<string>('');

  const { data: credentials } = useQuery({
    queryKey: ['credentials', project?.orgId, project?.id],
    queryFn: () => credentialsApi.list(project!.orgId!, project!.id),
    enabled: !!project?.orgId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      return api.post(`/projects/${project!.id}/scan`, {
        startUrl,
        maxPages,
        maxClicksPerPage: maxClicks,
        safety: {
          mode: safetyMode,
          stubNetworkWrites: stubWrites,
          resetHookUrl:
            safetyMode === 'sandbox' && resetHookUrl ? resetHookUrl : null,
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success('Scan queued');
      router.push(`/scan/${res.executionId}`);
    },
    onError: (err: any) => toast.error(err.message || 'Scan failed to queue'),
  });

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display mb-6" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> before commissioning a scan.
        </h1>
      </VtStage>
    );
  }

  const canRun =
    startUrl.trim().length > 0 &&
    (safetyMode !== 'allow-destructive' || acknowledgedDestructive) &&
    (safetyMode !== 'sandbox' || resetHookUrl.trim().length > 0);

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const creds = (credentials || []) as Credential[];

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07 / 14"
        eyebrow="§ 07 · SURVEY COMMISSION"
        revision={<>REV · 01 · {today}</>}
        back={{ label: 'BACK' }}
        title={
          <>
            commission a <em>survey</em>
          </>
        }
        lead={
          'Point the crawler at a URL. It will click safe elements, flag broken ones, and file the results as a coverage map. Run against staging or a sandbox — never production.'
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-SCAN-{(project.slug || project.id.slice(-6)).toUpperCase()}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>01</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{today}</span>
          </div>
          <div className="span2">
            <span className="k">SCOPE</span>
            <span className="v">DEPTH · {maxPages} PAGES</span>
          </div>
          <div className="span2">
            <span className="k">SAFETY</span>
            <span
              className="v"
              style={{
                color:
                  safetyMode === 'read-only'
                    ? 'var(--pass)'
                    : safetyMode === 'sandbox'
                    ? 'var(--accent)'
                    : 'var(--warn)',
              }}
            >
              {SAFETY_DETAIL[safetyMode].stamp}
            </span>
          </div>
        </div>

        {/* §01 — target */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl">survey target</span>
            <span className="rule" />
            <span className="stamp">ENTRY POINT + LIMITS</span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              padding: '24px 28px',
            }}
            className="space-y-6"
          >
            <FormCell label="START URL" required>
              <input
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://staging.example.com"
                className="vt-input"
                style={{ height: '44px' }}
              />
            </FormCell>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormCell
                label="MAX PAGES"
                annotation={`⊢ ${maxPages} ⊣ / 200`}
              >
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={maxPages}
                  onChange={(e) =>
                    setMaxPages(Math.max(1, parseInt(e.target.value || '1')))
                  }
                  className="vt-input"
                  style={{ height: '44px' }}
                />
              </FormCell>
              <FormCell
                label="MAX CLICKS / PAGE"
                annotation={`⊢ ${maxClicks} ⊣ / 100`}
              >
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxClicks}
                  onChange={(e) =>
                    setMaxClicks(Math.max(1, parseInt(e.target.value || '1')))
                  }
                  className="vt-input"
                  style={{ height: '44px' }}
                />
              </FormCell>
            </div>

            {creds.length > 0 && (
              <FormCell
                label="CREDENTIAL"
                annotation="OPTIONAL · APPLIED TO CRAWLER SESSION"
              >
                <select
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  className="vt-input"
                  style={{ height: '44px' }}
                >
                  <option value="">— none —</option>
                  {creds.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.key} · v{c.version}
                      {c.environment ? ` · ${c.environment}` : ''}
                    </option>
                  ))}
                </select>
              </FormCell>
            )}
          </div>
        </section>

        {/* §02 — safety */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl">safety mode</span>
            <span className="rule" />
            <span className="stamp">
              CURRENT · {SAFETY_DETAIL[safetyMode].stamp}
            </span>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-0"
            style={{ border: '1px solid var(--rule-strong)' }}
          >
            {(['read-only', 'allow-destructive', 'sandbox'] as SafetyMode[]).map(
              (m, i) => {
                const active = safetyMode === m;
                const meta = SAFETY_DETAIL[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSafetyMode(m);
                      if (m !== 'allow-destructive') setAcknowledgedDestructive(false);
                    }}
                    className="text-left"
                    style={{
                      padding: '22px 22px 20px',
                      borderRight:
                        i < 2 ? '1px solid var(--rule-soft)' : 'none',
                      borderBottom:
                        i === 0
                          ? '1px solid var(--rule-soft)'
                          : 'none',
                      background: active
                        ? 'var(--accent-soft)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'background var(--dur-quick) var(--ease-out)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          color: active ? 'var(--accent)' : 'var(--ink-2)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        M-{String(i + 1).padStart(2, '0')}
                      </span>
                      {active && (
                        <span
                          className="vt-rev-stamp"
                          style={{ fontSize: '8.5px', padding: '2px 6px' }}
                        >
                          SELECTED
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                        lineHeight: 1.15,
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      className="mt-2"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '12.5px',
                        color: 'var(--ink-2)',
                        lineHeight: 1.5,
                      }}
                    >
                      {meta.desc}
                    </div>
                  </button>
                );
              },
            )}
          </div>

          {/* Extra controls by mode */}
          <div className="mt-6 space-y-4">
            <label
              className="flex items-start gap-3 cursor-pointer"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-1)',
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={stubWrites}
                onChange={(e) => setStubWrites(e.target.checked)}
                className="mt-1"
              />
              <span>
                STUB NETWORK WRITES
                <span
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    color: 'var(--ink-2)',
                    letterSpacing: '0.08em',
                    textTransform: 'none',
                    marginTop: '3px',
                    lineHeight: 1.5,
                  }}
                >
                  Intercept DELETE / POST / PUT / PATCH with a synthetic 200 so
                  the crawler exercises write paths without side effects.
                </span>
              </span>
            </label>

            {safetyMode === 'sandbox' && (
              <FormCell
                label="RESET HOOK URL"
                required
                helper="POSTED BEFORE EACH RUN — NON-2XX ABORTS"
              >
                <input
                  value={resetHookUrl}
                  onChange={(e) => setResetHookUrl(e.target.value)}
                  placeholder="https://staging.example.com/__reset"
                  className="vt-input"
                  style={{ height: '44px' }}
                />
              </FormCell>
            )}

            {safetyMode === 'allow-destructive' && (
              <div
                className="p-4 flex items-start gap-3"
                style={{
                  border: '1px solid color-mix(in oklab, var(--warn) 45%, var(--rule))',
                  background: 'var(--warn-soft)',
                }}
              >
                <AlertTriangle
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  strokeWidth={1.5}
                  style={{ color: 'var(--warn)' }}
                />
                <div className="space-y-3">
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--ink-0)',
                      lineHeight: 1.55,
                    }}
                  >
                    Allow-destructive clicks everything — delete buttons,
                    submit forms, sent emails.{' '}
                    <strong style={{ color: 'var(--warn)' }}>
                      Only against staging or a disposable test environment.
                    </strong>
                  </div>
                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--warn)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={acknowledgedDestructive}
                      onChange={(e) =>
                        setAcknowledgedDestructive(e.target.checked)
                      }
                    />
                    I ACKNOWLEDGE · PROCEED
                  </label>
                </div>
              </div>
            )}

            <div
              className="p-4 flex items-start gap-3"
              style={{
                border: '1px solid color-mix(in oklab, var(--accent) 45%, var(--rule))',
                background: 'var(--accent-soft)',
              }}
            >
              <Info
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                strokeWidth={1.5}
                style={{ color: 'var(--accent)' }}
              />
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                }}
              >
                Run against staging or a sandbox — not production. Destructive
                actions are skipped by default, but heuristics are not perfect.
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div
          className="pt-6 flex items-center justify-end gap-3"
          style={{ borderTop: '1px solid var(--rule)' }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="vt-btn vt-btn--ghost"
          >
            CANCEL
          </button>
          <button
            type="button"
            disabled={!canRun || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="vt-btn vt-btn--primary"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                QUEUING
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5" strokeWidth={1.5} />
                COMMISSION SCAN
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>

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
          <span>SHEET 07 · COMMISSION</span>
          <span>DEPTH · ⊢ {maxPages} ⊣ MAX</span>
          <span>SAFETY · {SAFETY_DETAIL[safetyMode].stamp}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

function FormCell({
  label,
  required,
  helper,
  annotation,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  annotation?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>*</span>}
        </label>
        {annotation && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {annotation}
          </span>
        )}
      </div>
      {children}
      {helper && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'var(--ink-2)',
            textTransform: 'uppercase',
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}
