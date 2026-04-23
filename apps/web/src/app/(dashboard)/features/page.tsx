'use client';

// Features — subsystem roster.
//
// Each feature is a named subsystem with its own part number (F-XXX),
// an impact area derived from its description, and the count of linked
// scenarios. Rendered as a drafting-sheet ruled table:
// REF · NAME · AREA · TESTS · LAST UPDATE.

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { featuresApi, type Feature } from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

const EXAMPLE_SETUP = 'navigate /login, wait for input[type=password]';

/**
 * Derive a short, all-caps "impact area" from a feature. Pulls from the
 * first noun-ish chunk of the description; falls back to the first word
 * of the name. This is cosmetic — never mutates the entity.
 */
function impactArea(f: Feature): string {
  const src = (f.description || f.name || '').trim();
  if (!src) return 'GENERAL';
  const first = src.split(/[\s,.—–-]+/).filter(Boolean)[0] || 'GENERAL';
  return first.slice(0, 12).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, '.');
}

export default function FeaturesPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    sharedSetup: '',
  });

  const { data: features, isLoading } = useQuery({
    queryKey: ['features', project?.id],
    queryFn: () => featuresApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      featuresApi.create({
        projectId: project!.id,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        sharedSetup: draft.sharedSetup.trim() || undefined,
      }),
    onSuccess: (f: Feature) => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      toast.success(`Feature "${f.name}" drafted`);
      setCreateOpen(false);
      setDraft({ name: '', description: '', sharedSetup: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Create failed'),
  });

  if (!project) {
    return (
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display mb-6" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> to see its subsystems.
        </h1>
        <p className="text-[17px]" style={{ color: 'var(--ink-1)' }}>
          Features are scoped to a project. Open the switcher at the top-left
          to pick one, or draft a new project.
        </p>
      </VtStage>
    );
  }

  const items = (features || []) as Feature[];
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const totalTests = items.reduce((s, f) => s + (f._count?.tests ?? 0), 0);

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`02 / 14`}
        eyebrow="§ 02 · SUBSYSTEM ROSTER"
        revision={<>REV · 01 · {isoDate}</>}
        title={
          <>
            subsystem <em>roster</em>
          </>
        }
        lead={
          'Each feature is a subsystem — a named group of scenarios that share setup prose. The roster below schedules every subsystem with its part number, impact area, and linked test count.'
        }
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button type="button" className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                NEW FEATURE
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Draft feature</DialogTitle>
                <DialogDescription>
                  A feature groups scenarios with shared setup — Login (happy,
                  wrong-password, lockout), Checkout (guest, logged-in, coupon).
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.name.trim()) return;
                  createMutation.mutate();
                }}
                className="space-y-5 pt-2"
              >
                <FieldBlock label="NAME" required>
                  <input
                    autoFocus
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Login, Checkout, Settings"
                    className="vt-input"
                  />
                </FieldBlock>
                <FieldBlock label="DESCRIPTION">
                  <input
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="What this subsystem covers"
                    className="vt-input"
                  />
                </FieldBlock>
                <FieldBlock
                  label="SHARED SETUP · PROSE"
                  helper="Prepended to every scenario's story before parsing."
                >
                  <textarea
                    value={draft.sharedSetup}
                    onChange={(e) => setDraft({ ...draft, sharedSetup: e.target.value })}
                    placeholder={EXAMPLE_SETUP}
                    className="vt-input"
                    style={{ minHeight: '90px', resize: 'vertical' }}
                  />
                </FieldBlock>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="vt-btn vt-btn--ghost"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.name.trim() || createMutation.isPending}
                    className="vt-btn vt-btn--primary"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        DRAFTING
                      </>
                    ) : (
                      <>
                        DRAFT FEATURE
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </>
                    )}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        {/* Title-block: project / roster counts */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-FEAT-{(project.slug || project.id.slice(-6)).toUpperCase()}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>01</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div className="span2">
            <span className="k">SUBSYSTEMS</span>
            <span className="v">{String(items.length).padStart(3, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">TESTS · TOTAL</span>
            <span className="v">{String(totalTests).padStart(3, '0')}</span>
          </div>
        </div>

        {/* §02 — roster table */}
        <section aria-labelledby="roster-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="roster-head">schedule of subsystems</span>
            <span className="rule" />
            <span className="stamp">
              {items.length === 0 ? 'AWAITING DRAFT' : `${items.length} PARTS`}
            </span>
          </div>

          {isLoading ? (
            <LoadingFrame label="LOADING ROSTER" />
          ) : items.length === 0 ? (
            <EmptyRoster onDraft={() => setCreateOpen(true)} />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <RosterHeaderRow />
              {items.map((f, i) => (
                <RosterRow
                  key={f.id}
                  feature={f}
                  idx={i}
                  isLast={i === items.length - 1}
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
          <span>SHEET 02 · ROSTER · {project.name}</span>
          <span>CHECKED · {(project.slug || 'VT').toUpperCase()}</span>
          <span>TESTS MAPPED · {String(totalTests).padStart(3, '0')}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ── row primitives ──────────────────────────────────────────────── */

function RosterHeaderRow() {
  return (
    <div
      className="grid grid-cols-[90px_1.4fr_150px_90px_130px_40px] gap-0"
      style={{
        borderBottom: '1px solid var(--rule-strong)',
        fontFamily: 'var(--font-mono)',
        fontSize: '9.5px',
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: 'var(--ink-2)',
      }}
    >
      {['REF', 'NAME', 'AREA', 'TESTS', 'LAST UPDATE', ''].map((h, i) => (
        <div
          key={i}
          className="py-3 px-4"
          style={{
            borderRight: i < 5 ? '1px solid var(--rule)' : 'none',
            textAlign: i === 3 ? 'right' : 'left',
          }}
        >
          {h}
        </div>
      ))}
    </div>
  );
}

function RosterRow({
  feature,
  idx,
  isLast,
}: {
  feature: Feature;
  idx: number;
  isLast: boolean;
}) {
  const testCount = feature._count?.tests ?? 0;
  const part = `F-${String(idx + 1).padStart(3, '0')}`;
  return (
    <Link
      href={`/features/${feature.id}`}
      className="grid grid-cols-[90px_1.4fr_150px_90px_130px_40px] gap-0 group"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--rule-soft)',
        textDecoration: 'none',
        transition: 'background var(--dur-quick) var(--ease-out)',
        animation: `vt-reveal var(--dur-reveal) ${(idx + 1) * 30}ms var(--ease-out) both`,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          'color-mix(in oklab, var(--bg-2) 35%, transparent)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
        {part}
      </div>
      <div
        className="py-4 px-4 min-w-0"
        style={{ borderRight: '1px solid var(--rule-soft)' }}
      >
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '17px',
            color: 'var(--ink-0)',
            textTransform: 'lowercase',
            lineHeight: 1.15,
          }}
        >
          {feature.name}
        </div>
        {feature.description && (
          <div
            className="truncate mt-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12.5px',
              color: 'var(--ink-2)',
              lineHeight: 1.4,
            }}
          >
            {feature.description}
          </div>
        )}
      </div>
      <div
        className="py-4 px-4"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          letterSpacing: '0.18em',
          color: 'var(--ink-1)',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {impactArea(feature)}
      </div>
      <div
        className="py-4 px-4 text-right"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          letterSpacing: '0.06em',
          color: testCount === 0 ? 'var(--ink-2)' : 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(testCount).padStart(2, '0')}
      </div>
      <div
        className="py-4 px-4"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          letterSpacing: '0.1em',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDate(feature.updatedAt)}
      </div>
      <div className="py-4 px-4 flex items-center justify-end">
        <ArrowRight
          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
          strokeWidth={1.5}
          style={{ color: 'var(--ink-2)' }}
        />
      </div>
    </Link>
  );
}

function FieldBlock({
  label,
  required,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          display: 'inline-block',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>*</span>}
      </label>
      {children}
      {helper && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: 'var(--ink-2)',
            textTransform: 'uppercase',
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="inline-flex items-center gap-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
        {label}
      </div>
    </div>
  );
}

function EmptyRoster({ onDraft }: { onDraft: () => void }) {
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
        ROSTER EMPTY
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(26px, 3vw, 38px)',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        no subsystems on file.
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14.5px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.55,
        }}
      >
        A feature is a subsystem — a page or journey with several scenarios
        sharing the same setup. Draft one and its scenarios will index back
        to it automatically.
      </p>
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onDraft} className="vt-btn vt-btn--primary">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          DRAFT FIRST FEATURE
        </button>
      </div>
    </div>
  );
}
