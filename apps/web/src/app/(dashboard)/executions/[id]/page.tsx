'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentProject } from '@/hooks/useProject';
import { api, getAuthToken } from '@/lib/api';
import { ScreenshotGallery, type GalleryScreenshot } from '@/components/screenshot-gallery';
import { FilmStrip } from '@/components/execution/FilmStrip';
import { GoalEvalCard } from '@/components/execution/GoalEvalCard';
import { VideoPlayer } from '@/components/video-player';
import { LiveBrowserViewer } from '@/components/live-browser-viewer';

interface ExecutionStep {
  index: number;
  action: string;
  selector?: string;
  value?: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  screenshot?: string;
  error?: string;
}

interface Execution {
  id: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  triggeredBy: string;
  platform?: string;
  mode?: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  test?: { id: string; name: string; steps: unknown[]; goal?: string | null };
  screenshots?: { id: string; stepNumber: number; url: string; name: string }[];
  videos?: { id: string; url: string; format?: string }[];
  goalAchieved?: boolean | null;
  goalReasoning?: string | null;
  goalChecks?: Array<{
    kind: string;
    selector?: string;
    value?: string;
    urlOp?: string;
    source: string;
    passed: boolean;
    error?: string;
    actual?: string;
  }> | null;
}

interface StreamEvent {
  type: string;
  executionId: string;
  status?: string;
  stepIndex?: number;
  total?: number;
  screenshot?: string;
  error?: string;
  timestamp: number;
}

const statusLabels: Record<Execution['status'], string> = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  PASSED: 'PASS',
  FAILED: 'REJECT',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
};

