'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Brain,
  Camera,
  Clock,
} from 'lucide-react';
import { getApiBaseUrl, getAuthToken } from '@/lib/api';

interface ExecutionEvent {
  type: string;
  executionId: string;
  timestamp: number;
  stepIndex?: number;
  action?: string;
  target?: string;
  duration?: number;
  error?: string;
  status?: string;
  success?: boolean;
  healedSelector?: string;
  strategy?: string;
  originalTarget?: string;
  name?: string;
}

export function LiveExecutionViewer({ executionId }: { executionId: string }) {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getAuthToken();
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/stream/${executionId}${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);

    es.addEventListener('connected', () => setConnected(true));

    es.addEventListener('progress', (e) => {
      const data: ExecutionEvent = JSON.parse(e.data);
      setEvents((prev) => [...prev, data]);
    });

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setDone(true);
      setFinalStatus(data.status);
      es.close();
    });

    es.addEventListener('timeout', () => {
      setDone(true);
      es.close();
    });

    es.onerror = () => {
      if (done) es.close();
    };

    return () => es.close();
  }, [executionId, done]);

  // Auto-scroll
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const passedSteps = events.filter((e) => e.type === 'execution.step.passed').length;
  const failedSteps = events.filter((e) => e.type === 'execution.step.failed').length;
  const healCount = events.filter((e) => e.type === 'execution.healing.completed').length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mt-2">
          <h2 className="text-xl font-semibold text-foreground">Live Execution</h2>
          {!done ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running
            </span>
          ) : finalStatus === 'PASSED' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
              <CheckCircle className="h-3 w-3" />
              Passed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
              <XCircle className="h-3 w-3" />
              {finalStatus || 'Failed'}
            </span>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold text-green-500">{passedSteps}</div>
          <div className="text-xs text-muted-foreground">Passed</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold text-red-500">{failedSteps}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold text-amber-500">{healCount}</div>
          <div className="text-xs text-muted-foreground">Heals</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold text-foreground">{events.length}</div>
          <div className="text-xs text-muted-foreground">Events</div>
        </div>
      </div>

      {/* Event Stream */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Event Stream</h3>
          {connected && !done && (
            <span className="flex items-center gap-1.5 text-xs text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="max-h-[500px] overflow-y-auto p-4 space-y-1">
          {events.length === 0 && !done ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Waiting for execution events...
            </div>
          ) : (
            events.map((event, i) => <EventRow key={i} event={event} />)
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ExecutionEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString();

  const icons: Record<string, React.ReactNode> = {
    'execution.started': <Loader2 className="h-3.5 w-3.5 text-blue-500" />,
    'execution.step.running': <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
    'execution.step.passed': <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    'execution.step.failed': <XCircle className="h-3.5 w-3.5 text-red-500" />,
    'execution.healing.started': <Brain className="h-3.5 w-3.5 text-amber-500" />,
    'execution.healing.completed': <Zap className="h-3.5 w-3.5 text-amber-500" />,
    'execution.screenshot': <Camera className="h-3.5 w-3.5 text-purple-500" />,
    'execution.completed': <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    'execution.failed': <XCircle className="h-3.5 w-3.5 text-red-500" />,
  };

  function getMessage(): string {
    switch (event.type) {
      case 'execution.started':
        return 'Execution started — launching browser...';
      case 'execution.step.running':
        return `Step ${(event.stepIndex ?? 0) + 1}: ${event.action || ''} ${event.target || ''}`;
      case 'execution.step.passed':
        return `Step ${(event.stepIndex ?? 0) + 1} passed (${event.duration}ms)`;
      case 'execution.step.failed':
        return `Step ${(event.stepIndex ?? 0) + 1} failed: ${event.error}`;
      case 'execution.healing.started':
        return `Healing attempt on step ${(event.stepIndex ?? 0) + 1}: ${event.originalTarget}`;
      case 'execution.healing.completed':
        return event.success
          ? `Healed: ${event.originalTarget} → ${event.healedSelector} (${event.strategy})`
          : `Healing failed for: ${event.originalTarget}`;
      case 'execution.screenshot':
        return `Screenshot captured: ${event.name}`;
      case 'execution.completed':
        return `Execution completed: ${event.status} (${event.duration}ms)`;
      case 'execution.failed':
        return `Execution failed: ${event.error}`;
      default:
        return event.type;
    }
  }

  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <span className="text-xs text-muted-foreground font-mono whitespace-nowrap mt-0.5">
        {time}
      </span>
      <span className="mt-0.5 flex-shrink-0">
        {icons[event.type] || <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
      </span>
      <span className={event.type.includes('failed') ? 'text-red-500' : 'text-foreground'}>
        {getMessage()}
      </span>
    </div>
  );
}
