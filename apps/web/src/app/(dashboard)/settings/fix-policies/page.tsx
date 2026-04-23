'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Plus, Trash2, Loader2, Star } from 'lucide-react';
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

interface FixPolicyData {
  id: string;
  name: string;
  mode: string;
  maxFilesChanged: number;
  maxLinesChanged: number;
  allowedPaths: string[];
  blockedPaths: string[];
  allowDependencyChanges: boolean;
  allowLockfileChanges: boolean;
  allowMigrationChanges: boolean;
  requireHumanApproval: boolean;
  branchPrefix: string;
  isDefault: boolean;
  isActive: boolean;
  repoConnection?: { id: string; repoUrl: string } | null;
}

const modeDescriptions: Record<string, string> = {
  MANUAL: 'Manual investigation and fix only. No automation.',
  GUIDED: 'AI investigates and proposes fixes. Human approval required.',
  SEMI_AUTO: 'AI applies fixes to branches. Human approval before merge.',
  FULLY_AUTO: 'AI applies and merges high-confidence fixes automatically.',
};

export default function FixPoliciesPage() {
  const { project: currentProject } = useCurrentProject();
  const [policies, setPolicies] = useState<FixPolicyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const [name, setName] = useState('');
  const [mode, setMode] = useState('GUIDED');
  const [maxFilesChanged, setMaxFilesChanged] = useState('5');
  const [maxLinesChanged, setMaxLinesChanged] = useState('200');
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);
  const [branchPrefix, setBranchPrefix] = useState('visiontest/fix');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (currentProject?.id) loadPolicies();
  }, [currentProject?.id]);

  async function loadPolicies() {
    if (!currentProject?.id) return;
    setLoading(true);
    try {
      const data = await api.get<FixPolicyData[]>('/fix-policies', { projectId: currentProject.id });
      setPolicies(data || []);
    } catch (error) {
      console.error('Failed to load fix policies:', error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!currentProject?.id || !name) return;
    setAddLoading(true);
    try {
      await api.post('/fix-policies', {
        projectId: currentProject.id,
        name,
        mode,
        maxFilesChanged: parseInt(maxFilesChanged),
        maxLinesChanged: parseInt(maxLinesChanged),
        requireHumanApproval,
        branchPrefix,
        isDefault,
      });
      setShowAdd(false);
      setName('');
      await loadPolicies();
    } catch (error) {
      console.error('Failed to create fix policy:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(policyId: string) {
    if (!confirm('Delete this fix policy?')) return;
    try {
      await api.delete(`/fix-policies/${policyId}`);
      await loadPolicies();
    } catch (error) {
      console.error('Failed to delete fix policy:', error);
    }
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.E / 14"
        eyebrow="§ 07.E · CHARTER"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>what the <em>auto-fixer</em> may touch.</>}
        lead="Safety rails for automated fixing — which paths it can edit, which branches it can push to, how many attempts before it hands the case back to a human."
        actions={
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <button className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                ADD POLICY
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Fix Policy</DialogTitle>
                <DialogDescription>Define safety constraints for automated bug fixing.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="POLICY NAME">
                  <input
                    className="vt-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Default policy"
                  />
                </Field>
                <Field label="FIX MODE">
                  <select className="vt-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="MANUAL">Manual</option>
                    <option value="GUIDED">Guided</option>
                    <option value="SEMI_AUTO">Semi-Auto</option>
                    <option value="FULLY_AUTO">Fully Auto</option>
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
                    {modeDescriptions[mode]}
                  </p>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="MAX FILES CHANGED">
                    <input
                      className="vt-input"
                      type="number"
                      value={maxFilesChanged}
                      onChange={(e) => setMaxFilesChanged(e.target.value)}
                    />
                  </Field>
                  <Field label="MAX LINES CHANGED">
                    <input
                      className="vt-input"
                      type="number"
                      value={maxLinesChanged}
                      onChange={(e) => setMaxLinesChanged(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="BRANCH PREFIX">
                  <input
                    className="vt-input"
                    value={branchPrefix}
                    onChange={(e) => setBranchPrefix(e.target.value)}
                  />
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
                    REQUIRE HUMAN APPROVAL
                  </div>
                  <SegmentedToggle checked={requireHumanApproval} onChange={setRequireHumanApproval} />
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
        <section aria-labelledby="policies-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="policies-head">articles of the charter</span>
            <span className="rule" />
            <span className="stamp">{policies.length.toString().padStart(2, '0')} POLICIES</span>
          </div>

          {loading ? (
            <LoadingFrame />
          ) : policies.length === 0 ? (
            <EmptyFrame
              title="no fix policies configured."
              body="Add a policy to control how automated fixes are generated, which files they can touch, and when they need a human to sign off."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[80px_1fr_140px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['ARTICLE', 'SCOPE · RULE BODY', 'MODE'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{ borderRight: i < 2 ? '1px solid var(--rule)' : 'none' }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {policies.map((policy, i) => (
                <div
                  key={policy.id}
                  style={{
                    borderBottom: i < policies.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div className="grid grid-cols-[80px_1fr_140px] gap-0">
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
                      ART-{String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="py-4 px-4" style={{ borderRight: '1px solid var(--rule-soft)' }}>
                      <div
                        className="flex items-center gap-2 flex-wrap"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '16px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {policy.name}
                        {policy.isDefault && (
                          <span
                            className="vt-rev-stamp"
                            style={{ fontSize: '9px', padding: '2px 6px' }}
                          >
                            <Star className="w-2.5 h-2.5" strokeWidth={1.5} /> DEFAULT
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-2"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13.5px',
                          color: 'var(--ink-1)',
                          lineHeight: 1.5,
                        }}
                      >
                        {modeDescriptions[policy.mode]}
                      </p>
                    </div>
                    <div className="py-4 px-4">
                      <span className="vt-chip" style={{ fontSize: '9.5px' }}>
                        {policy.mode.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-4 gap-0"
                    style={{
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
                    }}
                  >
                    <DimCell k="MAX FILES" v={String(policy.maxFilesChanged).padStart(2, '0')} />
                    <DimCell k="MAX LINES" v={String(policy.maxLinesChanged).padStart(3, '0')} />
                    <DimCell k="BRANCH" v={policy.branchPrefix} mono />
                    <DimCell
                      k="HUMAN APPROVAL"
                      v={policy.requireHumanApproval ? 'REQUIRED' : 'OPTIONAL'}
                      last
                    />
                  </div>

                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{
                      borderTop: '1px solid var(--rule-soft)',
                    }}
                  >
                    <button
                      className="vt-btn vt-btn--ghost"
                      style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--fail)' }}
                      onClick={() => handleDelete(policy.id)}
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

function DimCell({
  k,
  v,
  mono,
  last,
}: {
  k: string;
  v: string;
  mono?: boolean;
  last?: boolean;
}) {
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
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
          fontSize: mono ? '12px' : '18px',
          color: 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
          textTransform: mono ? 'none' : 'lowercase',
          letterSpacing: mono ? '0.04em' : '-0.01em',
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
