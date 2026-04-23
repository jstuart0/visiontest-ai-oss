'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Plus,
  Trash2,
  Loader2,
  Star,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ProviderConfig {
  id: string;
  provider: string;
  name: string;
  hasApiKey: boolean;
  baseUrl: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRuntimeSeconds: number;
  supportsStreaming: boolean;
  supportsImages: boolean;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsImages?: boolean;
  pricing?: { inputPerMToken?: number; outputPerMToken?: number };
}

interface ProviderDefaults {
  displayName: string;
  baseUrl: string | null;
  defaultModel: string;
  requiresApiKey: boolean;
  staticModels: ModelInfo[];
}

const PROVIDER_CODE: Record<string, string> = {
  ANTHROPIC: 'ANT',
  OPENAI: 'OAI',
  OPENROUTER: 'ORT',
  GEMINI: 'GEM',
  LOCAL: 'LCL',
};

export default function AIProvidersPage() {
  const { project } = useCurrentProject();
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [defaults, setDefaults] = useState<Record<string, ProviderDefaults>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state
  const [provider, setProvider] = useState('ANTHROPIC');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.2);
  const [maxRuntime, setMaxRuntime] = useState(120);
  const [isDefault, setIsDefault] = useState(false);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    loadDefaults();
    if (project?.id) loadConfigs();
  }, [project?.id]);

  useEffect(() => {
    const d = defaults[provider];
    if (d) {
      setName(d.displayName);
      setBaseUrl(d.baseUrl || '');
      setModel(d.defaultModel);
      setModels(d.staticModels || []);
    }
  }, [provider, defaults]);

  async function loadDefaults() {
    try {
      const data = await api.get<Record<string, ProviderDefaults>>('/ai-providers/defaults');
      setDefaults(data || {});
    } catch (error) {
      console.error('Failed to load defaults:', error);
    }
  }

  async function loadConfigs() {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await api.get<ProviderConfig[]>('/ai-providers', { projectId: project.id });
      setConfigs(data || []);
    } catch (error) {
      console.error('Failed to load configs:', error);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchModels() {
    setLoadingModels(true);
    try {
      const params: Record<string, string> = { provider };
      if (apiKey) params.apiKey = apiKey;
      if (baseUrl) params.baseUrl = baseUrl;
      const data = await api.get<{ provider: string; models: ModelInfo[] }>('/ai-providers/models', params);
      if (data?.models?.length > 0) setModels(data.models);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSave() {
    if (!project?.id || !model) return;
    setSaving(true);
    try {
      await api.post('/ai-providers', {
        projectId: project.id,
        provider,
        name: name || defaults[provider]?.displayName || provider,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model,
        maxTokens,
        temperature,
        maxRuntimeSeconds: maxRuntime,
        isDefault,
        supportsStreaming: true,
        supportsImages: models.find((m) => m.id === model)?.supportsImages ?? false,
      });
      setShowAdd(false);
      setApiKey('');
      await loadConfigs();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(configId: string) {
    setTesting(configId);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message: string; latencyMs: number }>(`/ai-providers/${configId}/test`);
      setTestResult({ id: configId, ...result });
    } catch (error) {
      setTestResult({ id: configId, success: false, message: 'Failed to test connection' });
    } finally {
      setTesting(null);
    }
  }

  async function handleDelete(configId: string) {
    if (!confirm('Remove this AI provider?')) return;
    try {
      await api.delete(`/ai-providers/${configId}`);
      await loadConfigs();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  async function handleSetDefault(configId: string) {
    try {
      await api.patch(`/ai-providers/${configId}`, { isDefault: true });
      await loadConfigs();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  }

  const selectedModelInfo = models.find((m) => m.id === model);
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.A / 14"
        eyebrow="§ 07.A · ENGINE ROOM"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>brains <em>on</em> retainer.</>}
        lead="LLMs that read the failure, write the fix, interpret the story. Anthropic, OpenAI, Gemini, OpenRouter, or a local Ollama — all pluggable."
        actions={
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <button className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                ADD PROVIDER
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add AI Provider</DialogTitle>
                <DialogDescription>Configure a new LLM provider for AI-powered features.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="PROVIDER">
                  <select className="vt-input" value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="ANTHROPIC">Anthropic (Claude)</option>
                    <option value="OPENAI">OpenAI (GPT)</option>
                    <option value="GEMINI">Google Gemini</option>
                    <option value="OPENROUTER">OpenRouter</option>
                    <option value="LOCAL">Local LLM (Ollama)</option>
                  </select>
                </Field>

                <Field label="DISPLAY NAME">
                  <input className="vt-input" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>

                {defaults[provider]?.requiresApiKey && (
                  <Field label="API KEY">
                    <div className="flex items-stretch gap-2">
                      <input
                        className="vt-input flex-1"
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          provider === 'ANTHROPIC'
                            ? 'sk-ant-...'
                            : provider === 'OPENAI'
                            ? 'sk-...'
                            : provider === 'GEMINI'
                            ? 'AIza...'
                            : 'sk-or-...'
                        }
                      />
                      <button
                        type="button"
                        className="vt-btn"
                        style={{ padding: '8px 12px' }}
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                )}

                {(provider === 'LOCAL' || provider === 'OPENROUTER') && (
                  <Field label="BASE URL">
                    <input
                      className="vt-input"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={defaults[provider]?.baseUrl || ''}
                    />
                  </Field>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9.5px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      MODEL
                    </div>
                    <button
                      type="button"
                      className="vt-btn vt-btn--ghost"
                      style={{ padding: '4px 10px', fontSize: '9.5px' }}
                      onClick={fetchModels}
                      disabled={loadingModels}
                    >
                      {loadingModels ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      {apiKey || provider === 'LOCAL' ? 'REFRESH' : 'LOAD'}
                    </button>
                  </div>
                  <select className="vt-input" value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="">Select a model</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {selectedModelInfo && (
                    <div
                      className="mt-2"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        letterSpacing: '0.1em',
                        color: 'var(--ink-2)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedModelInfo.contextWindow && (
                        <>CTX · {(selectedModelInfo.contextWindow / 1000).toFixed(0)}K · </>
                      )}
                      {selectedModelInfo.maxOutputTokens && (
                        <>OUT · {(selectedModelInfo.maxOutputTokens / 1000).toFixed(0)}K · </>
                      )}
                      {selectedModelInfo.supportsImages && <>VISION · Y</>}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="MAX TOKENS">
                    <input
                      className="vt-input"
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                    />
                  </Field>
                  <Field label="MAX RUNTIME · SEC">
                    <input
                      className="vt-input"
                      type="number"
                      value={maxRuntime}
                      onChange={(e) => setMaxRuntime(parseInt(e.target.value) || 120)}
                    />
                  </Field>
                </div>

                <Field label={`TEMPERATURE · ${temperature.toFixed(2)}`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div
                    className="flex justify-between mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9.5px',
                      letterSpacing: '0.18em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>PRECISE · 0</span>
                    <span>CREATIVE · 1</span>
                  </div>
                </Field>

                <div
                  className="flex items-center justify-between p-3"
                  style={{ border: '1px solid var(--rule)' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-0)',
                    }}
                  >
                    SET AS DEFAULT
                  </div>
                  <SegmentedToggle checked={isDefault} onChange={setIsDefault} />
                </div>
              </div>
              <DialogFooter>
                <button className="vt-btn" onClick={() => setShowAdd(false)}>CANCEL</button>
                <button className="vt-btn vt-btn--primary" onClick={handleSave} disabled={saving || !model}>
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  ADD PROVIDER
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <section aria-labelledby="providers-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="providers-head">providers on file</span>
            <span className="rule" />
            <span className="stamp">{configs.length.toString().padStart(2, '0')} CONFIGURED</span>
          </div>

          {loading ? (
            <LoadingFrame />
          ) : configs.length === 0 ? (
            <EmptyFrame
              title="no ai providers configured."
              body="Add one to enable intelligent failure analysis and autonomous fix generation. Without an AI provider, classification falls back to rule-based heuristics."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[70px_1fr_180px_180px_160px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['CODE', 'NAME · MODEL', 'KEY', 'TEMP · TOKENS', 'STATUS'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{ borderRight: i < 4 ? '1px solid var(--rule)' : 'none' }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {configs.map((config, i) => (
                <div
                  key={config.id}
                  style={{
                    borderBottom: i < configs.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    opacity: config.isActive ? 1 : 0.5,
                  }}
                >
                  <div className="grid grid-cols-[70px_1fr_180px_180px_160px] gap-0 items-center">
                    <div
                      className="py-4 px-4"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        letterSpacing: '0.18em',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {PROVIDER_CODE[config.provider] || 'AI'}
                    </div>
                    <div
                      className="py-3 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '16px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {config.name}
                        {config.isDefault && (
                          <span
                            className="ml-2 vt-rev-stamp"
                            style={{ fontSize: '9px', padding: '2px 6px', verticalAlign: 'middle' }}
                          >
                            <Star className="w-2.5 h-2.5" strokeWidth={1.5} /> DEFAULT
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-1 vt-mono"
                        style={{
                          fontSize: '10.5px',
                          letterSpacing: '0.06em',
                          color: 'var(--ink-2)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {config.provider} · {config.model}
                      </div>
                    </div>
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11px',
                        color: config.hasApiKey ? 'var(--ink-1)' : 'var(--ink-2)',
                      }}
                    >
                      {config.hasApiKey ? '••••••••••' : '—'}
                    </div>
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11px',
                        color: 'var(--ink-1)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      T {config.temperature} · {config.maxTokens}
                    </div>
                    <div className="py-4 px-4">
                      {config.isActive ? (
                        <span className="vt-chip vt-chip--pass" style={{ fontSize: '9.5px' }}>
                          CONNECTED
                        </span>
                      ) : (
                        <span className="vt-chip" style={{ fontSize: '9.5px' }}>
                          UNCONFIGURED
                        </span>
                      )}
                    </div>
                  </div>

                  {testResult?.id === config.id && (
                    <div
                      className="px-4 py-3 vt-mono"
                      style={{
                        background: testResult.success ? 'var(--pass-soft)' : 'var(--fail-soft)',
                        color: testResult.success ? 'var(--pass)' : 'var(--fail)',
                        fontSize: '11px',
                        letterSpacing: '0.04em',
                        borderTop: '1px solid var(--rule-soft)',
                      }}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-2" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 inline mr-2" />
                      )}
                      {testResult.message}
                    </div>
                  )}

                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
                    }}
                  >
                    <button
                      className="vt-btn"
                      style={{ padding: '6px 12px', fontSize: '10px' }}
                      onClick={() => handleTest(config.id)}
                      disabled={testing === config.id}
                    >
                      {testing === config.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      TEST
                    </button>
                    {!config.isDefault && (
                      <button
                        className="vt-btn"
                        style={{ padding: '6px 12px', fontSize: '10px' }}
                        onClick={() => handleSetDefault(config.id)}
                      >
                        <Star className="w-3 h-3" /> SET DEFAULT
                      </button>
                    )}
                    <button
                      className="vt-btn vt-btn--ghost"
                      style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--fail)' }}
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="w-3 h-3" /> REMOVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </EditorialHero>
    </VtStage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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
          padding: '6px 14px',
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
          padding: '6px 14px',
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

function EmptyFrame({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div className="vt-kicker" style={{ color: 'var(--ink-2)', justifyContent: 'center' }}>
        PLATE EMPTY
      </div>
      <h3
        className="mt-3"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 2.4vw, 32px)',
          color: 'var(--ink-0)',
        }}
      >
        {title}
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
        {body}
      </p>
    </div>
  );
}
