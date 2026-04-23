'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderPlus,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Eye,
  FlaskConical,
} from 'lucide-react';
import Link from 'next/link';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { projectsApi } from '@/lib/api';
import { toast } from 'sonner';

interface WizardData {
  name: string;
  description: string;
}

const STEPS = [
  { id: 1, code: '01', label: 'project info' },
  { id: 2, code: '02', label: 'review · commit' },
  { id: 3, code: '03', label: 'next steps' },
];

const NEXT_ACTIONS = [
  {
    id: 'test',
    label: 'Author a test',
    description: 'Draft your first visual regression test, by hand or by AI.',
    icon: FlaskConical,
    href: '/tests/new',
    code: 'A-01',
  },
  {
    id: 'storybook',
    label: 'Connect Storybook',
    description: 'Index your component catalog and promote stories to fixtures.',
    icon: BookOpen,
    href: '/settings/storybook/wizard',
    code: 'A-02',
  },
  {
    id: 'ai-diff',
    label: 'Configure AI diff',
    description: 'Tune the diff stack so baseline noise is separated from regressions.',
    icon: Eye,
    href: '/settings/ai-diff/wizard',
    code: 'A-03',
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ name: '', description: '' });
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  function update(fields: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...fields }));
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  }

  function next() {
    if (step < 2 && canAdvance()) setStep(step + 1);
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      projectsApi.create({
        name: data.name,
        description: data.description || undefined,
      }),
    onSuccess: (project: any) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreatedProjectId(project.id);
      toast.success('Project created');
      setStep(3);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const slugHint = data.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);

  return (
    <VtStage width="narrow">
      <EditorialHero
        width="narrow"
        sheet={`N-${String(step).padStart(2, '0')}`}
        eyebrow="§ COMMISSION · NEW PROJECT"
        revision={<>REV · 01 · {isoDate}</>}
        back={{ href: '/dashboard', label: 'BACK TO DASHBOARD' }}
        title={
          <>
            a fresh <em>commission</em>.
          </>
        }
        lead="Opening a file. Name the project, add a short brief, commit. The drawing set will be initialised and you can start photographing."
      >
        {/* ── Title block ───────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">FORM</span>
            <span className="v big">Commission · new project</span>
          </div>
          <div className="span2">
            <span className="k">STAGE</span>
            <span className="v">{String(step).padStart(2, '0')} / 03</span>
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
            <span className="k">WORKING NAME</span>
            <span className="v">{data.name.trim() || '—'}</span>
          </div>
          <div>
            <span className="k">SLUG</span>
            <span className="v">{slugHint || '—'}</span>
          </div>
          <div>
            <span className="k">STATE</span>
            <span
              className="v"
              style={{
                color: step === 3 ? 'var(--pass)' : 'var(--accent)',
              }}
            >
              {step === 3 ? 'FILED' : 'DRAFT'}
            </span>
          </div>
        </div>

        {/* ── Step progression ──────────────────────────────────────── */}
        <div
          className="grid grid-cols-3 gap-0"
          style={{ border: '1px solid var(--rule-strong)' }}
        >
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div
                key={s.id}
                className="py-4 px-5 grid grid-cols-[40px_1fr_24px] items-center gap-3"
                style={{
                  borderRight: i < STEPS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div
                  className="vt-mono"
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    color: active ? 'var(--accent)' : done ? 'var(--pass)' : 'var(--ink-2)',
                  }}
                >
                  § {s.code}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    color: active ? 'var(--ink-0)' : 'var(--ink-1)',
                    textTransform: 'lowercase',
                  }}
                >
                  {s.label}
                </div>
                <div className="flex items-center justify-end" style={{ color: 'var(--ink-2)' }}>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--pass)' }} />
                  ) : active ? (
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Step 1 ────────────────────────────────────────────────── */}
        {step === 1 && (
          <section aria-labelledby="info-head">
            <div className="vt-section-head">
              <span className="num">§ 01</span>
              <span className="ttl" id="info-head">project info</span>
              <span className="rule" />
              <span className="stamp">FORM · COMMISSION</span>
            </div>
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <FormRow
                label="PROJECT NAME"
                hint="REQUIRED · SHEET TITLE"
                dim="⊢ 1–60 CHAR ⊣"
              >
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Marketing site · Mobile app · Design system"
                  className="vt-input"
                  autoFocus
                />
              </FormRow>
              <FormRow
                label="BRIEF"
                hint="OPTIONAL · SHORT DESCRIPTION"
                dim="⊢ 0–200 CHAR ⊣"
                last
              >
                <textarea
                  value={data.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="What does this project test?"
                  className="vt-input"
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '72px' }}
                />
              </FormRow>
            </div>
          </section>
        )}

        {/* ── Step 2 ────────────────────────────────────────────────── */}
        {step === 2 && (
          <section aria-labelledby="review-head">
            <div className="vt-section-head">
              <span className="num">§ 02</span>
              <span className="ttl" id="review-head">review · commit</span>
              <span className="rule" />
              <span className="stamp">CONFIRM BEFORE FILING</span>
            </div>
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <ReviewRow label="NAME" value={data.name} />
              <ReviewRow label="SLUG · DERIVED" value={slugHint || '—'} />
              <ReviewRow label="BRIEF" value={data.description || '—'} last />
            </div>
            <div
              className="mt-5 p-5 flex items-start gap-3"
              style={{
                border: '1px solid var(--accent)',
                background: 'var(--accent-soft)',
              }}
            >
              <div
                className="vt-mono shrink-0"
                style={{
                  fontSize: '10.5px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  padding: '3px 8px',
                  border: '1px solid var(--accent)',
                }}
              >
                NOTE
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13.5px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                }}
              >
                Filing this form creates the project, opens its drawing set, and
                returns a set of recommended next steps. You can rename it later.
              </p>
            </div>
          </section>
        )}

        {/* ── Step 3 ────────────────────────────────────────────────── */}
        {step === 3 && (
          <section aria-labelledby="filed-head">
            <div className="vt-section-head">
              <span className="num">§ 03</span>
              <span className="ttl" id="filed-head">filed · next steps</span>
              <span className="rule" />
              <span className="stamp">PROJECT OPENED</span>
            </div>
            <div
              className="p-10 text-center"
              style={{
                border: '1px solid var(--pass)',
                background: 'var(--pass-soft)',
              }}
            >
              <div className="flex justify-center mb-4">
                <span
                  className="vt-rev-stamp vt-rev-stamp--pass"
                  style={{ fontSize: '11px' }}
                >
                  FILED · REV 01
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 3vw, 34px)',
                  lineHeight: 1,
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                }}
              >
                "{data.name}" is on the books.
              </h3>
              <p
                className="mx-auto mt-3"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink-1)',
                  maxWidth: '52ch',
                  lineHeight: 1.5,
                }}
              >
                The drawing set is initialised. Pick a starting move below, or head
                to the dashboard to draft at your own pace.
              </p>
            </div>

            <div className="mt-8">
              <div
                className="vt-mono mb-4"
                style={{
                  fontSize: '10.5px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                RECOMMENDED NEXT STEPS
              </div>
              <div
                style={{
                  border: '1px solid var(--rule-strong)',
                  background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
                }}
              >
                {NEXT_ACTIONS.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="grid grid-cols-[90px_40px_1fr_30px] items-center group"
                      style={{
                        borderBottom:
                          i < NEXT_ACTIONS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                        textDecoration: 'none',
                        transition: 'background var(--dur-quick) var(--ease-out)',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          'color-mix(in oklab, var(--bg-2) 35%, transparent)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <div
                        className="py-4 px-4 vt-mono"
                        style={{
                          borderRight: '1px solid var(--rule-soft)',
                          fontSize: '11px',
                          letterSpacing: '0.18em',
                          color: 'var(--accent)',
                        }}
                      >
                        {action.code}
                      </div>
                      <div
                        className="py-4 px-3 flex items-center justify-center"
                        style={{
                          borderRight: '1px solid var(--rule-soft)',
                          color: 'var(--ink-1)',
                        }}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div
                        className="py-4 px-4"
                        style={{ borderRight: '1px solid var(--rule-soft)' }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '16px',
                            color: 'var(--ink-0)',
                            textTransform: 'lowercase',
                          }}
                          className="group-hover:text-[color:var(--accent)] transition-colors"
                        >
                          {action.label}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '12.5px',
                            color: 'var(--ink-2)',
                            marginTop: '2px',
                          }}
                        >
                          {action.description}
                        </div>
                      </div>
                      <div className="py-4 px-3 flex items-center justify-center">
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
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="vt-btn vt-btn--ghost"
              >
                SKIP · GO TO DASHBOARD
              </button>
            </div>
          </section>
        )}

        {/* ── Navigation ────────────────────────────────────────────── */}
        {step < 3 && (
          <div
            className="flex items-center justify-between pt-6"
            style={{ borderTop: '1px solid var(--rule)' }}
          >
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              className="vt-btn"
              style={step === 1 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              BACK
            </button>

            <div
              className="vt-mono"
              style={{
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              STAGE {step} / {STEPS.length}
            </div>

            {step < 2 ? (
              <button
                type="button"
                onClick={next}
                disabled={!canAdvance()}
                className="vt-btn vt-btn--primary"
              >
                NEXT
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="vt-btn vt-btn--primary"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                    FILING…
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    FILE PROJECT
                  </>
                )}
              </button>
            )}
          </div>
        )}

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
          <span>FORM · COMMISSION</span>
          <span>DRAWN · {isoDate}</span>
          <span>{step === 3 ? 'FILED' : 'DRAFT'} · STAGE {String(step).padStart(2, '0')}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function FormRow({
  label,
  hint,
  dim,
  children,
  last,
}: {
  label: string;
  hint: string;
  dim?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[180px_1fr]"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--rule-soft)',
      }}
    >
      <div
        className="py-5 px-5"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
        }}
      >
        <div
          className="vt-mono"
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-0)',
          }}
        >
          {label}
        </div>
        <div
          className="vt-mono"
          style={{
            fontSize: '9.5px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            marginTop: '6px',
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
        {dim && (
          <div
            className="vt-mono"
            style={{
              fontSize: '10px',
              letterSpacing: '0.14em',
              color: 'var(--ink-2)',
              marginTop: '6px',
            }}
          >
            {dim}
          </div>
        )}
      </div>
      <div className="py-5 px-5">{children}</div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[160px_1fr]"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--rule-soft)',
      }}
    >
      <div
        className="py-4 px-5 vt-mono"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontSize: '10.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
        }}
      >
        {label}
      </div>
      <div
        className="py-4 px-5 break-words"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-0)',
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}
