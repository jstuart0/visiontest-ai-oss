'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ImageIcon,
  Terminal,
  Loader2,
  Video,
  Radio,
  Square,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCurrentProject } from '@/hooks/useProject';
import { api, getAuthToken } from '@/lib/api';
import { ScreenshotGallery, type GalleryScreenshot, type GalleryStep } from '@/components/screenshot-gallery';
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
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  test?: { id: string; name: string; steps: unknown[] };
  screenshots?: { id: string; stepNumber: number; url: string; name: string }[];
  videos?: { id: string; url: string; format?: string }[];
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

const statusConfig = {
  PENDING: { icon: Clock, color: 'bg-muted', textColor: 'text-muted-foreground', label: 'Pending' },
  QUEUED: { icon: Clock, color: 'bg-yellow-500', textColor: 'text-yellow-400', label: 'Queued' },
  RUNNING: { icon: Activity, color: 'bg-blue-500', textColor: 'text-blue-400', label: 'Running' },
  PASSED: { icon: CheckCircle2, color: 'bg-green-500', textColor: 'text-green-400', label: 'Passed' },
  FAILED: { icon: XCircle, color: 'bg-red-500', textColor: 'text-red-400', label: 'Failed' },
  CANCELLED: { icon: AlertTriangle, color: 'bg-orange-500', textColor: 'text-orange-400', label: 'Cancelled' },
  TIMEOUT: { icon: AlertTriangle, color: 'bg-orange-500', textColor: 'text-orange-400', label: 'Timeout' },
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
      // Parse steps if it's a JSON string
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

    // Load screenshots from execution response
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

    // Load videos from execution response
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

    // Note: EventSource doesn't support custom headers, so we pass token as query param
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
        // Refetch execution to get video data
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
    setLogs((prev) => [...prev.slice(-99), message]); // Keep last 100 logs
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (isLoading || !execution) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const config = statusConfig[execution.status];
  const StatusIcon = config.icon;
  const progress = steps.length > 0 
    ? (steps.filter((s) => s.status === 'passed').length / steps.length) * 100 
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/executions')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {execution.test?.name || 'Execution'}
            </h1>
            <Badge className={`${config.color} text-white`}>
              {config.label}
            </Badge>
            {isLive && (
              <Badge className="bg-blue-500 text-white animate-pulse">
                🔴 LIVE
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            ID: {execution.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                api.post(`/executions/${executionId}/stop`).then(() => {
                  toast.success('Execution stopped');
                  queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
                }).catch(() => toast.error('Failed to stop execution'));
              }}
            >
              <Square className="h-3 w-3 mr-1" /> Stop
            </Button>
          )}
          {!isLive && execution.status !== 'PENDING' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                api.post(`/executions/${executionId}/rerun`).then((data: any) => {
                  toast.success('Rerun started');
                  router.push(`/executions/${data.id || data.execution?.id || executionId}`);
                }).catch(() => toast.error('Failed to rerun'));
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Rerun
            </Button>
          )}
          {!isLive && execution.status !== 'PENDING' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                api.post(`/executions/${executionId}/compare`).then(() => {
                  toast.success('Visual comparison started');
                  queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
                }).catch(() => toast.error('Failed to start comparison'));
              }}
            >
              Compare
            </Button>
          )}
          {execution.status === 'FAILED' && (
            <Button
              variant="outline"
              size="sm"
              className="text-orange-600 border-orange-600/30 hover:bg-orange-600/10"
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
            >
              Investigate & Fix
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar for running executions */}
      {isLive && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}% complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Steps Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Test Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {steps.length === 0 ? (
                <p className="text-muted-foreground text-sm">No steps available</p>
              ) : (
                steps.map((step, index) => {
                  const stepStatusConfig = {
                    pending: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/50' },
                    running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    passed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
                    failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
                  };
                  const stepConfig = stepStatusConfig[step.status];
                  const StepIcon = stepConfig.icon;

                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${stepConfig.bg} ${
                        step.status === 'running' ? 'ring-2 ring-blue-500/50' : ''
                      } ${selectedScreenshotStep === index ? 'ring-2 ring-blue-400/70' : ''}`}
                      onClick={() => setSelectedScreenshotStep(index)}
                    >
                      <StepIcon
                        className={`h-5 w-5 mt-0.5 ${stepConfig.color} ${
                          step.status === 'running' ? 'animate-spin' : ''
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {index + 1}. {step.action}
                          </span>
                        </div>
                        {step.selector && (
                          <code className="text-xs text-muted-foreground block truncate">
                            {step.selector}
                          </code>
                        )}
                        {step.value && (
                          <span className="text-xs text-muted-foreground">
                            Value: {step.value}
                          </span>
                        )}
                        {step.error && (
                          <p className="text-xs text-red-400 mt-1">{step.error}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Screenshot / Video / Live Panel */}
        <div className="space-y-6">
          {/* View mode toggle during live execution */}
          {isLive && (
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('live')}
                className={viewMode === 'live' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                <Radio className="w-4 h-4 mr-1" />
                Watch Live
              </Button>
              <Button
                variant={viewMode === 'screenshots' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('screenshots')}
                className={viewMode === 'screenshots' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                <ImageIcon className="w-4 h-4 mr-1" />
                Screenshots ({screenshots.length})
              </Button>
            </div>
          )}

          {/* Live Browser Viewer */}
          {isLive && viewMode === 'live' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-500" />
                  Live Browser
                  <Badge className="bg-red-500 text-white animate-pulse text-xs">LIVE</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LiveBrowserViewer executionId={executionId} />
              </CardContent>
            </Card>
          )}

          {/* Screenshot Gallery */}
          {(!isLive || viewMode === 'screenshots') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Screenshots
                  {screenshots.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {screenshots.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {screenshots.length > 0 ? (
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
                  <img
                    src={latestScreenshot}
                    alt="Latest screenshot"
                    className="w-full rounded-lg border"
                  />
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">
                      {isLive ? 'Waiting for screenshot...' : 'No screenshots available'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Video Player */}
          {!isLive && videos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Video Recording
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VideoPlayer
                  src={videos[0].url}
                  poster={screenshots.length > 0 ? screenshots[0].url : undefined}
                />
              </CardContent>
            </Card>
          )}

          {/* Live Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Live Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <span className="text-muted-foreground">
                    {isLive ? 'Waiting for events...' : 'No log entries'}
                  </span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-muted-foreground">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Execution Details */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className={`font-medium ${config.textColor}`}>{config.label}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Duration</dt>
              <dd className="font-medium">{formatDuration(execution.duration)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Triggered By</dt>
              <dd className="font-medium capitalize">{execution.triggeredBy?.toLowerCase()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="font-medium">{new Date(execution.createdAt).toLocaleString()}</dd>
            </div>
            {execution.platform && (
              <div>
                <dt className="text-sm text-muted-foreground">Platform</dt>
                <dd className="font-medium">{execution.platform}</dd>
              </div>
            )}
            {execution.startedAt && (
              <div>
                <dt className="text-sm text-muted-foreground">Started</dt>
                <dd className="font-medium">{new Date(execution.startedAt).toLocaleString()}</dd>
              </div>
            )}
            {execution.completedAt && (
              <div>
                <dt className="text-sm text-muted-foreground">Completed</dt>
                <dd className="font-medium">{new Date(execution.completedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {execution.errorMessage && (
            <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm text-red-400">{execution.errorMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
