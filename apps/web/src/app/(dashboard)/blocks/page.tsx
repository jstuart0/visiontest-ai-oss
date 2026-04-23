'use client';

// Blocks — the block list, ruled and indexed.
// Each block = a ruled row with a part ID, display-face name, mono
// scope/type, and template stamp. Presented as a schedule of parts
// to be snapped into workflows. No cards, no rounded corners, no shadows.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blocksApi, TaskBlock } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
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
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

const BLOCK_TYPES = [
  { value: 'authentication', label: 'authentication' },
  { value: 'navigation', label: 'navigation' },
  { value: 'form', label: 'form' },
  { value: 'data', label: 'data' },
  { value: 'assertion', label: 'assertion' },
];

export default function BlocksPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({ name: '', description: '', type: 'navigation' });

  const { data: blocks, isLoading } = useQuery({
    queryKey: ['blocks', project?.id],
    queryFn: () => blocksApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; type: string }) =>
      blocksApi.create({ ...data, projectId: project!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setCreateOpen(false);
      setNewBlock({ name: '', description: '', type: 'navigation' });
      toast.success('Block created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create block'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blocksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('Block deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete block'),
  });

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> —<br /> no parts to schedule.
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: 'var(--ink-1)', maxWidth: '56ch' }}>
          Blocks are scoped to a project. Open the project switcher and select one.
        </p>
      </VtStage>
    );
  }

  const list = (blocks || []) as TaskBlock[];
  const templateCt = list.filter((b) => b.isTemplate).length;

  // Count by type
  const typeCounts = list.reduce<Record<string, number>>((acc, b) => {
    acc[b.type] = (acc[b.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`09 / 14`}
        eyebrow={`§ 09 · SCHEDULE OF PARTS`}
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            task <em>blocks</em>.
          </>
        }
        lead={
          'Reusable parts for workflows — little named pieces of logic that snap together into tests. Each entry below is a part in the schedule, ruled and ready to install.'
        }
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                NEW BLOCK
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '24px',
                      textTransform: 'lowercase',
                      color: 'var(--ink-0)',
                    }}
                  >
                    new task block
                  </span>
                </DialogTitle>
                <DialogDescription>
                  <span
                    className="vt-mono"
                    style={{
                      fontSize: '10.5px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    DEFINE A REUSABLE PART
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <Field label="NAME">
                  <input
                    className="vt-input"
                    value={newBlock.name}
                    onChange={(e) => setNewBlock((s) => ({ ...s, name: e.target.value }))}
                    placeholder="login flow"
                  />
                </Field>
                <Field label="DESCRIPTION">
                  <input
                    className="vt-input"
                    value={newBlock.description}
                    onChange={(e) => setNewBlock((s) => ({ ...s, description: e.target.value }))}
                    placeholder="handles user authentication"
                  />
                </Field>
                <Field label="TYPE">
                  <div
                    className="grid grid-cols-5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    {BLOCK_TYPES.map((t, i) => {
                      const active = newBlock.type === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setNewBlock((s) => ({ ...s, type: t.value }))}
                          className="vt-mono"
                          style={{
                            padding: '10px 8px',
                            fontSize: '10px',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
                            background: active ? 'var(--accent-soft)' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--ink-2)',
                            cursor: 'pointer',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
              <DialogFooter>
                <button type="button" className="vt-btn vt-btn--ghost" onClick={() => setCreateOpen(false)}>
                  CANCEL
                </button>
                <button
                  type="button"
                  className="vt-btn vt-btn--primary"
                  onClick={() => createMutation.mutate(newBlock)}
                  disabled={!newBlock.name || createMutation.isPending}
                >
                  {createMutation.isPending ? 'CREATING…' : 'CREATE BLOCK'}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {/* ── Title block ─────────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">PARTS ON FILE</span>
            <span className="v">{String(list.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">TEMPLATES</span>
            <span className="v">{String(templateCt).padStart(2, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">INSTANCES</span>
            <span className="v">{String(list.length - templateCt).padStart(2, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
        </div>

        {/* ── §01 · Type tallies ──────────────────────────────────────── */}
        <section aria-labelledby="tallies-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="tallies-head">tally by type</span>
            <span className="rule" />
            <span className="stamp">{BLOCK_TYPES.length} CATEGORIES</span>
          </div>

          <div
            className="grid grid-cols-2 md:grid-cols-5"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            {BLOCK_TYPES.map((t, i) => (
              <Tally
                key={t.value}
                part={`T-${String(i + 1).padStart(2, '0')}`}
                label={t.label}
                count={typeCounts[t.value] || 0}
                last={i === BLOCK_TYPES.length - 1}
              />
            ))}
          </div>
        </section>

        {/* ── §02 · Schedule of blocks ────────────────────────────────── */}
        <section aria-labelledby="list-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="list-head">schedule of blocks</span>
            <span className="rule" />
            <span className="stamp">
              {isLoading
                ? 'TRACING…'
                : list.length === 0
                ? 'EMPTY SCHEDULE'
                : `${list.length} PART${list.length === 1 ? '' : 'S'}`}
            </span>
          </div>

          {isLoading ? (
            <LoadingFrame />
          ) : list.length === 0 ? (
            <EmptyFrame onCreate={() => setCreateOpen(true)} />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              {/* Header row */}
              <div
                className="grid grid-cols-[90px_1fr_160px_140px_80px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['PART', 'NAME · DESCRIPTION', 'SCOPE', 'STAMP', 'ACT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 4 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 4 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {list.map((block, i) => (
                <div
                  key={block.id}
                  className="grid grid-cols-[90px_1fr_160px_140px_80px] gap-0"
                  style={{
                    borderBottom: i < list.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
                  }}
                >
                  <div
                    className="py-4 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.16em',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    B-{String(i + 1).padStart(3, '0')}
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                      }}
                    >
                      {block.name}
                    </div>
                    {block.description && (
                      <div
                        className="mt-1"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          color: 'var(--ink-1)',
                          lineHeight: 1.45,
                        }}
                      >
                        {block.description}
                      </div>
                    )}
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <span className="vt-chip vt-chip--accent" style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                      {block.type.toUpperCase()}
                    </span>
                  </div>
                  <div
                    className="py-4 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.14em',
                      color: 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {block.isTemplate ? (
                      <span className="vt-rev-stamp" style={{ fontSize: '9px', padding: '3px 7px' }}>
                        TEMPLATE
                      </span>
                    ) : (
                      <span style={{ textTransform: 'uppercase' }}>INSTANCE</span>
                    )}
                  </div>
                  <div className="py-4 px-4 flex justify-end items-center">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(block.id)}
                      disabled={deleteMutation.isPending}
                      className="vt-btn vt-btn--ghost"
                      style={{
                        fontSize: '10px',
                        padding: '6px 8px',
                        letterSpacing: '0.16em',
                      }}
                      aria-label={`Delete block ${block.name}`}
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Colophon ───────────────────────────────────────────────── */}
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
          <span>SHEET 09 · SCHEDULE OF PARTS</span>
          <span>{String(list.length).padStart(3, '0')} PARTS</span>
          <span>DRAWN · {isoDate}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ────────────────────────────────────────────────────────── primitives ── */

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
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Tally({
  part,
  label,
  count,
  last,
}: {
  part: string;
  label: string;
  count: number;
  last?: boolean;
}) {
  return (
    <div
      className="p-5"
      style={{
        borderRight: last ? 'none' : '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule-soft)',
      }}
    >
      <div
        className="mb-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.18em',
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {part}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3.2vw, 42px)',
          lineHeight: 1,
          letterSpacing: '-0.025em',
          color: count > 0 ? 'var(--ink-0)' : 'var(--ink-3)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(count).padStart(2, '0')}
      </div>
      <div
        className="mt-3"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '14px',
          color: 'var(--ink-1)',
          textTransform: 'lowercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function LoadingFrame() {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="vt-mono vt-breathe"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        tracing the schedule…
      </div>
    </div>
  );
}

function EmptyFrame({ onCreate }: { onCreate: () => void }) {
  return (
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
        — schedule empty —
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 2.6vw, 32px)',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        no parts on file.
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
        Draft a block — a named piece of workflow logic that any test can install. Authentication, navigation, form, data, assertion.
      </p>
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onCreate} className="vt-btn vt-btn--primary">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          DRAFT FIRST BLOCK
        </button>
      </div>
    </div>
  );
}