export default function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: executionId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();
  const eventSourceRef = useRef<EventSource | null>(null);

  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [logs, setLogs] = useState<string[]>([]);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<GalleryScreenshot[]>([]);
  const [selectedScreenshotStep, setSelectedScreenshotStep] = useState<number | undefined>();
  const [videos, setVideos] = useState<{ url: string; format?: string }[]>([]);
  const [viewMode, setViewMode] = useState<'live' | 'screenshots'>('screenshots');
  const [isLive, setIsLive] = useState(false);

  // Fetch execution details
  const { data: execution, isLoading } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: async () => {
      return api.get<Execution>(`/executions/${executionId}`);
    },
    refetchInterval: isLive ? false : 5000, // Poll only when not streaming
  });

  // Initialize steps from test data
  useEffect(() => {
    if (execution?.test?.steps && steps.length === 0) {
      let rawSteps = execution.test.steps;
      if (typeof rawSteps === 'string') {
        try {
          rawSteps = JSON.parse(rawSteps);
        } catch {
          rawSteps = [];
        }
      }
      if (!Array.isArray(rawSteps)) {
        rawSteps = [];
      }
      const testSteps = rawSteps as Array<{ type?: string; action?: string; selector?: string; value?: string; url?: string; name?: string }>;
      setSteps(
        testSteps.map((step, index) => ({
          index,
          action: step.type || step.action || 'unknown',
          selector: step.selector || step.url,
          value: step.value || step.name,
          status: 'pending',
        }))
      );
    }
  }, [execution, steps.length]);

  // Load screenshots and videos from completed execution
  useEffect(() => {
    if (!execution) return;
    const token = getAuthToken();

    if (execution.screenshots && execution.screenshots.length > 0 && screenshots.length === 0) {
      const loaded: GalleryScreenshot[] = execution.screenshots.map((s) => {
        const url = token
          ? `${s.url}${s.url.includes('?') ? '&' : '?'}token=${token}`
          : s.url;
        return { stepIndex: s.stepNumber, url };
      });
      setScreenshots(loaded);
      if (loaded.length > 0) {
        setLatestScreenshot(loaded[loaded.length - 1].url);
      }
    }

    if (execution.videos && execution.videos.length > 0 && videos.length === 0) {
      setVideos(execution.videos.map((v) => ({
        url: token ? `${v.url}${v.url.includes('?') ? '&' : '?'}token=${token}` : v.url,
        format: v.format,
      })));
    }
  }, [execution]);

  // Set up SSE connection for live updates
  useEffect(() => {
    if (!execution) return;

    const isRunning = ['PENDING', 'QUEUED', 'RUNNING'].includes(execution.status);
    if (!isRunning) {
      setIsLive(false);
      return;
    }

    setIsLive(true);
    setViewMode('live');

    const token = getAuthToken();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const streamUrl = `${baseUrl}/stream/executions/${executionId}`;

    const eventSource = new EventSource(`${streamUrl}?token=${token}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: StreamEvent = JSON.parse(event.data);
        handleStreamEvent(data);
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsLive(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [execution?.status, executionId]);

  const handleStreamEvent = (event: StreamEvent) => {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();

    switch (event.type) {
      case 'execution:status':
        addLog(`[${timestamp}] Status: ${event.status}`);
        if (['PASSED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(event.status || '')) {
          setIsLive(false);
          queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
        }
        break;

      case 'step:start':
        addLog(`[${timestamp}] Starting step ${(event.stepIndex || 0) + 1}/${event.total}`);
        setCurrentStep(event.stepIndex || 0);
        setSteps((prev) =>
          prev.map((s, i) =>
            i === event.stepIndex ? { ...s, status: 'running' } : s
          )
        );
        break;

      case 'step:complete':
        addLog(`[${timestamp}] Step ${(event.stepIndex || 0) + 1} completed`);
        setSteps((prev) =>
          prev.map((s, i) =>
            i === event.stepIndex ? { ...s, status: 'passed' } : s
          )
        );
        break;

      case 'step:failed':
        addLog(`[${timestamp}] Step ${(event.stepIndex || 0) + 1} failed: ${event.error}`);
        setSteps((prev) =>
          prev.map((s, i) =>
            i === event.stepIndex ? { ...s, status: 'failed', error: event.error } : s
          )
        );
        break;

      case 'screenshot':
        addLog(`[${timestamp}] Screenshot captured (step ${(event.stepIndex || 0) + 1})`);
        if (event.screenshot) {
          const token = getAuthToken();
          const screenshotUrl = token
            ? `${event.screenshot}${event.screenshot.includes('?') ? '&' : '?'}token=${token}`
            : event.screenshot;
          setLatestScreenshot(screenshotUrl);
          setScreenshots((prev) => [
            ...prev,
            { stepIndex: event.stepIndex || 0, url: screenshotUrl, timestamp: event.timestamp },
          ]);
        }
        break;

      case 'video:ready':
        addLog(`[${timestamp}] Video recording ready`);
        queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
        break;

      case 'checkpoint':
        addLog(`[${timestamp}] Checkpoint saved`);
        break;

      default:
        addLog(`[${timestamp}] ${event.type}`);
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev.slice(-99), message]);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '——';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (isLoading || !execution) {
    return (
      <div className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />
        <div
          className="py-24 text-center flex items-center justify-center gap-4"
          style={{
            border: '1px dashed var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>— LOADING SHEET —</span>
        </div>
      </div>
    );
  }

  const passedCount = steps.filter((s) => s.status === 'passed').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const progress = steps.length > 0 ? (passedCount / steps.length) * 100 : 0;

  const stampClass =
    execution.status === 'PASSED'
      ? 'vt-rev-stamp vt-rev-stamp--pass'
      : execution.status === 'FAILED'
      ? 'vt-rev-stamp vt-rev-stamp--reject'
      : 'vt-rev-stamp';

  const runDate = new Date(execution.createdAt);
  const startedDate = execution.startedAt ? new Date(execution.startedAt) : null;

  const runIdShort = execution.id.slice(-8).toUpperCase();
  const env = (execution.platform || 'WEB').toUpperCase();
  const mode = (execution.mode || 'STEP').toUpperCase();
  const trig = (execution.triggeredBy || 'MANUAL').toUpperCase();

  return (
    <div className="min-h-screen">
      {/* SHEET · RUN DETAIL ─────────────────────────────────────── */}
      <section className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />

        {/* Top strip: back link + sheet metadata */}
        <div
          className="flex items-center gap-4 mb-6 flex-wrap"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/executions')}
            className="inline-flex items-center gap-2 transition-colors"
            style={{ color: 'var(--ink-1)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
            BACK TO REGISTER
          </button>
          <span style={{ color: 'var(--ink-3)' }}>·</span>
          <span>SHT · 03.R</span>
          <span style={{ color: 'var(--ink-3)' }}>·</span>
          <span>{runDate.toISOString().slice(0, 10).replace(/-/g, '.')}</span>
          <span className="ml-auto flex items-center gap-3">
            <span className={stampClass}>{statusLabels[execution.status]}</span>
            {isLive && (
              <span className="vt-chip vt-chip--accent vt-breathe" style={{ letterSpacing: '0.24em' }}>
                LIVE
              </span>
            )}
          </span>
        </div>

        {/* Title block — drawing-sheet masthead with grid of metadata */}
        <div className="mb-10">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              lineHeight: 0.98,
              letterSpacing: '-0.01em',
              textTransform: 'lowercase',
              color: 'var(--ink-0)',
              margin: 0,
            }}
          >
            {(() => {
              const name = (execution.test?.name || 'execution').toLowerCase();
              const parts = name.split(' ');
              if (parts.length < 2) return name;
              return (
                <>
                  {parts.slice(0, -1).join(' ')}{' '}
                  <span style={{ color: 'var(--accent)' }}>{parts.slice(-1)}</span>
                </>
              );
            })()}
          </h1>

          {/* Title-block metadata grid */}
          <div className="vt-title-block mt-7">
            <div className="span2">
              <span className="k">RUN ID</span>
              <span className="v big" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                #{runIdShort}
              </span>
            </div>
            <div>
              <span className="k">STARTED</span>
              <span className="v">
                {startedDate
                  ? startedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                  : '——:——'}
              </span>
            </div>
            <div>
              <span className="k">DURATION</span>
              <span className="v">{formatDuration(execution.duration)}</span>
            </div>
            <div>
              <span className="k">ENV</span>
              <span className="v">{env}</span>
            </div>
            <div>
              <span className="k">MODE</span>
              <span className="v">{mode}</span>
            </div>

            <div className="span2">
              <span className="k">TEST SPEC</span>
              <span className="v">
                {execution.test?.id ? (
                  <Link
                    href={`/tests/${execution.test.id}`}
                    style={{ color: 'var(--ink-0)' }}
                    className="hover:text-[color:var(--accent)] transition-colors"
                  >
                    OPEN SPEC →
                  </Link>
                ) : (
                  '——'
                )}
              </span>
            </div>
            <div>
              <span className="k">TRIGGERED</span>
              <span className="v">{trig}</span>
            </div>
            <div>
              <span className="k">STEPS</span>
              <span className="v" style={{ fontFamily: 'var(--font-mono)' }}>
                {String(steps.length).padStart(2, '0')}
              </span>
            </div>
            <div>
              <span className="k">PASS</span>
              <span className="v" style={{ color: 'var(--pass)', fontFamily: 'var(--font-mono)' }}>
                {String(passedCount).padStart(2, '0')}
              </span>
            </div>
            <div>
              <span className="k">REJECT</span>
              <span className="v" style={{ color: 'var(--fail)', fontFamily: 'var(--font-mono)' }}>
                {String(failedCount).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* ACTIONS BAR — ruled, no shadows */}
          <div
            className="mt-6 flex flex-wrap items-center gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 30%, transparent)',
            }}
          >
            <span
              className="px-4 py-3"
              style={{
                borderRight: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              ACTIONS
            </span>

            {isLive && (
              <button
                type="button"
                onClick={() => {
                  api.post(`/executions/${executionId}/stop`).then(() => {
                    toast.success('Execution stopped');
                    queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
                  }).catch(() => toast.error('Failed to stop execution'));
                }}
                className="px-5 py-3 transition-colors"
                style={{
                  borderRight: '1px solid var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--fail)',
                  background: 'var(--fail-soft)',
                }}
              >
                ■ STOP
              </button>
            )}

            {!isLive && execution.status !== 'PENDING' && (
              <button
                type="button"
                onClick={() => {
                  api.post(`/executions/${executionId}/rerun`).then((data: any) => {
                    toast.success('Rerun started');
                    router.push(`/executions/${data.id || data.execution?.id || executionId}`);
                  }).catch(() => toast.error('Failed to rerun'));
                }}
                className="px-5 py-3 transition-colors"
                style={{
                  borderRight: '1px solid var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-1)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
              >
                ↻ RERUN
              </button>
            )}

            {!isLive && execution.status !== 'PENDING' && (
              <button
                type="button"
                onClick={() => {
                  api.post(`/executions/${executionId}/compare`).then(() => {
                    toast.success('Visual comparison started');
                    queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
                  }).catch(() => toast.error('Failed to start comparison'));
                }}
                className="px-5 py-3 transition-colors"
                style={{
                  borderRight: '1px solid var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-1)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
              >
                ⊕ COMPARE
              </button>
            )}

            {!isLive && execution.status === 'PASSED' && screenshots.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await api.post<any>(
                      `/baselines/from-execution/${executionId}`,
                      {},
                    );
                    toast.success(
                      res.replaced
                        ? `Baseline "${res.name}" updated — future runs will compare to these ${screenshots.length} screenshots`
                        : `Baseline "${res.name}" created — future runs will compare to these ${screenshots.length} screenshots`,
                    );
                    queryClient.invalidateQueries({ queryKey: ['baselines'] });
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to set baseline');
                  }
                }}
                title="Promote these screenshots to a baseline. Future runs will compare against them."
                className="px-5 py-3 transition-colors"
                style={{
                  borderRight: '1px solid var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                }}
              >
                ★ SET AS BASELINE
              </button>
            )}

            {execution.status === 'FAILED' && (
              <button
                type="button"
                onClick={() => {
                  api.post('/fixes/candidates', {
                    projectId: project?.id,
                    executionId: executionId,
                    testId: execution.test?.id,
                    sourceType: 'execution',
                    title: `Failed execution: ${execution.test?.name || executionId}`,
                    plainLanguageSummary: execution.errorMessage || 'Test execution failed',
                    failureType: 'RUNTIME',
                    severity: 'MEDIUM',
                  }).then((data: any) => {
                    toast.success('Bug candidate created');
                    router.push(`/fixes/${data.id}`);
                  }).catch(() => toast.error('Failed to create bug candidate'));
                }}
                className="px-5 py-3 transition-colors"
                style={{
                  borderRight: '1px solid var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--fail)',
                  background: 'var(--fail-soft)',
                }}
              >
                ⚑ INVESTIGATE & FIX
              </button>
            )}
          </div>
        </div>

        {/* LIVE PROGRESS ─────────────────────────────────────────── */}
        {isLive && (
          <div className="mb-10" style={{ border: '1px solid var(--rule-strong)', padding: '16px' }}>
            <div
              className="flex items-center justify-between mb-3"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>STEP {String(currentStep + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
              <span style={{ color: 'var(--accent)' }}>{Math.round(progress)}% COMPLETE</span>
            </div>
            <div style={{ height: '2px', background: 'var(--rule)', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progress}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* GOAL EVAL (kept component, sits inside the sheet) ─────── */}
        {(execution.goalAchieved !== null && execution.goalAchieved !== undefined) && (
          <div className="mb-10">
            <GoalEvalCard
              achieved={execution.goalAchieved}
              reasoning={execution.goalReasoning}
              checks={execution.goalChecks}
              goal={execution.test?.goal}
            />
          </div>
        )}

        {/* TEACHING — empty frame strip for PASSED runs with no screenshots */}
        {!isLive &&
          execution.status === 'PASSED' &&
          (execution as any).mode !== 'EXPLORE' &&
          screenshots.length === 0 && (
            <div
              className="mb-10 p-6"
              style={{ border: '1px dashed var(--rule)' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: '10px',
                }}
              >
                § NOTE — NO PLATES CAPTURED
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                  maxWidth: '64ch',
                  margin: 0,
                }}
              >
                The set-as-baseline stamp and the frame strip both need at least one plate. Enable{' '}
                <span style={{ color: 'var(--accent)' }}>Screenshot every step</span> in this test&apos;s settings and re-run.
              </p>
              {execution.test?.id && (
                <Link
                  href={`/tests/${execution.test.id}`}
                  className="vt-btn inline-flex mt-4"
                >
                  OPEN TEST SETTINGS
                </Link>
              )}
            </div>
          )}

        {/* SECTION · FRAME STRIP ─────────────────────────────────── */}
        <div className="vt-section-head" style={{ margin: '24px 0 20px' }}>
          <span className="num">§ 01</span>
          <span className="ttl">frame strip · plates in sequence</span>
          <span className="rule" />
          <span className="stamp">{String(steps.length).padStart(2, '0')} FRAMES</span>
        </div>

        {!isLive && screenshots.length > 0 && (
          <div className="mb-6">
            <FilmStrip
              frames={steps.map((s, i) => ({
                stepIndex: i,
                screenshotUrl:
                  screenshots.find((sc) => sc.stepIndex === i)?.url || null,
                status: s.status,
              }))}
              selectedStep={selectedScreenshotStep ?? 0}
              onSelect={setSelectedScreenshotStep}
            />
          </div>
        )}

        {/* Numbered step-frames — drawn as sheet thumbnails with callouts */}
        {steps.length > 0 ? (
          <div
            className="grid gap-0 mb-10"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 30%, transparent)',
            }}
          >
            {steps.map((step, index) => {
              const stepShot = screenshots.find((sc) => sc.stepIndex === index)?.url;
              const stampCls =
                step.status === 'passed'
                  ? 'vt-rev-stamp vt-rev-stamp--pass'
                  : step.status === 'failed'
                  ? 'vt-rev-stamp vt-rev-stamp--reject'
                  : 'vt-rev-stamp';
              const stampLabel =
                step.status === 'passed'
                  ? 'PASS'
                  : step.status === 'failed'
                  ? 'REJECT'
                  : step.status === 'running'
                  ? 'RUN'
                  : 'PEND';
              const selected = selectedScreenshotStep === index;
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => setSelectedScreenshotStep(index)}
                  className="text-left transition-colors"
                  style={{
                    borderRight: '1px solid var(--rule)',
                    borderBottom: '1px solid var(--rule)',
                    padding: '14px',
                    background: selected ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {/* Frame header — § number + dimension callout */}
                  <div
                    className="flex items-center justify-between mb-3"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9.5px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ color: 'var(--accent)' }}>§{String(index + 1).padStart(2, '0')}</span>
                    <span>{(step.action || 'STEP').toUpperCase()}</span>
                  </div>

                  {/* Plate — thumbnail or placeholder */}
                  <div
                    style={{
                      border: '1px solid var(--rule)',
                      background: 'var(--bg-3)',
                      aspectRatio: '16/10',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {stepShot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={stepShot}
                        alt={`Step ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-3)',
                        }}
                      >
                        {step.status === 'running' ? '— CAPTURING —' : '— NO PLATE —'}
                      </div>
                    )}
                  </div>

                  {/* Leader + stamp */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {step.selector && (
                        <div
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--ink-2)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {step.selector}
                        </div>
                      )}
                      {step.value && (
                        <div
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--ink-3)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          ↳ {step.value}
                        </div>
                      )}
                      {step.error && (
                        <div
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--fail)',
                            letterSpacing: '0.04em',
                          }}
                          title={step.error}
                        >
                          ! {step.error}
                        </div>
                      )}
                    </div>
                    <span className={stampCls} style={{ fontSize: '9px', padding: '3px 7px', flexShrink: 0 }}>
                      {stampLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className="py-16 text-center mb-10"
            style={{
              border: '1px dashed var(--rule)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            — NO STEPS RECORDED —
          </div>
        )}

        {/* LIVE VIEW / SCREENSHOT GALLERY / VIDEO ─────────────────── */}
        <div className="vt-section-head">
          <span className="num">§ 02</span>
          <span className="ttl">visual record · plates &amp; motion</span>
          <span className="rule" />
          <span className="stamp">{String(screenshots.length).padStart(2, '0')} PLATES</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0"
          style={{ border: '1px solid var(--rule-strong)' }}
        >
          {/* LEFT PANE — Live / Screenshots */}
          <div style={{ borderRight: '1px solid var(--rule)', padding: '18px' }}>
            {isLive && (
              <div
                className="flex gap-0 mb-4"
                style={{ border: '1px solid var(--rule)' }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('live')}
                  className="flex-1 py-2 px-3 transition-colors"
                  style={{
                    borderRight: '1px solid var(--rule)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: viewMode === 'live' ? 'var(--accent)' : 'var(--ink-2)',
                    background: viewMode === 'live' ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  ● WATCH LIVE
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('screenshots')}
                  className="flex-1 py-2 px-3 transition-colors"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: viewMode === 'screenshots' ? 'var(--accent)' : 'var(--ink-2)',
                    background: viewMode === 'screenshots' ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  ▦ PLATES ({screenshots.length})
                </button>
              </div>
            )}

            <div
              className="flex items-center justify-between mb-3 pb-2"
              style={{
                borderBottom: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              <span>
                FIG. A · {isLive && viewMode === 'live' ? 'LIVE BROWSER' : 'PLATE SET'}
              </span>
              <span>{isLive && viewMode === 'live' ? 'REAL-TIME' : `${screenshots.length} PLATES`}</span>
            </div>

            {isLive && viewMode === 'live' ? (
              <LiveBrowserViewer executionId={executionId} />
            ) : screenshots.length > 0 ? (
              <ScreenshotGallery
                screenshots={screenshots}
                steps={steps.map((s) => ({
                  index: s.index,
                  action: s.action,
                  status: s.status,
                }))}
                selectedStep={selectedScreenshotStep}
                onSelectStep={setSelectedScreenshotStep}
              />
            ) : latestScreenshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={latestScreenshot}
                alt="Latest plate"
                style={{ width: '100%', border: '1px solid var(--rule)' }}
              />
            ) : (
              <div
                className="flex items-center justify-center"
                style={{
                  aspectRatio: '16/10',
                  border: '1px dashed var(--rule)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                {isLive ? '— WAITING FOR PLATE —' : '— NO PLATES —'}
              </div>
            )}

            {/* VIDEO — shown below when present and not live */}
            {!isLive && videos.length > 0 && (
              <div className="mt-6">
                <div
                  className="flex items-center justify-between mb-3 pb-2"
                  style={{
                    borderBottom: '1px solid var(--rule)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  <span>FIG. B · MOTION RECORD</span>
                  <span>MP4 · {videos[0].format || 'WEBM'}</span>
                </div>
                <VideoPlayer
                  src={videos[0].url}
                  poster={screenshots.length > 0 ? screenshots[0].url : undefined}
                />
              </div>
            )}
          </div>

          {/* RIGHT PANE — Live log / printout */}
          <div style={{ padding: '18px' }}>
            <div
              className="flex items-center justify-between mb-3 pb-2"
              style={{
                borderBottom: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              <span>PRINTOUT · EVENT LOG</span>
              <span>{String(logs.length).padStart(3, '0')} LINES</span>
            </div>
            <div
              style={{
                height: '420px',
                overflowY: 'auto',
                background: 'var(--bg-3)',
                border: '1px solid var(--rule)',
                padding: '14px 16px',
                borderLeft: '3px solid var(--rule-strong)', // faint hairline gutter
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                lineHeight: 1.6,
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {logs.length === 0 ? (
                <span style={{ color: 'var(--ink-3)' }}>
                  {isLive ? '— WAITING FOR EVENTS —' : '— NO LOG ENTRIES —'}
                </span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ color: 'var(--ink-1)' }}>
                    <span style={{ color: 'var(--ink-3)', marginRight: '10px' }}>
                      {String(i + 1).padStart(3, '0')}
                    </span>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECTION · RAW DATA ─────────────────────────────────────── */}
        <div className="vt-section-head">
          <span className="num">§ 03</span>
          <span className="ttl">raw data · run metadata</span>
          <span className="rule" />
          <span className="stamp">PRINTOUT</span>
        </div>

        <div
          style={{
            border: '1px solid var(--rule-strong)',
            background: 'color-mix(in oklab, var(--bg-1) 30%, transparent)',
          }}
        >
          <dl
            className="grid grid-cols-2 md:grid-cols-4"
            style={{ margin: 0 }}
          >
            {[
              { k: 'STATUS', v: statusLabels[execution.status], c: execution.status === 'PASSED' ? 'var(--pass)' : execution.status === 'FAILED' ? 'var(--fail)' : 'var(--ink-0)' },
              { k: 'DURATION', v: formatDuration(execution.duration) },
              { k: 'TRIGGERED BY', v: (execution.triggeredBy || '——').toUpperCase() },
              { k: 'CREATED', v: new Date(execution.createdAt).toLocaleString() },
              execution.platform ? { k: 'PLATFORM', v: execution.platform.toUpperCase() } : null,
              execution.startedAt ? { k: 'STARTED', v: new Date(execution.startedAt).toLocaleString() } : null,
              execution.completedAt ? { k: 'COMPLETED', v: new Date(execution.completedAt).toLocaleString() } : null,
              { k: 'RUN ID', v: execution.id },
            ].filter(Boolean).map((row: any, i: number) => (
              <div
                key={row.k}
                style={{
                  padding: '14px 16px',
                  borderRight: '1px solid var(--rule)',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                <dt
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                    marginBottom: '6px',
                  }}
                >
                  {row.k}
                </dt>
                <dd
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    letterSpacing: '0.04em',
                    color: row.c || 'var(--ink-0)',
                    fontVariantNumeric: 'tabular-nums',
                    margin: 0,
                    wordBreak: 'break-all',
                  }}
                >
                  {row.v}
                </dd>
              </div>
            ))}
          </dl>
          {execution.errorMessage && (
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--fail-soft)',
                borderTop: '1px solid var(--fail)',
                borderLeft: '3px solid var(--fail)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'var(--fail)',
                  marginBottom: '6px',
                }}
              >
                § ERROR · REDLINE
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--fail)',
                  lineHeight: 1.5,
                  margin: 0,
                  wordBreak: 'break-word',
                }}
              >
                {execution.errorMessage}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
