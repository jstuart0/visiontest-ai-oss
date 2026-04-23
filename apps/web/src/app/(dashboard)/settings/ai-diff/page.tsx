'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Loader2, CheckCircle2, XCircle, Save, Zap, Wand2 } from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function AiDiffSettingsPage() {
  const { project } = useCurrentProject();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState<any>(null);
  const [testingSidecar, setTestingSidecar] = useState(false);

  useEffect(() => {
    if (project?.id) loadConfig();
  }, [project?.id]);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await api.get<any>('/ai-diff/config', { projectId: project!.id });
      setConfig(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await api.put('/ai-diff/config', { ...config, projectId: project!.id });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function testSidecar() {
    setTestingSidecar(true);
    try {
      const result = await api.post<any>('/ai-diff/test-sidecar', { projectId: project!.id });
      setSidecarStatus(result);
    } catch (error) {
      console.error(error);
    } finally {
      setTestingSidecar(false);
    }
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (loading) {
    return (
      <VtStage width="wide">
        <EditorialHero
          width="wide"
          sheet="07.B / 14"
          eyebrow="§ 07.B · PERCEPTION"
          back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
          revision={<>REV · 02 · {isoDate}</>}
          title={<>ai visual <em>diff</em>.</>}
        >
          <div
            className="p-10 text-center"
            style={{
              border: '1px dashed var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
            }}
          >
            <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--ink-2)' }} />
            <div
              className="mt-3"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              LOADING
            </div>
          </div>
        </EditorialHero>
      </VtStage>
    );
  }

  const ssim = config?.ssimThreshold ?? 0.97;
  const dino = config?.dinoThreshold ?? 0.94;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.B / 14"
        eyebrow="§ 07.B · PERCEPTION"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>how the machine <em>sees</em> difference.</>}
        lead="SSIM, LPIPS, DINOv2 — three lenses for comparing two images. Tune the thresholds and which models are consulted."
        actions={
          <Link href="/settings/ai-diff/wizard" className="vt-btn">
            <Wand2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            GUIDED SETUP
          </Link>
        }
      >
        {/* ── §01 · Master switch ──────────────────────────────── */}
        <section aria-labelledby="enable-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="enable-head">master switch</span>
            <span className="rule" />
            <span className="stamp">{config?.enabled ? 'ENABLED' : 'DISABLED'}</span>
          </div>

          <div
            className="grid grid-cols-[1fr_200px] gap-0 items-center"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div className="p-5" style={{ borderRight: '1px solid var(--rule-soft)' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-0)',
                }}
              >
                ENABLE AI VISUAL DIFF
              </div>
              <div
                className="mt-1"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--ink-2)',
                  lineHeight: 1.5,
                }}
              >
                When enabled, comparisons are automatically classified by the AI pipeline and noise is filtered.
              </div>
            </div>
            <div className="p-5">
              <SegmentedToggle
                checked={!!config?.enabled}
                onChange={(v) => setConfig({ ...config, enabled: v })}
              />
            </div>
          </div>
        </section>

        {/* ── §02 · Pipeline ──────────────────────────────────── */}
        <section aria-labelledby="pipeline-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="pipeline-head">pipeline · lenses</span>
            <span className="rule" />
            <span className="stamp">ANALYSIS DEPTH</span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <Field label="ANALYSIS DEPTH · MAX STAGE" borderBottom>
              <select
                className="vt-input"
                value={String(config?.maxStage ?? 3)}
                onChange={(e) => setConfig({ ...config, maxStage: parseInt(e.target.value) })}
              >
                <option value="1">Fast — Stages 0-1 — SSIM + LPIPS ~50ms</option>
                <option value="2">Balanced — Stages 0-2 — adds DINOv2 ~200ms</option>
                <option value="3">Deep — Stages 0-3 — full VLM analysis ~5s</option>
              </select>
            </Field>

            <Field label="EMBEDDINGS SIDECAR · URL">
              <div className="flex items-stretch gap-2">
                <input
                  className="vt-input flex-1"
                  value={config?.sidecarUrl || ''}
                  onChange={(e) => setConfig({ ...config, sidecarUrl: e.target.value })}
                  placeholder="http://visiontest-embeddings:8100"
                />
                <button
                  type="button"
                  className="vt-btn"
                  style={{ padding: '8px 14px' }}
                  onClick={testSidecar}
                  disabled={testingSidecar}
                >
                  {testingSidecar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {sidecarStatus && (
                <div
                  className="mt-3 p-3 vt-mono"
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                    color: sidecarStatus.connected ? 'var(--pass)' : 'var(--fail)',
                    background: sidecarStatus.connected ? 'var(--pass-soft)' : 'var(--fail-soft)',
                    border: `1px solid ${sidecarStatus.connected ? 'var(--pass)' : 'var(--fail)'}`,
                  }}
                >
                  {sidecarStatus.connected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 inline mr-2" />
                      CONNECTED · {sidecarStatus.latencyMs}MS · GPU ·{' '}
                      {sidecarStatus.gpuAvailable ? 'YES' : 'NO'} · MODELS ·{' '}
                      {sidecarStatus.modelsLoaded?.length || 0}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 inline mr-2" />
                      {sidecarStatus.error}
                    </>
                  )}
                </div>
              )}
            </Field>
          </div>
        </section>

        {/* ── §03 · Thresholds — as dimension callouts ────────── */}
        <section aria-labelledby="thresh-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="thresh-head">thresholds · sensitivity</span>
            <span className="rule" />
            <span className="stamp">CALLOUTS · STAGE 1 · STAGE 2</span>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <ThresholdCell
              label="SSIM + LPIPS · STAGE 1"
              value={ssim}
              min={0.85}
              max={0.99}
              step={0.005}
              onChange={(v) => setConfig({ ...config, ssimThreshold: v })}
              borderRight
            />
            <ThresholdCell
              label="DINOV2 EMBEDDING · STAGE 2"
              value={dino}
              min={0.8}
              max={0.99}
              step={0.005}
              onChange={(v) => setConfig({ ...config, dinoThreshold: v })}
            />
          </div>
        </section>

        {/* ── §04 · Automation ───────────────────────────────── */}
        <section aria-labelledby="auto-head">
          <div className="vt-section-head">
            <span className="num">§ 04</span>
            <span className="ttl" id="auto-head">automation · verdicts</span>
            <span className="rule" />
            <span className="stamp">CLASSIFICATION ACTIONS</span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <ToggleRow
              label="AUTO-APPROVE · NOISE"
              desc="Automatically approve diffs classified as rendering noise."
              checked={!!config?.autoApproveNoise}
              onChange={(v) => setConfig({ ...config, autoApproveNoise: v })}
            />
            <ToggleRow
              label="AUTO-APPROVE · MINOR"
              desc="Automatically approve minor visual changes."
              checked={!!config?.autoApproveMinor}
              onChange={(v) => setConfig({ ...config, autoApproveMinor: v })}
            />
            <ToggleRow
              label="AUTO-ESCALATE · BREAKING"
              desc="Automatically escalate breaking visual changes."
              checked={config?.escalateBreaking ?? true}
              onChange={(v) => setConfig({ ...config, escalateBreaking: v })}
              last
            />
          </div>
        </section>

        {/* ── §05 · Cost limits ──────────────────────────────── */}
        <section aria-labelledby="cost-head">
          <div className="vt-section-head">
            <span className="num">§ 05</span>
            <span className="ttl" id="cost-head">cost limits · budget</span>
            <span className="rule" />
            <span className="stamp">VLM SPEND CAPS</span>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <Field label="VLM CALLS · PER EXECUTION" borderRight>
              <input
                className="vt-input"
                type="number"
                value={config?.vlmCallsPerExecution || 50}
                onChange={(e) =>
                  setConfig({ ...config, vlmCallsPerExecution: parseInt(e.target.value) })
                }
              />
            </Field>
            <Field label="MONTHLY VLM BUDGET · BLANK = UNLIMITED">
              <input
                className="vt-input"
                type="number"
                value={config?.vlmMonthlyBudget || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    vlmMonthlyBudget: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Unlimited"
              />
            </Field>
          </div>
        </section>

        {/* Save bar */}
        <div className="flex items-center gap-3 pt-2">
          <button className="vt-btn vt-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            {saving ? 'SAVING' : 'SAVE CONFIGURATION'}
          </button>
          <button className="vt-btn" onClick={() => loadConfig()}>
            RESET
          </button>
        </div>
      </EditorialHero>
    </VtStage>
  );
}

