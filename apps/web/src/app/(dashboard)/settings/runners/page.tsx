'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Plus, Trash2, Loader2, Activity } from 'lucide-react';
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

interface RunnerData {
  id: string;
  name: string;
  type: string;
  status: string;
  version: string | null;
  capabilities: Record<string, unknown> | null;
  lastHeartbeatAt: string | null;
  lastJobAt: string | null;
  registeredAt: string;
  project?: { id: string; name: string } | null;
}

const statusToken: Record<string, 'pass' | 'fail' | 'warn' | 'accent' | 'mute'> = {
  OFFLINE: 'mute',
  STARTING: 'warn',
  READY: 'pass',
  BUSY: 'accent',
  DEGRADED: 'warn',
  DRAINING: 'accent',
  UNHEALTHY: 'fail',
};

export default function RunnersPage() {
  const { project: currentProject } = useCurrentProject();
  const [runners, setRunners] = useState<RunnerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('SELF_HOSTED');

  useEffect(() => {
    loadRunners();
  }, [currentProject?.id]);

  async function loadRunners() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentProject?.id) params.projectId = currentProject.id;
      const data = await api.get<RunnerData[]>('/fix-runners', params);
      setRunners(data || []);
    } catch (error) {
      console.error('Failed to load runners:', error);
      setRunners([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!name) return;
    setAddLoading(true);
    try {
      await api.post('/fix-runners/register', {
        projectId: currentProject?.id,
        name,
        type,
      });
      setShowAdd(false);
      setName('');
      await loadRunners();
    } catch (error) {
      console.error('Failed to register runner:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDrain(runnerId: string) {
    try {
      await api.post(`/fix-runners/${runnerId}/drain`);
      await loadRunners();
    } catch (error) {
      console.error('Failed to drain runner:', error);
    }
  }

  async function handleDelete(runnerId: string) {
    if (!confirm('Deregister this runner?')) return;
    try {
      await api.delete(`/fix-runners/${runnerId}`);
      await loadRunners();
    } catch (error) {
      console.error('Failed to deregister runner:', error);
    }
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.G / 14"
        eyebrow="§ 07.G · CREW"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>the <em>stagehands</em>.</>}
        lead="Where fix sessions actually execute — your CI, a local sandbox, a self-hosted runner. Jobs wait in a queue here until a runner picks them up."
        actions={
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <button className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                REGISTER RUNNER
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register Fix Runner</DialogTitle>
                <DialogDescription>Add a runner to execute fix sessions and verifications.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="RUNNER NAME">
                  <input
                    className="vt-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-runner-01"
                  />
                </Field>
                <Field label="RUNNER TYPE">
                  <select className="vt-input" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="MANAGED">Managed</option>
                    <option value="SELF_HOSTED">Self-Hosted</option>
                    <option value="LOCAL">Local</option>
                  </select>
                </Field>
              </div>
              <DialogFooter>
                <button className="vt-btn" onClick={() => setShowAdd(false)}>CANCEL</button>
                <button className="vt-btn vt-btn--primary" onClick={handleRegister} disabled={addLoading || !name}>
                  {addLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  REGISTER
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <section aria-labelledby="runners-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="runners-head">crew on call</span>
            <span className="rule" />
            <span className="stamp">{runners.length.toString().padStart(2, '0')} REGISTERED</span>
          </div>

          {loading ? (
            <LoadingFrame />
          ) : runners.length === 0 ? (
            <EmptyFrame
              title="no runners registered."
              body="Register a runner to execute fix sessions in your CI, a sandbox, or a local environment."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[90px_1fr_160px_180px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['CODE', 'HOST · NAME', 'TYPE · VERSION', 'STATUS · HEARTBEAT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{ borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {runners.map((runner, i) => {
                const tok = statusToken[runner.status] || 'mute';
                const chipCls =
                  tok === 'pass'
                    ? 'vt-chip vt-chip--pass'
                    : tok === 'fail'
                    ? 'vt-chip vt-chip--fail'
                    : tok === 'warn'
                    ? 'vt-chip vt-chip--warn'
                    : tok === 'accent'
                    ? 'vt-chip vt-chip--accent'
                    : 'vt-chip';
                return (
                  <div
                    key={runner.id}
                    style={{
                      borderBottom: i < runners.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    }}
                  >
                    <div className="grid grid-cols-[90px_1fr_160px_180px] gap-0 items-center">
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
                        RN-{String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="py-4 px-4" style={{ borderRight: '1px solid var(--rule-soft)' }}>
                        <div
                          className="vt-mono"
                          style={{
                            fontSize: '13px',
                            color: 'var(--ink-0)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {runner.name}
                        </div>
                        {runner.capabilities && Object.keys(runner.capabilities).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(runner.capabilities as any).languages?.map((lang: string) => (
                              <span key={lang} className="vt-chip" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                {lang}
                              </span>
                            ))}
                            {(runner.capabilities as any).browsers?.map((browser: string) => (
                              <span key={browser} className="vt-chip" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                {browser}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        className="py-4 px-4"
                        style={{ borderRight: '1px solid var(--rule-soft)' }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10.5px',
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-1)',
                          }}
                        >
                          {runner.type.replace(/_/g, ' ')}
                        </div>
                        <div
                          className="mt-1 vt-mono"
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--ink-2)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {runner.version ? `v${runner.version}` : '— · no version'}
                        </div>
                      </div>
                      <div className="py-4 px-4">
                        <span
                          className={chipCls}
                          style={{ fontSize: '9.5px' }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: 6,
                              height: 6,
                              background: 'currentColor',
                              transform: 'rotate(45deg)',
                            }}
                          />
                          {runner.status}
                        </span>
                        {runner.lastHeartbeatAt && (
                          <div
                            className="mt-2 vt-mono"
                            style={{
                              fontSize: '9.5px',
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-2)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            HB · {new Date(runner.lastHeartbeatAt).toISOString().slice(0, 16).replace('T', ' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="px-4 py-3 flex items-center gap-2"
                      style={{
                        borderTop: '1px solid var(--rule-soft)',
                        background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
                      }}
                    >
                      {runner.status === 'READY' && (
                        <button
                          className="vt-btn"
                          style={{ padding: '6px 12px', fontSize: '10px' }}
                          onClick={() => handleDrain(runner.id)}
                        >
                          <Activity className="w-3 h-3" /> DRAIN
                        </button>
                      )}
                      <button
                        className="vt-btn vt-btn--ghost"
                        style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--fail)' }}
                        onClick={() => handleDelete(runner.id)}
                      >
                        <Trash2 className="w-3 h-3" /> DEREGISTER
                      </button>
                    </div>
                  </div>
                );
              })}
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
