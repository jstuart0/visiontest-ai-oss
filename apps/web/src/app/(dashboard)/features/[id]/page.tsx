'use client';

// Feature detail — subsystem schematic.
//
// Title-block header (part, area, creation, tests mapped) then three
// numbered sections: §01 mapped tests (ruled list with scenario links),
// §02 risk map (shared setup + description — the prose every scenario
// inherits), §03 history (created/updated stamps). Editing actions
// stay intact; the edit surface slides into §02.

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Loader2,
  Edit3,
  Save,
  X,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { featuresApi } from '@/lib/api';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

const STATUS_META: Record<string, { label: string; chipClass: string }> = {
  ACTIVE:   { label: 'ACTIVE',   chipClass: 'vt-chip' },
  PASSED:   { label: 'PASSED',   chipClass: 'vt-chip vt-chip--pass' },
  FAILED:   { label: 'FAILED',   chipClass: 'vt-chip vt-chip--fail' },
  DISABLED: { label: 'DISABLED', chipClass: 'vt-chip' },
  ARCHIVED: { label: 'ARCHIVED', chipClass: 'vt-chip' },
};

function impactArea(desc: string | null, name: string): string {
  const src = (desc || name || '').trim();
  if (!src) return 'GENERAL';
  const first = src.split(/[\s,.—–-]+/).filter(Boolean)[0] || 'GENERAL';
  return first.slice(0, 12).toUpperCase();
}

function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, '.');
}

