'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Loader2, CheckCircle2, XCircle, Save, Plus, Trash2, Zap, Copy, Wand2 } from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

interface Viewport {
  name: string;
  width: number;
  height: number;
}

export default function StorybookSettingsPage() {
  const { project } = useCurrentProject();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [viewports, setViewports] = useState<Viewport[]>([
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 375, height: 812 },
  ]);

  useEffect(() => {
    if (project?.id) loadConfig();
  }, [project?.id]);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await api.get<any>('/storybook/config', { projectId: project!.id });
      setConfig(data);
      if (data.viewports && Array.isArray(data.viewports)) setViewports(data.viewports);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/storybook/config', { ...config, projectId: project!.id, viewports });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!config?.storybookUrl) return;
    setTestingConnection(true);
    try {
      const result = await api.post<any>('/storybook/test-connection', {
        projectId: project!.id,
        storybookUrl: config.storybookUrl,
      });
      setConnectionResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setTestingConnection(false);
    }
  }

  function addViewport() {
    setViewports([...viewports, { name: 'Tablet', width: 768, height: 1024 }]);
  }
  function removeViewport(i: number) {
    setViewports(viewports.filter((_, idx) => idx !== i));
  }
  function updateViewport(i: number, field: string, value: string | number) {
    const updated = [...viewports];
    (updated[i] as any)[field] = value;
    setViewports(updated);
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const cliSnippet = `npx visiontest storybook capture \\
  --static-dir ./storybook-static \\
  --upload --fail-on-breaking`;

  if (loading) {
    return (
      <VtStage width="wide">
        <EditorialHero
          width="wide"
          sheet="07.C / 14"
          eyebrow="§ 07.C · WIRING"
          back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
          revision={<>REV · 02 · {isoDate}</>}
          title={<>storybook <em>integration</em>.</>}
        >
          <LoadingFrame />
        </EditorialHero>
      </VtStage>
    );
  }

  const storyCount = connectionResult?.storyCount ?? config?.lastSyncedStoryCount ?? 0;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.C / 14"
        eyebrow="§ 07.C · WIRING"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>point us at your <em>Storybook</em>.</>}
        lead="One URL. We enumerate your stories, sync them on a schedule, and convert each one into a visual-regression fixture."
        actions={
          <Link href="/settings/storybook/wizard" className="vt-btn">
            <Wand2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            GUIDED SETUP
          </Link>
        }
      >
        {/* ── §01 · Title block summary ───────────────────────── */}
        <section>
          <div className="vt-title-block">
            <div className="span2">
              <span className="k">URL</span>
              <span className="v">{config?.storybookUrl || '— UNSET'}</span>
            </div>
            <div className="span2">
              <span className="k">MODE</span>
              <span className="v">{(config?.mode || 'cli').toUpperCase()}</span>
            </div>
            <div>
              <span className="k">STATUS</span>
              <span className="v" style={{ color: config?.enabled ? 'var(--pass)' : 'var(--ink-2)' }}>
                {config?.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <div>
              <span className="k">STORIES</span>
              <span className="v">{String(storyCount).padStart(3, '0')}</span>
            </div>
            <div className="span2">
              <span className="k">SYNC MODE</span>
              <span className="v">{(config?.syncMode || 'manual').toUpperCase()}</span>
            </div>
            <div className="span2">
              <span className="k">VIEWPORTS</span>
              <span className="v">{String(viewports.length).padStart(2, '0')} × SIZES</span>
            </div>
          </div>
        </section>

        {/* ── §01 · Enable + mode ─────────────────────────────── */}
        <section aria-labelledby="enable-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="enable-head">enable · integration mode</span>
            <span className="rule" />
            <span className="stamp">WIRING</span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div
              className="grid grid-cols-[1fr_200px] gap-0 items-center"
              style={{ borderBottom: '1px solid var(--rule-soft)' }}
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
                  ENABLE STORYBOOK INTEGRATION
                </div>
              </div>
              <div className="p-5">
                <SegmentedToggle
                  checked={!!config?.enabled}
                  onChange={(v) => setConfig({ ...config, enabled: v })}
                />
              </div>
            </div>

            <Field label="INTEGRATION MODE" borderBottom>
              <select
                className="vt-input"
                value={config?.mode || 'cli'}
                onChange={(e) => setConfig({ ...config, mode: e.target.value })}
              >
                <option value="cli">CLI (recommended) — screenshots taken in CI, uploaded</option>
                <option value="connected">Connected — VisionTest.ai screenshots from a URL</option>
                <option value="hybrid">Hybrid — upload static build, VisionTest.ai screenshots</option>
              </select>
            </Field>

            {config?.mode === 'cli' && (
              <Field label="ADD TO YOUR CI PIPELINE">
                <div
                  className="relative"
                  style={{
                    border: '1px solid var(--rule)',
                    background: 'color-mix(in oklab, var(--bg-2) 40%, transparent)',
                  }}
                >
                  <pre
                    className="p-4 overflow-x-auto"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12.5px',
                      letterSpacing: '0.02em',
                      color: 'var(--ink-1)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {cliSnippet}
                  </pre>
                  <button
                    type="button"
                    className="vt-btn vt-btn--ghost absolute top-2 right-2"
                    style={{ padding: '4px 8px' }}
                    onClick={() => navigator.clipboard.writeText(cliSnippet)}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </Field>
            )}

            {(config?.mode === 'connected' || config?.mode === 'hybrid') && (
              <Field label="STORYBOOK URL">
                <div className="flex items-stretch gap-2">
                  <input
                    className="vt-input flex-1"
                    value={config?.storybookUrl || ''}
                    onChange={(e) => setConfig({ ...config, storybookUrl: e.target.value })}
                    placeholder="https://storybook.staging.myapp.com"
                  />
                  <button
                    type="button"
                    className="vt-btn"
                    style={{ padding: '8px 14px' }}
                    onClick={testConnection}
                    disabled={testingConnection || !config?.storybookUrl}
                  >
                    {testingConnection ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {connectionResult && (
                  <div
                    className="mt-3 p-3 vt-mono"
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.04em',
                      color: connectionResult.connected ? 'var(--pass)' : 'var(--fail)',
                      background: connectionResult.connected ? 'var(--pass-soft)' : 'var(--fail-soft)',
                      border: `1px solid ${connectionResult.connected ? 'var(--pass)' : 'var(--fail)'}`,
                    }}
                  >
                    {connectionResult.connected ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 inline mr-2" />
                        CONNECTED · {connectionResult.storyCount} STORIES · INDEX{' '}
                        {connectionResult.indexVersion}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 inline mr-2" />
                        {connectionResult.error}
                      </>
                    )}
                  </div>
                )}
              </Field>
            )}
          </div>
        </section>

        {/* ── §02 · Viewports ─────────────────────────────────── */}
        <section aria-labelledby="vp-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="vp-head">viewport sizes</span>
            <span className="rule" />
            <span className="stamp">
              {String(viewports.length).padStart(2, '0')} × SIZES
            </span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div
              className="grid grid-cols-[70px_1fr_140px_140px_60px] gap-0"
              style={{
                borderBottom: '1px solid var(--rule-strong)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              {['CODE', 'NAME', 'WIDTH · PX', 'HEIGHT · PX', ''].map((h, i) => (
                <div
                  key={i}
                  className="py-3 px-4"
                  style={{ borderRight: i < 4 ? '1px solid var(--rule)' : 'none' }}
                >
                  {h}
                </div>
              ))}
            </div>
            {viewports.map((vp, i) => (
              <div
                key={i}
                className="grid grid-cols-[70px_1fr_140px_140px_60px] gap-0 items-center"
                style={{
                  borderBottom: i < viewports.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                }}
              >
                <div
                  className="py-3 px-4"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.18em',
                    color: 'var(--accent)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  VP-{String(i + 1).padStart(2, '0')}
                </div>
                <div className="py-2 px-3" style={{ borderRight: '1px solid var(--rule-soft)' }}>
                  <input
                    className="vt-input"
                    value={vp.name}
                    onChange={(e) => updateViewport(i, 'name', e.target.value)}
                  />
                </div>
                <div className="py-2 px-3" style={{ borderRight: '1px solid var(--rule-soft)' }}>
                  <input
                    className="vt-input"
                    type="number"
                    value={vp.width}
                    onChange={(e) => updateViewport(i, 'width', parseInt(e.target.value))}
                  />
                </div>
                <div className="py-2 px-3" style={{ borderRight: '1px solid var(--rule-soft)' }}>
                  <input
                    className="vt-input"
                    type="number"
                    value={vp.height}
                    onChange={(e) => updateViewport(i, 'height', parseInt(e.target.value))}
                  />
                </div>
                <div className="py-2 px-3 flex items-center justify-center">
                  <button
                    type="button"
                    className="vt-btn vt-btn--ghost"
                    style={{ padding: '6px 8px', color: 'var(--fail)' }}
                    onClick={() => removeViewport(i)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            <div className="px-4 py-3" style={{ background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)' }}>
              <button className="vt-btn" onClick={addViewport}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                ADD VIEWPORT
              </button>
            </div>
          </div>
        </section>

        {/* ── §03 · Filtering ─────────────────────────────────── */}
        <section aria-labelledby="filter-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="filter-head">story filtering</span>
            <span className="rule" />
            <span className="stamp">GLOB PATTERNS</span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <Field label="INCLUDE PATTERNS · COMMA-SEPARATED" borderBottom>
              <input
                className="vt-input"
                value={(config?.includePatterns || []).join(', ')}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    includePatterns: e.target.value
                      .split(',')
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Leave empty = include all"
              />
            </Field>
            <Field label="EXCLUDE PATTERNS · COMMA-SEPARATED">
              <input
                className="vt-input"
                value={(config?.excludePatterns || ['*--docs']).join(', ')}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    excludePatterns: e.target.value
                      .split(',')
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="*--docs"
              />
            </Field>
          </div>
        </section>

        {/* ── §04 · Sync settings ─────────────────────────────── */}
        <section aria-labelledby="sync-head">
          <div className="vt-section-head">
            <span className="num">§ 04</span>
            <span className="ttl" id="sync-head">sync schedule</span>
            <span className="rule" />
            <span className="stamp">CADENCE</span>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <Field label="WAIT AFTER PAGE LOAD · MS" borderRight>
              <input
                className="vt-input"
                type="number"
                value={config?.waitAfterLoadMs || 500}
                onChange={(e) =>
                  setConfig({ ...config, waitAfterLoadMs: parseInt(e.target.value) })
                }
              />
            </Field>
            {config?.mode !== 'cli' && (
              <Field label="SYNC MODE">
                <select
                  className="vt-input"
                  value={config?.syncMode || 'manual'}
                  onChange={(e) => setConfig({ ...config, syncMode: e.target.value })}
                >
                  <option value="manual">Manual — sync via CLI or "Sync Now"</option>
                  <option value="polling">Polling — check for changes periodically</option>
                  <option value="webhook">Webhook — POST to VisionTest.ai on change</option>
                </select>
              </Field>
            )}
          </div>
        </section>

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

function LoadingFrame() {
  return (
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
  );
}
