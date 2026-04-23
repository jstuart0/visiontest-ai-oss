'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Plus, Trash2, Loader2, Star, Terminal } from 'lucide-react';
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

interface VerificationProfileData {
  id: string;
  name: string;
  description: string | null;
  preset: string;
  commands: { name: string; command: string; timeout?: number; required?: boolean }[];
  targetingStrategy: string;
  maxRuntimeSeconds: number;
  failurePolicy: string;
  isDefault: boolean;
}

const presetDescriptions: Record<string, string> = {
  fast: 'Rerun failing test + scoped lint. Fastest verification.',
  balanced: 'Fast + package tests + visual rerun. Recommended default.',
  strict: 'Balanced + smoke suite + broader typecheck. Most thorough.',
  custom: 'Custom set of verification commands.',
};

export default function VerificationProfilesPage() {
  const { project: currentProject } = useCurrentProject();
  const [profiles, setProfiles] = useState<VerificationProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preset, setPreset] = useState('balanced');
  const [commandsText, setCommandsText] = useState(
    'npm run lint\nnpx tsc --noEmit\nnpm test -- --related'
  );
  const [maxRuntime, setMaxRuntime] = useState('300');
  const [failurePolicy, setFailurePolicy] = useState('fail_closed');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (currentProject?.id) loadProfiles();
  }, [currentProject?.id]);

  async function loadProfiles() {
    if (!currentProject?.id) return;
    setLoading(true);
    try {
      const data = await api.get<VerificationProfileData[]>(
        '/fix-policies/verification-profiles',
        { projectId: currentProject.id }
      );
      setProfiles(data || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!currentProject?.id || !name) return;
    setAddLoading(true);
    try {
      const commands = commandsText
        .split('\n')
        .filter(Boolean)
        .map((line, i) => ({
          name: `Step ${i + 1}`,
          command: line.trim(),
          timeout: 60,
          required: true,
        }));

      await api.post('/fix-policies/verification-profiles', {
        projectId: currentProject.id,
        name,
        description: description || undefined,
        preset,
        commands,
        maxRuntimeSeconds: parseInt(maxRuntime),
        failurePolicy,
        isDefault,
      });
      setShowAdd(false);
      setName('');
      setDescription('');
      await loadProfiles();
    } catch (error) {
      console.error('Failed to create profile:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(profileId: string) {
    if (!confirm('Delete this verification profile?')) return;
    try {
      await api.delete(`/fix-policies/verification-profiles/${profileId}`);
      await loadProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.F / 14"
        eyebrow="§ 07.F · ASSAY"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>what to <em>check</em> before shipping.</>}
        lead="A verification profile is a protocol — the sequence of tests a proposed fix must pass before it’s considered safe."
        actions={
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <button className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                ADD PROFILE
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Verification Profile</DialogTitle>
                <DialogDescription>Define commands that verify a fix before it can be approved.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="NAME">
                  <input
                    className="vt-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Default verification"
                  />
                </Field>
                <Field label="DESCRIPTION">
                  <input
                    className="vt-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </Field>
                <Field label="PRESET">
                  <select className="vt-input" value={preset} onChange={(e) => setPreset(e.target.value)}>
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="strict">Strict</option>
                    <option value="custom">Custom</option>
                  </select>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    {presetDescriptions[preset]}
                  </p>
                </Field>
                <Field label="COMMANDS · ONE PER LINE">
                  <textarea
                    className="vt-input"
                    value={commandsText}
                    onChange={(e) => setCommandsText(e.target.value)}
                    style={{ minHeight: '100px', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="MAX RUNTIME · SEC">
                    <input
                      className="vt-input"
                      type="number"
                      value={maxRuntime}
                      onChange={(e) => setMaxRuntime(e.target.value)}
                    />
                  </Field>
                  <Field label="FAILURE POLICY">
                    <select
                      className="vt-input"
                      value={failurePolicy}
                      onChange={(e) => setFailurePolicy(e.target.value)}
                    >
                      <option value="fail_closed">Fail Closed</option>
                      <option value="fail_open">Fail Open</option>
                    </select>
                  </Field>
                </div>
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
                <button className="vt-btn vt-btn--primary" onClick={handleAdd} disabled={addLoading || !name}>
                  {addLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  CREATE
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <section aria-labelledby="profiles-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="profiles-head">protocols on file</span>
            <span className="rule" />
            <span className="stamp">{profiles.length.toString().padStart(2, '0')} PROFILES</span>
          </div>

          {loading ? (
            <LoadingFrame />
          ) : profiles.length === 0 ? (
            <EmptyFrame
              title="no verification profiles."
              body="Create a profile to define how fixes are verified before approval."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[90px_1fr_140px_100px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['CODE', 'PROFILE · NAME', 'PRESET', 'RULES'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{ borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {profiles.map((profile, i) => (
                <div
                  key={profile.id}
                  style={{
                    borderBottom: i < profiles.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div className="grid grid-cols-[90px_1fr_140px_100px] gap-0 items-center">
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
                      VP-{String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        className="flex items-center gap-2 flex-wrap"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '16px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {profile.name}
                        {profile.isDefault && (
                          <span
                            className="vt-rev-stamp"
                            style={{ fontSize: '9px', padding: '2px 6px' }}
                          >
                            <Star className="w-2.5 h-2.5" strokeWidth={1.5} /> DEFAULT
                          </span>
                        )}
                      </div>
                      {profile.description && (
                        <p
                          className="mt-2"
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '13.5px',
                            color: 'var(--ink-1)',
                            lineHeight: 1.5,
                          }}
                        >
                          {profile.description}
                        </p>
                      )}
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <span className="vt-chip" style={{ fontSize: '9.5px' }}>
                        {profile.preset}
                      </span>
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '22px',
                        color: 'var(--ink-0)',
                        fontVariantNumeric: 'tabular-nums',
                        textTransform: 'lowercase',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {String(profile.commands.length).padStart(2, '0')}
                    </div>
                  </div>

                  {/* commands strip */}
                  <div
                    className="px-4 py-3"
                    style={{
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
                    }}
                  >
                    <div
                      className="mb-2"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      PROTOCOL · STEPS
                    </div>
                    <div className="space-y-1">
                      {profile.commands.map((cmd, ci) => (
                        <div key={ci} className="flex items-center gap-2 flex-wrap">
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '9.5px',
                              letterSpacing: '0.18em',
                              color: 'var(--ink-2)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {String(ci + 1).padStart(2, '0')}
                          </span>
                          <Terminal className="w-3 h-3" style={{ color: 'var(--ink-2)' }} />
                          <code
                            className="vt-mono px-2 py-1"
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--ink-0)',
                              background: 'color-mix(in oklab, var(--bg-2) 45%, transparent)',
                              border: '1px solid var(--rule-soft)',
                            }}
                          >
                            {cmd.command}
                          </code>
                          {cmd.required && (
                            <span className="vt-chip" style={{ fontSize: '9px', padding: '2px 6px' }}>
                              REQUIRED
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-3 gap-0"
                    style={{
                      borderTop: '1px solid var(--rule-soft)',
                    }}
                  >
                    <DimCell k="MAX RUNTIME" v={`${profile.maxRuntimeSeconds}s`} />
                    <DimCell k="FAILURE" v={profile.failurePolicy.replace('_', ' ')} />
                    <DimCell k="TARGETING" v={profile.targetingStrategy} last />
                  </div>

                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{ borderTop: '1px solid var(--rule-soft)' }}
                  >
                    <button
                      className="vt-btn vt-btn--ghost"
                      style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--fail)' }}
                      onClick={() => handleDelete(profile.id)}
                    >
                      <Trash2 className="w-3 h-3" /> DELETE
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

function DimCell({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      className="py-3 px-4"
      style={{ borderRight: last ? 'none' : '1px solid var(--rule-soft)' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginBottom: '4px',
        }}
      >
        {k}
      </div>
      <div
        className="vt-mono"
        style={{
          fontSize: '12.5px',
          color: 'var(--ink-0)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {v}
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
