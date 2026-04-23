'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Play,
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  X,
} from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { useCurrentProject } from '@/hooks/useProject';
import { webhooksApi, type Webhook, type WebhookEvent } from '@/lib/api';
import { toast } from 'sonner';

const WEBHOOK_EVENTS: Array<{ value: WebhookEvent; label: string; description: string }> = [
  { value: 'TEST_PASSED', label: 'Test Passed', description: 'When a test passes' },
  { value: 'TEST_FAILED', label: 'Test Failed', description: 'When a test fails' },
  { value: 'BASELINE_UPDATED', label: 'Baseline Updated', description: 'When a baseline is approved' },
  { value: 'SCHEDULE_COMPLETED', label: 'Schedule Completed', description: 'When a scheduled run finishes' },
  { value: 'FLAKY_DETECTED', label: 'Flaky Detected', description: 'When a test is marked as flaky' },
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks', project?.id],
    queryFn: () => webhooksApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; url: string; events: string[]; projectId: string }) =>
      webhooksApi.create(data),
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', project?.id] });
      if (webhook.secret) {
        setNewSecret(webhook.secret);
      }
      setNewWebhook({ name: '', url: '', events: [] });
      setCreateOpen(false);
      toast.success('Webhook created');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create webhook');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      webhooksApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', project?.id] });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to update webhook');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', project?.id] });
      toast.success('Webhook deleted');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete webhook');
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.test(id),
    onMutate: (id) => setTestingId(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Test successful - Response: ${result.statusCode}`);
      } else {
        toast.error(result.error || `Test failed - Status: ${result.statusCode}`);
      }
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to test webhook');
    },
    onSettled: () => setTestingId(null),
  });

  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim() || newWebhook.events.length === 0) {
      toast.error('Fill all required fields and select at least one event');
      return;
    }
    createMutation.mutate({
      ...newWebhook,
      projectId: project!.id,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!project) {
    return (
      <VtStage width="narrow">
        <EditorialHero
          width="narrow"
          sheet="W-00"
          eyebrow="§ WIRING · WEBHOOKS"
          revision={<>REV · 01 · {isoDate}</>}
          title={<>no <em>project</em> selected.</>}
          lead="Webhooks are scoped to a project. Pick one from the switcher and the wiring diagram will redraw."
        />
      </VtStage>
    );
  }

  const list = (webhooks || []) as Webhook[];
  const activeCount = list.filter((w) => w.isActive).length;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`W-${String(list.length).padStart(2, '0')}`}
        eyebrow="§ WIRING · WEBHOOKS"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            signal <em>wiring</em>.
          </>
        }
        lead="Every failed test, every approved change, every scheduled run — a signed JSON payload is posted to the target URL. Each row below is one wire."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="vt-btn vt-btn--primary"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            NEW WIRE
          </button>
        }
      >
        {/* ── Title block ───────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">ENDPOINT SHEET</span>
            <span className="v">VT-W-{(project.slug || project.id.slice(-8)).toUpperCase()}</span>
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
            <span className="k">WIRES · TOTAL</span>
            <span className="v">{String(list.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">ACTIVE</span>
            <span className="v" style={{ color: activeCount > 0 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {String(activeCount).padStart(2, '0')}
            </span>
          </div>
          <div>
            <span className="k">HMAC</span>
            <span className="v">SHA-256</span>
          </div>
        </div>

        {/* ── Secret reveal after creation ──────────────────────────── */}
        {newSecret && (
          <div
            style={{
              border: '1px solid var(--accent)',
              background: 'var(--accent-soft)',
              padding: '20px 24px',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span
                className="vt-mono"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                SECRET · SHOWN ONCE
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-1)',
                marginBottom: '14px',
              }}
            >
              Copy this now. Used to verify webhook signatures. After you close this, only a hash remains.
            </p>
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
                {newSecret}
              </code>
              <button
                type="button"
                className="vt-btn"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret);
                  toast.success('Secret copied');
                }}
              >
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                COPY
              </button>
              <button
                type="button"
                className="vt-btn vt-btn--ghost"
                onClick={() => setNewSecret(null)}
              >
                SAVED
              </button>
            </div>
          </div>
        )}

        {/* ── Wires ledger ──────────────────────────────────────────── */}
        <section aria-labelledby="wires-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="wires-head">schedule of wires</span>
            <span className="rule" />
            <span className="stamp">{String(list.length).padStart(2, '0')} · ENDPOINTS</span>
          </div>

          {isLoading ? (
            <LoadingFrame label="LOADING WIRE DIAGRAM" />
          ) : list.length === 0 ? (
            <EmptyFrame
              label="NO WIRES CONFIGURED"
              body="Add a webhook to route events into CI, chat, or a custom receiver."
              action={
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="vt-btn vt-btn--primary"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  ADD FIRST WIRE
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
              {/* header row */}
              <div
                className="grid grid-cols-[90px_1fr_150px_130px_140px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['WIRE', 'TARGET · EVENTS', 'LAST FIRE', 'STATE', 'ACTIONS'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 4 ? '1px solid var(--rule)' : 'none',
                      textAlign: i >= 3 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {list.map((webhook, idx) => (
                <div key={webhook.id}>
                  <div
                    className="grid grid-cols-[90px_1fr_150px_130px_140px] gap-0"
                    style={{
                      borderBottom:
                        idx < list.length - 1 || expandedWebhookId === webhook.id
                          ? '1px solid var(--rule-soft)'
                          : 'none',
                      opacity: webhook.isActive ? 1 : 0.6,
                    }}
                  >
                    <div
                      className="py-4 px-4"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        letterSpacing: '0.14em',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      W-{String(idx + 1).padStart(3, '0')}
                    </div>
                    <div
                      className="py-4 px-4 min-w-0"
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
                        {webhook.name}
                      </div>
                      <div
                        className="vt-mono truncate"
                        style={{
                          fontSize: '11px',
                          color: 'var(--ink-1)',
                          letterSpacing: '0.02em',
                          marginBottom: '8px',
                        }}
                      >
                        {webhook.url}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="vt-chip"
                            style={{ fontSize: '9px', padding: '2px 7px' }}
                          >
                            {event.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {webhook.failureCount > 0 && (
                          <span
                            className="vt-chip vt-chip--fail"
                            style={{ fontSize: '9px', padding: '2px 7px' }}
                          >
                            {webhook.failureCount} FAIL
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '10.5px',
                        letterSpacing: '0.08em',
                        color: 'var(--ink-2)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {webhook.lastTriggered
                        ? new Date(webhook.lastTriggered)
                            .toISOString()
                            .slice(0, 16)
                            .replace('T', ' · ')
                        : '— · NEVER'}
                    </div>
                    <div
                      className="py-4 px-4 text-right"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <label
                        className="inline-flex items-center gap-2 cursor-pointer"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color: webhook.isActive ? 'var(--pass)' : 'var(--ink-2)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={webhook.isActive}
                          onChange={(e) =>
                            toggleMutation.mutate({
                              id: webhook.id,
                              isActive: e.target.checked,
                            })
                          }
                          style={{
                            width: '14px',
                            height: '14px',
                            accentColor: 'var(--accent)',
                          }}
                        />
                        {webhook.isActive ? 'LIVE' : 'OFF'}
                      </label>
                    </div>
                    <div className="py-3 px-3 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => testMutation.mutate(webhook.id)}
                        disabled={testingId === webhook.id}
                        className="vt-btn vt-btn--ghost"
                        style={{ padding: '6px 10px', fontSize: '10px' }}
                        title="Test wire"
                      >
                        {testingId === webhook.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedWebhookId(
                            expandedWebhookId === webhook.id ? null : webhook.id
                          )
                        }
                        className="vt-btn vt-btn--ghost"
                        style={{ padding: '6px 10px', fontSize: '10px' }}
                      >
                        LOG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(webhook.id)}
                        className="vt-btn vt-btn--ghost"
                        style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--fail)' }}
                        title="Remove wire"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  {expandedWebhookId === webhook.id && (
                    <div
                      style={{
                        borderBottom:
                          idx < list.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                        background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)',
                        padding: '18px 24px',
                      }}
                    >
                      <DeliveryHistory webhookId={webhook.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Signature reference ───────────────────────────────────── */}
        <section aria-labelledby="sig-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="sig-head">signature verification</span>
            <span className="rule" />
            <span className="stamp">DETAIL A · HMAC-SHA256</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              padding: '24px 28px',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--pass)' }} />
              <span
                className="vt-mono"
                style={{
                  fontSize: '10.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                HEADER · X-VISIONTEST-SIGNATURE
              </span>
            </div>
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
{`const crypto = require('crypto');
const signature = req.headers['x-visiontest-signature'];
const expected = 'sha256=' + crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (signature !== expected) throw new Error('Invalid signature');`}
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
          <span>SHEET · WIRING · {project.name}</span>
          <span>CHECKED · {(project.slug || 'VT').toUpperCase()}</span>
          <span>HMAC · SHA-256</span>
        </footer>
      </EditorialHero>

      {/* ── Create dialog ─────────────────────────────────────────── */}
      {createOpen && (
        <CreateDialog
          newWebhook={newWebhook}
          setNewWebhook={setNewWebhook}
          toggleEvent={toggleEvent}
          handleCreate={handleCreate}
          onClose={() => setCreateOpen(false)}
          pending={createMutation.isPending}
        />
      )}
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function DeliveryHistory({ webhookId }: { webhookId: string }) {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => webhooksApi.deliveries(webhookId),
  });

  if (isLoading) {
    return (
      <div
        className="vt-mono"
        style={{
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        LOADING DELIVERIES…
      </div>
    );
  }
  if (!deliveries?.length) {
    return (
      <div
        className="vt-mono"
        style={{
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        NO DELIVERIES ON FILE
      </div>
    );
  }

  return (
    <div>
      <div
        className="vt-mono mb-3"
        style={{
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        DELIVERY LOG · LAST {Math.min(deliveries.length, 10)}
      </div>
      <div>
        {deliveries.slice(0, 10).map((d, i) => (
          <div
            key={d.id}
            className="grid grid-cols-[80px_1fr_80px_180px] items-center py-2"
            style={{
              borderTop: i === 0 ? '1px solid var(--rule-soft)' : 'none',
              borderBottom: '1px solid var(--rule-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: d.success ? 'var(--pass)' : 'var(--fail)',
              }}
            >
              {d.success ? 'SENT' : 'FAIL'}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12.5px',
                color: 'var(--ink-1)',
              }}
            >
              {d.event?.replace(/_/g, ' ') || '—'}
            </span>
            <span
              style={{
                letterSpacing: '0.1em',
                color: 'var(--ink-1)',
                textAlign: 'right',
              }}
            >
              {d.statusCode ?? '—'}
            </span>
            <span
              style={{
                letterSpacing: '0.08em',
                color: 'var(--ink-2)',
                textTransform: 'uppercase',
                textAlign: 'right',
              }}
            >
              {new Date(d.createdAt).toISOString().slice(0, 16).replace('T', ' · ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function CreateDialog({
  newWebhook,
  setNewWebhook,
  toggleEvent,
  handleCreate,
  onClose,
  pending,
}: {
  newWebhook: { name: string; url: string; events: string[] };
  setNewWebhook: (v: any) => void;
  toggleEvent: (e: string) => void;
  handleCreate: () => void;
  onClose: () => void;
  pending: boolean;
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
              § NEW WIRE
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
              }}
            >
              configure endpoint
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
              value={newWebhook.name}
              onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
              placeholder="CI/CD integration"
              className="vt-input"
            />
          </div>
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
              ENDPOINT URL
            </label>
            <input
              type="url"
              value={newWebhook.url}
              onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
              placeholder="https://your-server.com/webhook"
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
              EVENTS · SELECT ONE OR MORE
            </div>
            <div style={{ border: '1px solid var(--rule)' }}>
              {WEBHOOK_EVENTS.map((event, i) => (
                <label
                  key={event.value}
                  className="flex items-start gap-3 cursor-pointer px-4 py-3"
                  style={{
                    borderBottom:
                      i < WEBHOOK_EVENTS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newWebhook.events.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
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
                      {event.label}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '12.5px',
                        color: 'var(--ink-2)',
                        marginTop: '2px',
                      }}
                    >
                      {event.description}
                    </div>
                  </div>
                </label>
              ))}
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
            onClick={handleCreate}
            disabled={pending}
            className="vt-btn vt-btn--primary"
          >
            {pending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                WIRING…
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                WIRE IT
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