export default function FeatureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const featureId = params.id as string;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', sharedSetup: '' });

  const { data: feature, isLoading } = useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => featuresApi.get(featureId),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      featuresApi.update(featureId, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        sharedSetup: draft.sharedSetup.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature', featureId] });
      queryClient.invalidateQueries({ queryKey: ['features'] });
      setEditing(false);
      toast.success('Feature updated');
    },
    onError: (err: any) => toast.error(err.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => featuresApi.delete(featureId),
    onSuccess: () => {
      toast.success('Feature deleted');
      queryClient.invalidateQueries({ queryKey: ['features'] });
      router.push('/features');
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed'),
  });

  const startEdit = () => {
    if (!feature) return;
    setDraft({
      name: feature.name,
      description: feature.description ?? '',
      sharedSetup: feature.sharedSetup ?? '',
    });
    setEditing(true);
  };

  if (isLoading || !feature) {
    return (
      <VtStage width="wide">
        <div
          className="p-12 text-center mt-16"
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
            LOADING SUBSYSTEM
          </div>
        </div>
      </VtStage>
    );
  }

  const scenarios = feature.tests ?? [];
  const part = `F-${String(featureId.slice(-3).padStart(3, '0')).toUpperCase()}`;
  const area = impactArea(feature.description, feature.name);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="03 / 14"
        eyebrow={`§ 03 · SUBSYSTEM · ${part}`}
        revision={<>REV · 02 · {today}</>}
        back={{ href: '/features', label: 'ALL SUBSYSTEMS' }}
        title={
          editing ? (
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="vt-input"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 4.5vw, 56px)',
                textTransform: 'lowercase',
                padding: '4px 10px',
                width: '100%',
              }}
            />
          ) : (
            <>{feature.name}</>
          )
        }
        lead={
          !editing && feature.description
            ? feature.description
            : 'Subsystem schematic. Scenarios mapped to this feature inherit the shared setup prose and are listed below.'
        }
        actions={
          !editing ? (
            <>
              <button type="button" onClick={startEdit} className="vt-btn">
                <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                EDIT
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scenarios.length > 0) {
                    toast.error(
                      `Unassign or delete ${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} first.`,
                    );
                    return;
                  }
                  if (confirm('Delete this feature?')) deleteMutation.mutate();
                }}
                className="vt-btn"
                style={{
                  color: 'var(--fail)',
                  borderColor: 'color-mix(in oklab, var(--fail) 40%, var(--rule))',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                DELETE
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="vt-btn vt-btn--ghost"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={!draft.name.trim() || updateMutation.isPending}
                className="vt-btn vt-btn--primary"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                SAVE
              </button>
            </>
          )
        }
      >
        {/* Title-block — feature metadata */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">FEATURE</span>
            <span className="v big">{feature.name}</span>
          </div>
          <div className="span2">
            <span className="k">PART</span>
            <span className="v" style={{ color: 'var(--accent)' }}>{part}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">IMPACT AREA</span>
            <span className="v">{area}</span>
          </div>
          <div className="span2">
            <span className="k">CREATED</span>
            <span className="v">{isoDate(feature.createdAt)}</span>
          </div>
          <div>
            <span className="k">TESTS</span>
            <span className="v">{String(scenarios.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">UPDATED</span>
            <span className="v">{isoDate(feature.updatedAt)}</span>
          </div>
        </div>

        {/* §01 — mapped tests */}
        <section aria-labelledby="mapped-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="mapped-head">mapped tests</span>
            <span className="rule" />
            <span className="stamp">
              {scenarios.length === 0 ? 'NONE MAPPED' : `${scenarios.length} LINKED`}
            </span>
          </div>

          <div className="flex justify-end mb-4">
            <Link
              href={`/tests/new?featureId=${feature.id}`}
              className="vt-btn vt-btn--primary"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              MAP SCENARIO
            </Link>
          </div>

          {scenarios.length === 0 ? (
            <div
              className="p-10 text-center"
              style={{
                border: '1px dashed var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
              }}
            >
              <div
                className="vt-kicker"
                style={{ color: 'var(--ink-2)', justifyContent: 'center' }}
              >
                NO SCENARIOS FILED
              </div>
              <p
                className="mt-4 mx-auto"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14.5px',
                  maxWidth: '54ch',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                }}
              >
                Each scenario is a full story + goal that inherits this
                subsystem&apos;s setup. Good first entries: happy path, wrong
                input, locked/error state.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href={`/tests/new?featureId=${feature.id}`}
                  className="vt-btn"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  ADD FIRST SCENARIO
                </Link>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[70px_70px_1fr_130px_40px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['REF', 'NO.', 'SCENARIO', 'STATUS', ''].map((h, i) => (
                  <div
                    key={i}
                    className="py-3 px-4"
                    style={{ borderRight: i < 4 ? '1px solid var(--rule)' : 'none' }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {scenarios.map((s, i) => {
                const meta = STATUS_META[s.status] ?? STATUS_META.ACTIVE;
                return (
                  <Link
                    key={s.id}
                    href={`/tests/${s.id}`}
                    className="grid grid-cols-[70px_70px_1fr_130px_40px] gap-0 group"
                    style={{
                      borderBottom:
                        i < scenarios.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                      textDecoration: 'none',
                      transition: 'background var(--dur-quick) var(--ease-out)',
                      animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
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
                        fontSize: '10.5px',
                        letterSpacing: '0.14em',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      S-{String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      className="py-4 px-4 min-w-0"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        className="truncate"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '15px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {s.name}
                      </div>
                      {s.goal && (
                        <div
                          className="truncate mt-1"
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '12.5px',
                            color: 'var(--ink-2)',
                            fontStyle: 'italic',
                          }}
                        >
                          goal · {s.goal}
                        </div>
                      )}
                    </div>
                    <div
                      className="py-4 px-4 flex items-center"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <span
                        className={meta.chipClass}
                        style={{ fontSize: '9.5px', padding: '3px 8px' }}
                      >
                        {meta.label}
                      </span>
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
              })}
            </div>
          )}
        </section>

        {/* §02 — risk map (shared setup + description) */}
        <section aria-labelledby="risk-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="risk-head">risk map · shared setup</span>
            <span className="rule" />
            <span className="stamp">
              {feature.sharedSetup ? 'PROSE ON FILE' : 'UNDEFINED'}
            </span>
          </div>

          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              padding: '24px 28px',
            }}
          >
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                      display: 'block',
                    }}
                  >
                    DESCRIPTION
                  </label>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="What this subsystem covers"
                    className="vt-input"
                    style={{ minHeight: '64px', resize: 'vertical' }}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                      display: 'block',
                    }}
                  >
                    SHARED SETUP · PROSE
                  </label>
                  <textarea
                    value={draft.sharedSetup}
                    onChange={(e) => setDraft({ ...draft, sharedSetup: e.target.value })}
                    placeholder="navigate /login, wait for input[type=password]"
                    className="vt-input"
                    style={{ minHeight: '140px', resize: 'vertical' }}
                  />
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    PREPENDED TO EVERY SCENARIO BEFORE PARSING
                  </p>
                </div>
              </div>
            ) : feature.sharedSetup ? (
              <>
                <div
                  className="mb-3"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9.5px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--rule)',
                  }}
                >
                  PROSE · APPLIED TO ALL {scenarios.length} SCENARIO
                  {scenarios.length === 1 ? '' : 'S'}
                </div>
                <pre
                  className="m-0 whitespace-pre-wrap"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    lineHeight: 1.65,
                    color: 'var(--ink-0)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {feature.sharedSetup}
                </pre>
              </>
            ) : (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14.5px',
                  color: 'var(--ink-2)',
                  fontStyle: 'italic',
                  lineHeight: 1.55,
                }}
              >
                No shared setup on file. Click Edit to add prose that will be
                prepended to every mapped scenario&apos;s story before parsing.
              </p>
            )}
          </div>
        </section>

        {/* §03 — history */}
        <section aria-labelledby="history-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="history-head">history</span>
            <span className="rule" />
            <span className="stamp">2 ENTRIES</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <HistoryRow
              ref_="H-01"
              stamp={isoDate(feature.createdAt)}
              event="Feature drafted"
              note="Initial schematic committed to project roster."
              last={false}
            />
            <HistoryRow
              ref_="H-02"
              stamp={isoDate(feature.updatedAt)}
              event="Last revision"
              note={
                feature.updatedAt === feature.createdAt
                  ? 'Unchanged since draft.'
                  : 'Metadata or shared setup updated.'
              }
              last={true}
            />
          </div>
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
          <span>SHEET 03 · SUBSYSTEM · {part}</span>
          <span>AREA · {area}</span>
          <span>SCENARIOS · {String(scenarios.length).padStart(2, '0')}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

function HistoryRow({
  ref_,
  stamp,
  event,
  note,
  last,
}: {
  ref_: string;
  stamp: string;
  event: string;
  note: string;
  last: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[90px_140px_1fr] gap-0"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--rule-soft)',
      }}
    >
      <div
        className="py-3 px-4"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          letterSpacing: '0.16em',
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {ref_}
      </div>
      <div
        className="py-3 px-4"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          letterSpacing: '0.1em',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {stamp}
      </div>
      <div className="py-3 px-4">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            color: 'var(--ink-0)',
            textTransform: 'lowercase',
          }}
        >
          {event}
        </div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12.5px',
            color: 'var(--ink-2)',
            lineHeight: 1.4,
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}