/* ─────────────────────────────────────────────────────── primitives ── */

function Field({
  label,
  children,
  borderBottom,
  borderRight,
}: {
  label: string;
  children: React.ReactNode;
  borderBottom?: boolean;
  borderRight?: boolean;
}) {
  return (
    <div
      className="p-5"
      style={{
        borderBottom: borderBottom ? '1px solid var(--rule-soft)' : undefined,
        borderRight: borderRight ? '1px solid var(--rule-soft)' : undefined,
      }}
    >
      <div
        className="mb-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ThresholdCell({
  label,
  value,
  min,
  max,
  step,
  onChange,
  borderRight,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  borderRight?: boolean;
}) {
  return (
    <div
      className="p-6"
      style={{
        borderRight: borderRight ? '1px solid var(--rule-soft)' : undefined,
      }}
    >
      <div
        className="mb-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>

      {/* Ortho number display */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 4vw, 52px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toFixed(3)}
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-5"
      />

      {/* dimension callout */}
      <div className="mt-4 relative">
        <div className="vt-dim-h">
          <span className="tick-l" />
          <span className="tick-r" />
          <span className="v">
            ⊢ {min} — {max} ⊣
          </span>
        </div>
      </div>

      <div
        className="mt-3 flex justify-between"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        <span>MORE SENSITIVE</span>
        <span>LESS SENSITIVE</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  last,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[1fr_220px] gap-0 items-center"
      style={{ borderBottom: last ? 'none' : '1px solid var(--rule-soft)' }}
    >
      <div className="p-5" style={{ borderRight: '1px solid var(--rule-soft)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-0)',
          }}
        >
          {label}
        </div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--ink-2)',
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      <div className="p-5">
        <SegmentedToggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function SegmentedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2" style={{ border: '1px solid var(--rule)' }}>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: '8px 0',
          background: !checked ? 'var(--bg-2)' : 'transparent',
          color: !checked ? 'var(--ink-0)' : 'var(--ink-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          borderRight: '1px solid var(--rule)',
          cursor: 'pointer',
        }}
      >
        OFF
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: '8px 0',
          background: checked ? 'var(--accent)' : 'transparent',
          color: checked ? 'var(--bg-0)' : 'var(--ink-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        ON
      </button>
    </div>
  );
}
