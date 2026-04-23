'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Copy,
  Trash2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { apiKeysApi } from '@/lib/api';
import { toast } from 'sonner';

const AVAILABLE_SCOPES = [
  { id: 'read', label: 'Read', description: 'Read tests, results, and configurations' },
  { id: 'write', label: 'Write', description: 'Create/update tests and configurations' },
  { id: 'execute', label: 'Execute', description: 'Trigger test executions' },
  { id: 'admin', label: 'Admin', description: 'Manage API keys and team settings' },
];

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [expiresIn, setExpiresIn] = useState('never');

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scopes: string[]; expiresIn?: string }) => {
      let expiresAt: string | undefined;
      if (data.expiresIn && data.expiresIn !== 'never') {
        const days = parseInt(data.expiresIn, 10);
        if (!isNaN(days)) {
          const date = new Date();
          date.setDate(date.getDate() + days);
          expiresAt = date.toISOString();
        }
      }
      return apiKeysApi.create({ name: data.name, scopes: data.scopes, expiresAt });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyVisible(data.key || data.rawKey);
      setName('');
      setScopes(['read']);
      setExpiresIn('never');
      toast.success('API key created');
    },
    onError: () => toast.error('Failed to create API key'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: () => toast.error('Failed to revoke API key'),
  });

  function toggleScope(scopeId: string) {
    setScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  const keys = (apiKeys as any[]) || [];
  const active = keys.filter((k) => !k.revokedAt && !(k.expiresAt && new Date(k.expiresAt) < new Date())).length;
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`K-${String(keys.length).padStart(2, '0')}`}
        eyebrow="§ KEYS · PROGRAMMATIC ACCESS"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            terminal <em>keys</em>.
          </>
        }
        lead="Keys are shown once when created, then stored only as a hash. Issue, rotate, revoke. The raw string never touches our disk twice."
        actions={
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setNewKeyVisible(null);
            }}
            className="vt-btn vt-btn--primary"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            ISSUE KEY
          </button>
        }
      >
        {/* ── Title block ───────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">SCOPE · ACCOUNT</span>
            <span className="v big">API credentials</span>
          </div>
          <div className="span2">
            <span className="k">HASH</span>
            <span className="v">SHA-256</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div className="span2">
            <span className="k">KEYS · TOTAL</span>
            <span className="v">{String(keys.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">ACTIVE</span>
            <span className="v" style={{ color: active > 0 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {String(active).padStart(2, '0')}
            </span>
          </div>
          <div>
            <span className="k">PREFIX</span>
            <span className="v">vt_</span>
          </div>
        </div>

        {/* ── Keys ledger ───────────────────────────────────────────── */}
        <section aria-labelledby="keys-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="keys-head">issued keys</span>
            <span className="rule" />
            <span className="stamp">{String(keys.length).padStart(2, '0')} · ON FILE</span>
          </div>

          {isLoading ? (
            <LoadingFrame label="READING KEY RING" />
          ) : keys.length === 0 ? (
            <EmptyFrame
              label="NO KEYS ISSUED"
              body="Create a key to call the API from CI, scripts, or third-party services."
              action={
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="vt-btn vt-btn--primary"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  ISSUE FIRST KEY
                </button>
              }
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[90px_1fr_180px_130px_140px_110px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['KEY', 'NAME · SCOPES', 'PREFIX', 'CREATED', 'LAST USED', 'STATE'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 5 ? '1px solid var(--rule)' : 'none',
                      textAlign: i >= 3 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {keys.map((key: any, idx: number) => {
                const isRevoked = !!key.revokedAt;
                const isExpired = key.expiresAt && new Date(key.expiresAt) < new Date();
                const disabled = isRevoked || isExpired;
                return (
                  <div
                    key={key.id}
                    className="grid grid-cols-[90px_1fr_180px_130px_140px_110px] gap-0"
                    style={{
                      borderBottom: idx < keys.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                      opacity: disabled ? 0.55 : 1,
                    }}
                  >
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11px',
                        letterSpacing: '0.14em',
                        color: 'var(--accent)',
                      }}
                    >
                      K-{String(idx + 1).padStart(3, '0')}
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '15px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                          marginBottom: '6px',
                        }}
                      >
                        {key.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(key.scopes || []).map((scope: string) => (
                          <span
                            key={scope}
                            className="vt-chip"
                            style={{ fontSize: '9px', padding: '2px 7px' }}
                          >
                            {scope.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div
                      className="py-4 px-4 vt-mono truncate"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11.5px',
                        letterSpacing: '0.04em',
                        color: 'var(--ink-1)',
                      }}
                    >
                      vt_{key.keyPrefix}…
                    </div>
                    <div
                      className="py-4 px-4 vt-mono text-right"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '10.5px',
                        letterSpacing: '0.08em',
                        color: 'var(--ink-2)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {new Date(key.createdAt).toISOString().slice(0, 10).replace(/-/g, '.')}
                    </div>
                    <div
                      className="py-4 px-4 vt-mono text-right"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '10.5px',
                        letterSpacing: '0.08em',
                        color: 'var(--ink-2)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toISOString().slice(0, 10).replace(/-/g, '.')
                        : '—'}
                    </div>
                    <div className="py-3 px-3 flex items-center justify-end gap-1">
                      {isRevoked ? (
                        <span className="vt-chip vt-chip--fail" style={{ fontSize: '9px' }}>
                          REVOKED
                        </span>
                      ) : isExpired ? (
                        <span className="vt-chip vt-chip--warn" style={{ fontSize: '9px' }}>
                          EXPIRED
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => revokeMutation.mutate(key.id)}
                          className="vt-btn vt-btn--ghost"
                          style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--fail)' }}
                          title="Revoke key"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          REVOKE
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Usage ─────────────────────────────────────────────────── */}
        <section aria-labelledby="usage-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="usage-head">invoking the api</span>
            <span className="rule" />
            <span className="stamp">DETAIL B · HEADER</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              padding: '24px 28px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-1)',
                marginBottom: '14px',
              }}
            >
              Include your key in the{' '}
              <code
                className="vt-mono"
                style={{
                  color: 'var(--accent)',
                  padding: '2px 6px',
                  border: '1px solid var(--rule)',
                  fontSize: '12px',
                }}
              >
                X-API-Key
              </code>{' '}
              header:
            </p>
            <pre
              className="vt-mono"
              style={{
                padding: '14px 16px',
                background: 'var(--bg-0)',
                border: '1px solid var(--rule)',
                fontSize: '12px',
                color: 'var(--ink-1)',
                overflowX: 'auto',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
{`curl -H "X-API-Key: vt_your_key_here" \\
     https://your-api.example.com/api/v1/tests`}
            </pre>
          </div>
        </section>

        {/* ── Colophon ──────────────────────────────────────────────── */}
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
          <span>SHEET · KEYS</span>
          <span>HASH · SHA-256</span>
          <span>ONE-SHOT REVEAL · STORE SAFELY</span>
        </footer>
      </EditorialHero>

      {createOpen && (
        <CreateKeyDialog
          name={name}
          setName={setName}
          scopes={scopes}
          toggleScope={toggleScope}
          expiresIn={expiresIn}
          setExpiresIn={setExpiresIn}
          newKeyVisible={newKeyVisible}
          pending={createMutation.isPending}
          onCreate={() =>
            createMutation.mutate({
              name,
              scopes,
              expiresIn: expiresIn === 'never' ? undefined : expiresIn,
            })
          }
          onClose={() => {
            setCreateOpen(false);
            setNewKeyVisible(null);
          }}
          copyToClipboard={copyToClipboard}
        />
      )}
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function EmptyFrame({
  label,
  body,
  action,
}: {
  label: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 20%, transparent)',
      }}
    >
      <div
        className="vt-mono"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>
      <p
        className="mx-auto mt-4"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-1)',
          maxWidth: '52ch',
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 20%, transparent)',
      }}
    >
      <Loader2
        className="w-5 h-5 animate-spin mx-auto mb-4"
        strokeWidth={1.5}
        style={{ color: 'var(--ink-2)' }}
      />
      <div
        className="vt-mono"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function CreateKeyDialog({
  name,
  setName,
  scopes,
  toggleScope,
  expiresIn,
  setExpiresIn,
  newKeyVisible,
  pending,
  onCreate,
  onClose,
  copyToClipboard,
}: {
  name: string;
  setName: (v: string) => void;
  scopes: string[];
  toggleScope: (id: string) => void;
  expiresIn: string;
  setExpiresIn: (v: string) => void;
  newKeyVisible: string | null;
  pending: boolean;
  onCreate: () => void;
  onClose: () => void;
  copyToClipboard: (s: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'color-mix(in oklab, var(--bg-3) 75%, transparent)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px]"
        style={{
          border: '1px solid var(--rule-strong)',
          background: 'var(--bg-1)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--rule)' }}
        >
          <div>
            <div
              className="vt-mono"
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: '4px',
              }}
            >
              § {newKeyVisible ? 'KEY ISSUED' : 'ISSUE KEY'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
              }}
            >
              {newKeyVisible ? 'copy now — once only' : 'configure credential'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="vt-btn vt-btn--ghost"
            style={{ padding: '6px 10px' }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {newKeyVisible ? (
          <>
            <div className="px-6 py-5">
              <div
                style={{
                  border: '1px solid var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '16px',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span
                    className="vt-mono"
                    style={{
                      fontSize: '10.5px',
                      letterSpacing: '0.24em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                    }}
                  >
                    SHOWN ONCE · NOT RECOVERABLE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code
                    className="vt-mono flex-1"
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-0)',
                      border: '1px solid var(--rule)',
                      fontSize: '12px',
                      color: 'var(--ink-0)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {newKeyVisible}
                  </code>
                  <button
                    type="button"
                    className="vt-btn"
                    onClick={() => copyToClipboard(newKeyVisible)}
                  >
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                    COPY
                  </button>
                </div>
              </div>
            </div>
            <div
              className="px-6 py-4 flex items-center justify-end"
              style={{ borderTop: '1px solid var(--rule)' }}
            >
              <button type="button" onClick={onClose} className="vt-btn vt-btn--primary">
                SAVED — CLOSE
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label
                  className="vt-mono block mb-2"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  NAME
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., CI/CD pipeline"
                  className="vt-input"
                />
              </div>
              <div>
                <div
                  className="vt-mono mb-3"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  SCOPES
                </div>
                <div style={{ border: '1px solid var(--rule)' }}>
                  {AVAILABLE_SCOPES.map((scope, i) => (
                    <label
                      key={scope.id}
                      className="flex items-start gap-3 cursor-pointer px-4 py-3"
                      style={{
                        borderBottom:
                          i < AVAILABLE_SCOPES.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={scopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        style={{ marginTop: '3px', accentColor: 'var(--accent)' }}
                      />
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-0)',
                          }}
                        >
                          {scope.label}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '12.5px',
                            color: 'var(--ink-2)',
                            marginTop: '2px',
                          }}
                        >
                          {scope.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div
                  className="vt-mono mb-3"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  EXPIRATION
                </div>
                <div className="grid grid-cols-4 gap-0" style={{ border: '1px solid var(--rule)' }}>
                  {EXPIRATION_OPTIONS.map((opt, i) => {
                    const active = expiresIn === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setExpiresIn(opt.value)}
                        style={{
                          padding: '12px 10px',
                          borderRight:
                            i < EXPIRATION_OPTIONS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                          background: active ? 'var(--accent-soft)' : 'transparent',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10.5px',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color: active ? 'var(--accent)' : 'var(--ink-1)',
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div
              className="px-6 py-4 flex items-center justify-end gap-2"
              style={{ borderTop: '1px solid var(--rule)' }}
            >
              <button type="button" onClick={onClose} className="vt-btn vt-btn--ghost">
                CANCEL
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={!name.trim() || scopes.length === 0 || pending}
                className="vt-btn vt-btn--primary"
              >
                {pending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                    ISSUING…
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    ISSUE KEY
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
