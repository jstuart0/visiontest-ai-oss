'use client';

// Test detail — Blueprint / part drawing.
//
// The page opens with a full title-block for the part (ID, name, goal,
// source, environment, credentials, revision stamp). The primary figure
// is the numbered strip of compiled steps. Supporting plates: visuals,
// masks, execution history. Edit / enable-disable / run / delete preserved.

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Save,
  Trash2,
  Image as ImageIcon,
  Settings,
  History,
  List,
  AlertTriangle,
} from 'lucide-react';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import {
  testsApi,
  visualApi,
  masksApi,
  flakyApi,
  baselinesApi,
  type Test,
  type VisualComparison,
  type Mask,
} from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { StepEditor, type TestStep as EditorTestStep } from '@/components/step-editor';

// --- helpers -----------------------------------------------------------
function partId(id: string): string {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  const n = (h % 900) + 100;
  return `T-${n}`;
}

type StatusKey = 'passed' | 'failed' | 'flaky' | 'running' | 'pending';
const STATUS_META: Record<StatusKey, { label: string; variant: '' | '--pass' | '--reject' | '--warn' }> = {
  passed: { label: 'PASS', variant: '--pass' },
  failed: { label: 'FAIL', variant: '--reject' },
  flaky: { label: 'FLAKY', variant: '--warn' },
  running: { label: 'ACTIVE', variant: '' },
  pending: { label: 'DRAFT', variant: '' },
};
function normalizeStatus(s: string | undefined | null): StatusKey {
  const k = (s || '').toLowerCase();
  if (k === 'passed' || k === 'pass') return 'passed';
  if (k === 'failed' || k === 'fail') return 'failed';
  if (k === 'flaky') return 'flaky';
  if (k === 'running') return 'running';
  return 'pending';
}

function stepSummary(step: any): { type: string; target: string; assertion: string | null } {
  const type = (step?.type || 'step').toString().toUpperCase();
  const target =
    step?.url || step?.selector || step?.value || step?.name || '—';
  const assertion = step?.assertion || null;
  return { type, target: String(target), assertion };
}

