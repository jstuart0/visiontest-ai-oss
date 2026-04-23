'use client';

// Workflows — Sheet · Automation circuits.
// Each workflow = a numbered diagram block with a trigger → step stepper
// (drawn from the data we have) and a ruled title plate.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Edit,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentProject } from '@/hooks/useProject';
import { workflowsApi } from '@/lib/api';
import { toast } from 'sonner';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function WorkflowsPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows', project?.id],
    queryFn: () => workflowsApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; projectId: string }) =>
      workflowsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setCreateOpen(false);
      setName('');
      setDescription('');
      toast.success('Workflow created');
    },
    onError: () => toast.error('Failed to create workflow'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      workflowsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
    },
    onError: () => toast.error('Failed to delete workflow'),
  });

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!project) {
    return (
      <VtStage width="wide">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1
          className="vt-display mb-6"
          style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
        >
          Pick a <em>project</em> —<br /> then wire a circuit.
        </h1>
        <p className="text-[17px]" style={{ color: 'var(--ink-1)' }}>
          Workflows are scoped to a project. Open the project switcher in the
          top-left, or create a new one.
        </p>
      </VtStage>
    );
  }

  const list = (workflows as any[]) || [];
  const activeCt = list.filter((w) => w.isActive).length;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="W · CIRCUITS"
        eyebrow="§ 01 · AUTOMATION"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            automation <em>circuits</em>.
          </>
        }
        lead={
          'A workflow is a wired schematic — a trigger followed by ordered steps. Schedule it, fire it from a webhook, or run it on demand. Each circuit is a part filed under W-xxx with its own diagram.'
        }
        actions={
          <button onClick={() => setCreateOpen(true)} className="vt-btn vt-btn--primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            NEW CIRCUIT
          </button>
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">REGISTER</span>
            <span className="v big">workflow circuits</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-WFL-{String(list.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div>
            <span className="k">TOTAL</span>
            <span className="v">{String(list.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">ACTIVE</span>
            <span className="v" style={{ color: activeCt > 0 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {String(activeCt).padStart(3, '0')}
            </span>
          </div>
          <div>
            <span className="k">DRAFT</span>
            <span className="v">{String(list.length - activeCt).padStart(3, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div>
            <span className="k">CHECKED</span>
            <span className="v">VT</span>
          </div>
        </div>

        {/* Circuits */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl">schedule of circuits</span>
            <span className="rule" />
            <span className="stamp">{String(list.length).padStart(2, '0')} FILED</span>
          </div>

          {isLoading ? (
            <div
              className="p-12 text-center"
              style={{
                border: '1px dashed var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              — READING CIRCUITS —
            </div>
          ) : list.length === 0 ? (
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
                PLATE EMPTY
              </div>
              <h3
                className="mt-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(22px, 2.5vw, 32px)',
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                }}
              >
                no circuits on file.
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
                File a circuit to chain tests, visual diffs, and notifications.
                Every step becomes a numbered block on the diagram.
              </p>
              <div className="mt-8 flex justify-center">
                <button onClick={() => setCreateOpen(true)} className="vt-btn vt-btn--primary">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  FILE FIRST CIRCUIT
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {list.map((workflow: any, i: number) => (
                <CircuitPlate
                  key={workflow.id}
                  workflow={workflow}
                  index={i}
                  onToggle={(isActive) =>
                    toggleMutation.mutate({ id: workflow.id, isActive })
                  }
                  onDelete={() => deleteMutation.mutate(workflow.id)}
                />
              ))}
            </div>
          )}
        </section>

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
          <span>SHEET · CIRCUITS</span>
          <span>FILED · {String(list.length).padStart(3, '0')}</span>
          <span>CHECKED · VT</span>
        </footer>
      </EditorialHero>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}>
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              new circuit
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              FILE AS W-xxx · COMPOSABLE STEPS
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="block">
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: '6px',
                }}
              >
                NAME
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="FULL REGRESSION SUITE"
                className="vt-input"
                style={{ width: '100%' }}
              />
            </label>
            <label className="block">
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: '6px',
                }}
              >
                DESCRIPTION
              </span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the circuit does."
                className="vt-input"
                style={{ width: '100%', minHeight: '80px', padding: '12px 14px' }}
              />
            </label>
          </div>
          <DialogFooter>
            <button onClick={() => setCreateOpen(false)} className="vt-btn vt-btn--ghost">
              CANCEL
            </button>
            <button
              onClick={() =>
                createMutation.mutate({
                  name,
                  description: description || undefined,
                  projectId: project.id,
                })
              }
              disabled={!name.trim() || createMutation.isPending}
              className="vt-btn vt-btn--primary"
            >
              {createMutation.isPending ? 'FILING…' : 'FILE CIRCUIT'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VtStage>
  );
}

/* ── primitives ── */

function CircuitPlate({
  workflow,
  index,
  onToggle,
  onDelete,
}: {
  workflow: any;
  index: number;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const stepCount = workflow.steps?.length ?? 0;
  const steps: any[] = Array.isArray(workflow.steps) ? workflow.steps : [];
  const preview = steps.slice(0, 4);
  const extra = Math.max(0, stepCount - preview.length);

  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
        animation: `vt-reveal var(--dur-reveal) ${(index + 1) * 50}ms var(--ease-out) both`,
      }}
    >
      {/* header strip */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
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
        <span>
          <span style={{ color: 'var(--accent)' }}>W-{String(index + 1).padStart(3, '0')}</span>
          {' · '}FIG. {String(index + 1).padStart(2, '0')}
        </span>
        <span>
          {new Date(workflow.createdAt).toISOString().slice(0, 10).replace(/-/g, '.')}
          {' · '}
          {String(stepCount).padStart(2, '0')} STEPS
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
        {/* body */}
        <div className="p-6 lg:p-8" style={{ borderRight: '1px solid var(--rule)' }}>
          <Link
            href={`/workflows/${workflow.id}`}
            className="block transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(22px, 2.4vw, 30px)',
              color: 'var(--ink-0)',
              textTransform: 'lowercase',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-0)')}
          >
            {workflow.name}
          </Link>
          {workflow.description && (
            <p
              className="mt-3"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-1)',
                lineHeight: 1.55,
                maxWidth: '64ch',
              }}
            >
              {workflow.description}
            </p>
          )}

          {/* stepper */}
          <div className="mt-6">
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                marginBottom: '10px',
              }}
            >
              CIRCUIT · TRIGGER → STEPS
            </div>
            <div className="flex items-stretch flex-wrap gap-0">
              <StepBlock label="TRIGGER" value="ON FIRE" accent />
              {preview.length === 0 ? (
                <StepBlock label="STEP · 01" value="UNWIRED" muted />
              ) : (
                preview.map((step, si) => (
                  <StepBlock
                    key={step.id ?? si}
                    label={`STEP · ${String(si + 1).padStart(2, '0')}`}
                    value={
                      (step?.name ||
                        step?.type ||
                        step?.kind ||
                        'STEP').toString()
                    }
                  />
                ))
              )}
              {extra > 0 && <StepBlock label="…" value={`+${extra} MORE`} muted />}
            </div>
          </div>
        </div>

        {/* sidebar */}
        <aside
          className="p-5"
          style={{ background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)' }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              paddingBottom: '10px',
              marginBottom: '14px',
              borderBottom: '1px solid var(--rule)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            DETAIL · CIRCUIT META
          </div>
          <dl className="m-0 space-y-3 text-[12px]">
            <MetaRow
              k="STATE"
              v={
                <button
                  type="button"
                  onClick={() => onToggle(!workflow.isActive)}
                  className={workflow.isActive ? 'vt-rev-stamp vt-rev-stamp--pass' : 'vt-rev-stamp'}
                  style={{ fontSize: '9px', padding: '3px 8px', cursor: 'pointer' }}
                >
                  {workflow.isActive ? 'ACTIVE' : 'DRAFT'}
                </button>
              }
            />
            <MetaRow k="STEPS" v={String(stepCount).padStart(2, '0')} />
            <MetaRow
              k="FILED"
              v={new Date(workflow.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })}
            />
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={`/workflows/${workflow.id}`}
              className="vt-btn"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Edit className="w-3 h-3" strokeWidth={1.5} />
              OPEN CIRCUIT
              <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="vt-btn"
              style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--rule)', color: 'var(--ink-2)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fail)';
                e.currentTarget.style.borderColor = 'var(--fail)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ink-2)';
                e.currentTarget.style.borderColor = 'var(--rule)';
              }}
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              DELETE
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepBlock({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const color = accent ? 'var(--accent)' : muted ? 'var(--ink-2)' : 'var(--ink-1)';
  return (
    <div
      className="flex items-center"
      style={{
        padding: '10px 14px 10px 14px',
        border: '1px solid var(--rule)',
        marginRight: '-1px',
        marginBottom: '-1px',
        background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)',
        minWidth: '120px',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
      </div>
      <span
        aria-hidden
        style={{
          marginLeft: '14px',
          width: '16px',
          height: '1px',
          background: 'var(--rule)',
        }}
      />
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-[80px_1fr] gap-3 items-center py-1.5"
      style={{ borderBottom: '1px solid var(--rule-soft)' }}
    >
      <dt
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {k}
      </dt>
      <dd
        className="m-0"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          color: 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {v}
      </dd>
    </div>
  );
}