// -----------------------------------------------------------------------
// Sub-atoms
// -----------------------------------------------------------------------
function Plate({
  leader,
  stamp,
  children,
}: {
  leader: string;
  stamp?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 45%, transparent)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{leader}</span>
        {stamp && <span style={{ color: 'var(--accent)' }}>{stamp}</span>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TitleBlock({
  test,
  statusKey,
  isoDate,
  projectName,
}: {
  test: Test;
  statusKey: StatusKey;
  isoDate: string;
  projectName?: string;
}) {
  const steps = (() => {
    const raw = (test as any)?.steps;
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const source = (test as any)?.config?.storyText
    ? 'STORY'
    : steps.length
      ? 'SCRIPT'
      : 'DRAFT';
  const env = (test.platform || 'WEB').toString();
  const credential = (test as any)?.config?.credentialId
    ? 'BOUND'
    : 'NONE';
  const meta = STATUS_META[statusKey];

  return (
    <div className="vt-title-block mt-10">
      <div className="span2">
        <span className="k">PART</span>
        <span className="v big" style={{ color: 'var(--accent)' }}>
          {partId(test.id)}
        </span>
      </div>
      <div className="span3">
        <span className="k">NAME</span>
        <span
          className="v big"
          style={{
            fontFamily: 'var(--font-display)',
            textTransform: 'lowercase',
            letterSpacing: '0.01em',
          }}
        >
          {test.name}
        </span>
      </div>
      <div>
        <span className="k">LAST RUN</span>
        <span className={`vt-rev-stamp ${meta.variant ? `vt-rev-stamp${meta.variant}` : ''}`} style={{ marginTop: '2px' }}>
          {meta.label}
        </span>
      </div>

      <div className="span2">
        <span className="k">GOAL / DESCRIPTION</span>
        <span
          className="v"
          style={{
            textTransform: 'none',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.45,
          }}
        >
          {test.description || '—'}
        </span>
      </div>
      <div>
        <span className="k">SOURCE</span>
        <span className="v">{source}</span>
      </div>
      <div>
        <span className="k">ENVIRONMENT</span>
        <span className="v">{env}</span>
      </div>
      <div>
        <span className="k">CREDENTIALS</span>
        <span className="v">{credential}</span>
      </div>
      <div>
        <span className="k">STATE</span>
        <span className="v" style={{ color: test.status === 'DISABLED' ? 'var(--fail)' : 'var(--pass)' }}>
          {test.status || 'ACTIVE'}
        </span>
      </div>

      <div className="span2">
        <span className="k">PROJECT</span>
        <span className="v">{projectName || '—'}</span>
      </div>
      <div className="span2">
        <span className="k">CHECKED</span>
        <span className="v">{isoDate}</span>
      </div>
      <div className="span2">
        <span className="k">STEPS · FLAKY SCORE</span>
        <span className="v">
          {String(steps.length).padStart(2, '0')}{' '}
          <span style={{ color: 'var(--ink-2)' }}>·</span>{' '}
          <span
            style={{
              color:
                (test.flakyScore || 0) > 50
                  ? 'var(--fail)'
                  : (test.flakyScore || 0) > 20
                    ? 'var(--warn)'
                    : 'var(--ink-1)',
            }}
          >
            {test.flakyScore !== undefined && test.flakyScore !== null
              ? `${String(test.flakyScore).padStart(2, '0')}%`
              : '—'}
          </span>
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------
export default function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: testId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedSteps, setEditedSteps] = useState<EditorTestStep[] | null>(null);
  const [screenshotEveryStep, setScreenshotEveryStep] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);

  const { data: test, isLoading } = useQuery<Test>({
    queryKey: ['test', project?.id, testId],
    queryFn: () => testsApi.get(project!.id, testId),
    enabled: !!project?.id,
  });

  useEffect(() => {
    if (test) {
      setName(test.name);
      setDescription(test.description || '');
      const cfg = (test as any).config || {};
      setScreenshotEveryStep(cfg.screenshotEveryStep ?? false);
      setVideoRecording(cfg.videoRecording ?? false);
    }
  }, [test]);

  const { data: visuals } = useQuery<VisualComparison[]>({
    queryKey: ['visual', project?.id, testId],
    queryFn: () => visualApi.list(project!.id),
    enabled: !!project?.id,
  });

  const { data: masks } = useQuery<Mask[]>({
    queryKey: ['masks', project?.id, testId],
    queryFn: () => masksApi.list(project!.id, { testId }),
    enabled: !!project?.id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Test>) =>
      testsApi.update(project!.id, testId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', project?.id, testId] });
      toast.success('Revision saved');
      setHasChanges(false);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not save revision');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => testsApi.delete(project!.id, testId),
    onSuccess: () => {
      toast.success('Part struck from schedule');
      router.push('/tests');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not remove part');
    },
  });

  const runMutation = useMutation({
    mutationFn: () => testsApi.run(project!.id, testId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['test', project?.id, testId] });
      toast.success('Run queued — redirecting to live view…');
      router.push(`/executions/${data.id}`);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not run part');
    },
  });

  const latestPassed = (test as any)?.recentExecutions?.find(
    (e: { status: string }) => e.status === 'PASSED',
  );
  const setBaselineMutation = useMutation({
    mutationFn: () => {
      if (!latestPassed) throw new Error('No passed execution found');
      return baselinesApi.fromExecution(latestPassed.id, {});
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['baselines'] });
      toast.success(
        res.replaced
          ? `Baseline "${res.name}" updated from the latest passing run`
          : `Baseline "${res.name}" created from the latest passing run`,
      );
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not set baseline');
    },
  });

  const quarantineMutation = useMutation({
    mutationFn: () => {
      const isQuarantined = test?.status === 'QUARANTINED';
      return isQuarantined ? flakyApi.unquarantine(testId) : flakyApi.quarantine(testId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', project?.id, testId] });
      toast.success(
        test?.status === 'QUARANTINED' ? 'Released from quarantine' : 'Moved to quarantine',
      );
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update quarantine'),
  });

  const handleSave = () => {
    const updates: any = { name, description: description || undefined };
    if (editedSteps) updates.steps = editedSteps;
    updates.config = {
      ...((test as any)?.config || {}),
      screenshotEveryStep,
      videoRecording,
    };
    updateMutation.mutate(updates);
  };

  const handleChange = (field: 'name' | 'description', value: string) => {
    if (field === 'name') setName(value);
    else setDescription(value);
    setHasChanges(true);
  };

  // ---------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------
  if (isLoading) {
    return (
      <EditorialHero
        width="wide"
        back={{ href: '/tests', label: 'BACK TO PARTS SCHEDULE' }}
        sheet="—"
        title="loading part…"
      >
        <div
          className="py-16 text-center"
          style={{
            border: '1px dashed var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          <span className="vt-breathe">fetching drawing set…</span>
        </div>
      </EditorialHero>
    );
  }

  if (!test) {
    return (
      <EditorialHero
        width="wide"
        back={{ href: '/tests', label: 'BACK TO PARTS SCHEDULE' }}
        sheet="— · NOT FOUND"
        title={
          <>
            part <em style={{ color: 'var(--fail)' }}>not found</em>.
          </>
        }
        lead="This part has been struck from the schedule, or the link is stale."
      >
        <div
          className="py-14 text-center"
          style={{ border: '1px dashed var(--fail)' }}
        >
          <Link href="/tests" className="vt-btn">
            RETURN TO SCHEDULE
          </Link>
        </div>
      </EditorialHero>
    );
  }

  const lastStatus = normalizeStatus((test as any).lastStatus);
  const steps: any[] = (() => {
    if (editedSteps) return editedSteps;
    const raw = (test as any)?.steps;
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const testVisuals = visuals?.filter((v) => v.testId === testId) || [];
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const meta = STATUS_META[lastStatus];

  return (
    <EditorialHero
      width="wide"
      back={{ href: '/tests', label: 'BACK TO PARTS SCHEDULE' }}
      sheet={`02 · ${partId(test.id)}`}
      eyebrow={`§ ${isoDate} · PART DETAIL`}
      revision={<>REV · {meta.label}</>}
      title={<span style={{ textTransform: 'lowercase' }}>{test.name}</span>}
      lead={test.description || undefined}
      actions={
        <>
          {hasChanges && (
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="vt-btn vt-btn--primary"
            >
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              SAVE REVISION
            </button>
          )}
          <button
            type="button"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="vt-btn"
          >
            <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
            RUN
          </button>
          {latestPassed && (
            <button
              type="button"
              onClick={() => setBaselineMutation.mutate()}
              disabled={setBaselineMutation.isPending}
              className="vt-btn"
              title={`Use the latest passing run (${new Date(
                latestPassed.createdAt,
              ).toLocaleDateString()}) as the baseline.`}
            >
              <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
              SET BASELINE
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="vt-btn"
            style={{ borderColor: 'var(--rule)', color: 'var(--fail)' }}
            title="Remove part"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </>
      }
    >
      {/* --- TITLE BLOCK ------------------------------------------------ */}
      <TitleBlock
        test={test}
        statusKey={lastStatus}
        isoDate={isoDate}
        projectName={project?.name}
      />

      {/* --- TABS ------------------------------------------------------- */}
      <Tabs defaultValue="steps" className="space-y-6 mt-2">
        <TabsList
          className="rounded-none p-0"
          style={{
            background: 'transparent',
            border: '1px solid var(--rule-strong)',
            display: 'inline-flex',
          }}
        >
          {[
            { v: 'steps', icon: List, label: 'STEPS' },
            { v: 'settings', icon: Settings, label: 'SETTINGS' },
            { v: 'visuals', icon: ImageIcon, label: `VISUALS · ${testVisuals.length}` },
            { v: 'masks', icon: null, label: `MASKS · ${masks?.length || 0}` },
            { v: 'history', icon: History, label: 'HISTORY' },
          ].map((t, i) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-none"
              style={{
                borderRight: i < 4 ? '1px solid var(--rule)' : 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                padding: '10px 16px',
                color: 'var(--ink-1)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t.icon ? <t.icon className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} /> : null}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* --- STEPS --- */}
        <TabsContent value="steps" className="space-y-6">
          <Plate
            leader="FIG. 1 · COMPILED STEPS"
            stamp={`${String(steps.length).padStart(2, '0')} PLATES`}
          >
            {steps.length === 0 ? (
              <div
                className="py-12 text-center"
                style={{
                  border: '1px dashed var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                — no steps recorded yet —
              </div>
            ) : (
              <div className="space-y-0">
                {/* Numbered strip — each step = a numbered plate */}
                {steps.map((step, i) => {
                  const { type, target, assertion } = stepSummary(step);
                  return (
                    <div key={i}>
                      <div
                        className="grid items-start gap-4 px-4 py-4"
                        style={{
                          gridTemplateColumns: '56px 120px 1fr',
                          borderTop: i === 0 ? '1px solid var(--rule)' : 'none',
                          borderBottom: '1px solid var(--rule-soft)',
                        }}
                      >
                        {/* Plate number */}
                        <div
                          className="text-center py-1"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '18px',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '0.08em',
                            lineHeight: 1,
                            padding: '10px 0',
                          }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        {/* Type */}
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-1)',
                            padding: '4px 0',
                          }}
                        >
                          {type}
                        </div>
                        {/* Target + assertion */}
                        <div className="space-y-2">
                          <div
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '17px',
                              color: 'var(--ink-0)',
                              textTransform: 'lowercase',
                              letterSpacing: '0.01em',
                              lineHeight: 1.25,
                            }}
                          >
                            {target}
                          </div>
                          {assertion && (
                            <div
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--ink-2)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              <span style={{ color: 'var(--accent)' }}>⊢ </span>
                              expect · {assertion}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Dim callout between plates */}
                      {i < steps.length - 1 && (
                        <div
                          className="vt-dim-h"
                          style={{ margin: '6px 0' }}
                          aria-hidden
                        >
                          <span className="tick-l" />
                          <span className="tick-r" />
                          <span className="v">THEN</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inline StepEditor for authoring changes */}
            <div
              className="mt-6 pt-6"
              style={{ borderTop: '1px solid var(--rule-strong)' }}
            >
              <div
                className="mb-4"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                — REVISE STEPS —
              </div>
              <StepEditor
                steps={steps}
                platform={(test as any)?.platform || 'WEB'}
                onChange={(newSteps) => {
                  setEditedSteps(newSteps);
                  setHasChanges(true);
                }}
              />
            </div>
          </Plate>
        </TabsContent>

        {/* --- SETTINGS --- */}
        <TabsContent value="settings" className="space-y-6">
          <Plate leader="FIG. 2 · PART IDENTITY" stamp="EDITABLE">
            <div className="space-y-5">
              <label className="block space-y-2">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  — PART NAME
                </span>
                <input
                  value={name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="vt-input"
                />
              </label>
              <label className="block space-y-2">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  — GOAL / DESCRIPTION
                </span>
                <input
                  value={description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="optional summary"
                  className="vt-input"
                />
              </label>
            </div>
          </Plate>

          <Plate leader="FIG. 3 · CAPTURE SPEC" stamp="EXECUTION">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-0)',
                    }}
                  >
                    SCREENSHOT EVERY STEP
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--ink-2)',
                      marginTop: '4px',
                    }}
                  >
                    Required for film-strip and Set-as-baseline.
                  </p>
                </div>
                <Switch
                  checked={screenshotEveryStep}
                  onCheckedChange={(checked) => {
                    setScreenshotEveryStep(checked);
                    setHasChanges(true);
                  }}
                />
              </div>
              <div
                className="pt-4 flex items-center justify-between gap-4"
                style={{ borderTop: '1px solid var(--rule)' }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-0)',
                    }}
                  >
                    RECORD VIDEO
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--ink-2)',
                      marginTop: '4px',
                    }}
                  >
                    Full session capture. Heavier; useful for forensics.
                  </p>
                </div>
                <Switch
                  checked={videoRecording}
                  onCheckedChange={(checked) => {
                    setVideoRecording(checked);
                    setHasChanges(true);
                  }}
                />
              </div>
            </div>
          </Plate>

          {test.flakyScore !== undefined && test.flakyScore > 0 && (
            <Plate
              leader="FIG. 4 · FLAKINESS"
              stamp={
                <span style={{ color: 'var(--warn)' }}>DETECTED</span>
              }
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      FLAKY SCORE
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        color:
                          test.flakyScore > 50
                            ? 'var(--fail)'
                            : test.flakyScore > 20
                              ? 'var(--warn)'
                              : 'var(--pass)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {String(test.flakyScore).padStart(2, '0')}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '2px',
                      background: 'var(--rule)',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${test.flakyScore}%`,
                        height: '100%',
                        background:
                          test.flakyScore > 50
                            ? 'var(--fail)'
                            : test.flakyScore > 20
                              ? 'var(--warn)'
                              : 'var(--pass)',
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => quarantineMutation.mutate()}
                  disabled={quarantineMutation.isPending}
                  className={`vt-btn${test.status === 'QUARANTINED' ? ' vt-btn--primary' : ''}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {test.status === 'QUARANTINED'
                    ? 'RELEASE FROM QUARANTINE'
                    : 'QUARANTINE PART'}
                </button>
              </div>
            </Plate>
          )}
        </TabsContent>

        {/* --- VISUALS --- */}
        <TabsContent value="visuals" className="space-y-4">
          {testVisuals.length === 0 ? (
            <Plate leader="FIG. 5 · VISUALS" stamp="NO SNAPSHOTS">
              <div
                className="py-12 text-center"
                style={{
                  border: '1px dashed var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                — no snapshots · run the part to generate plates —
              </div>
            </Plate>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testVisuals.map((visual, i) => (
                <Link key={visual.id} href={`/visual/${visual.id}`}>
                  <div
                    className="p-4 transition-colors"
                    style={{
                      border: '1px solid var(--rule-strong)',
                      background: 'color-mix(in oklab, var(--bg-1) 45%, transparent)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--accent)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--rule-strong)')
                    }
                  >
                    <div
                      className="flex items-center justify-between pb-2 mb-3"
                      style={{
                        borderBottom: '1px solid var(--rule)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <span>PLATE {String(i + 1).padStart(2, '0')}</span>
                      <span
                        className={`vt-rev-stamp ${
                          visual.status === 'approved'
                            ? 'vt-rev-stamp--pass'
                            : visual.status === 'rejected'
                              ? 'vt-rev-stamp--reject'
                              : ''
                        }`}
                      >
                        {(visual.status || 'PENDING').toString().toUpperCase()}
                      </span>
                    </div>
                    <div
                      className="flex items-center justify-center"
                      style={{
                        aspectRatio: '16 / 9',
                        background: 'var(--bg-2)',
                        border: '1px dashed var(--rule)',
                      }}
                    >
                      <ImageIcon
                        className="w-8 h-8"
                        strokeWidth={1.5}
                        style={{ color: 'var(--ink-3)' }}
                      />
                    </div>
                    <div
                      className="mt-3"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {new Date(visual.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- MASKS --- */}
        <TabsContent value="masks" className="space-y-4">
          <Plate leader="FIG. 6 · IGNORE MASKS" stamp={`${masks?.length || 0} REGIONS`}>
            {!masks || masks.length === 0 ? (
              <div
                className="py-12 text-center"
                style={{
                  border: '1px dashed var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                — no masks defined for this part —
              </div>
            ) : (
              <div>
                {masks.map((mask, i) => (
                  <div
                    key={mask.id}
                    className="grid items-center px-4 py-3"
                    style={{
                      gridTemplateColumns: '40px 1fr 1fr auto',
                      gap: '16px',
                      borderBottom:
                        i < masks.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      M-{String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '15px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                      }}
                    >
                      {mask.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ({mask.x}, {mask.y}) · {mask.width}×{mask.height}
                    </span>
                    <span className="vt-chip">{mask.type}</span>
                  </div>
                ))}
              </div>
            )}
          </Plate>
        </TabsContent>

        {/* --- HISTORY --- */}
        <TabsContent value="history">
          <Plate leader="FIG. 7 · REVISION HISTORY" stamp="EXECUTION LOG">
            {(() => {
              const executions = (test as any).recentExecutions as
                | Array<{
                    id: string;
                    status: string;
                    duration?: number;
                    createdAt: string;
                  }>
                | undefined;
              if (!executions || executions.length === 0) {
                return (
                  <div
                    className="py-12 text-center"
                    style={{
                      border: '1px dashed var(--rule)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                    }}
                  >
                    — no runs yet · run the part to log history —
                  </div>
                );
              }
              return (
                <div>
                  {/* Header row */}
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: '60px 120px 1fr 120px',
                      borderBottom: '1px solid var(--rule)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <div className="py-2 px-3">REV</div>
                    <div className="py-2 px-3">RESULT</div>
                    <div className="py-2 px-3">TIMESTAMP</div>
                    <div className="py-2 px-3 text-right">DURATION</div>
                  </div>
                  {executions.map((exec, i) => {
                    const execStatus = normalizeStatus(exec.status);
                    const execMeta = STATUS_META[execStatus];
                    return (
                      <Link key={exec.id} href={`/executions/${exec.id}`}>
                        <div
                          className="grid items-center transition-colors"
                          style={{
                            gridTemplateColumns: '60px 120px 1fr 120px',
                            borderBottom:
                              i < executions.length - 1
                                ? '1px solid var(--rule-soft)'
                                : 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--bg-2)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = 'transparent')
                          }
                        >
                          <div
                            className="py-3 px-3"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--accent)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {String(executions.length - i).padStart(2, '0')}
                          </div>
                          <div className="py-3 px-3">
                            <span
                              className={`vt-rev-stamp ${
                                execMeta.variant
                                  ? `vt-rev-stamp${execMeta.variant}`
                                  : ''
                              }`}
                            >
                              {execMeta.label}
                            </span>
                          </div>
                          <div
                            className="py-3 px-3"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--ink-1)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {new Date(exec.createdAt)
                              .toISOString()
                              .slice(0, 19)
                              .replace('T', ' ')}
                          </div>
                          <div
                            className="py-3 px-3 text-right"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--ink-2)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {exec.duration != null
                              ? `${(exec.duration / 1000).toFixed(1)}s`
                              : '—'}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </Plate>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className="vt-display"
              style={{ fontSize: '28px', color: 'var(--ink-0)', textTransform: 'lowercase' }}
            >
              strike <em style={{ color: 'var(--fail)', fontStyle: 'normal' }}>part</em> from schedule?
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-1)',
              }}
            >
              Part{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {partId(test.id)}
              </span>{' '}
              <em style={{ color: 'var(--ink-0)' }}>&quot;{test.name}&quot;</em>{' '}
              will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowDelete(false)}
              className="vt-btn"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="vt-btn"
              style={{
                background: 'var(--fail)',
                borderColor: 'var(--fail)',
                color: 'var(--bg-0)',
              }}
            >
              {deleteMutation.isPending ? 'STRIKING…' : 'STRIKE FROM SCHEDULE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorialHero>
  );
}
