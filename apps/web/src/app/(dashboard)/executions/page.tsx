'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentProject } from '@/hooks/useProject';
import { api } from '@/lib/api';

interface Execution {
  id: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  triggeredBy: string;
  triggerRef?: string;
  platform?: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
  test?: { id: string; name: string };
  suite?: { id: string; name: string };
}

const statusConfig = {
  PENDING: { icon: Clock, color: 'bg-muted', label: 'Pending' },
  QUEUED: { icon: Clock, color: 'bg-yellow-500', label: 'Queued' },
  RUNNING: { icon: Activity, color: 'bg-blue-500 animate-pulse', label: 'Running' },
  PASSED: { icon: CheckCircle2, color: 'bg-green-500', label: 'Passed' },
  FAILED: { icon: XCircle, color: 'bg-red-500', label: 'Failed' },
  CANCELLED: { icon: AlertTriangle, color: 'bg-orange-500', label: 'Cancelled' },
  TIMEOUT: { icon: AlertTriangle, color: 'bg-orange-500', label: 'Timeout' },
};

export default function ExecutionsPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ['executions', project?.id, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: project!.id, limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get<Execution[]>(`/executions?${params}`);
      return res;
    },
    enabled: !!project,
    refetchInterval: 5000,
  });

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTime = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a project first</p>
      </div>
    );
  }

  // ── Ledger metaphor: a chronological record of every run. Dense
  //    rows, dates as Fraunces italic, times as mono with leader dots,
  //    status as a colored glyph, duration as a right-aligned metric.
  //    No "ChevronRight" — the whole row IS the link.
  const grouped = groupByDay(executions);

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-5">§ Ledger · All runs</div>
        <div className="flex items-end justify-between gap-8 flex-wrap">
          <h1
            className="vt-display"
            style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 0.97 }}
          >
            Every run, <em>in order.</em>
          </h1>
          <div className="flex gap-2 flex-wrap">
            {['all', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'].map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  type="button"
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="vt-mono text-[10.5px] tracking-[0.16em] uppercase px-3 h-8 border transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--rule)',
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {status === 'all'
                    ? 'All'
                    : statusConfig[status as keyof typeof statusConfig]?.label || status}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="vt-italic" style={{ color: 'var(--ink-2)' }}>Compiling the ledger…</div>
      ) : executions.length === 0 ? (
        <div
          className="py-24 text-center border-y"
          style={{ borderColor: 'var(--rule)' }}
        >
          <div className="vt-kicker mb-4" style={{ color: 'var(--brass)' }}>— no entries —</div>
          <p
            className="vt-italic mb-8"
            style={{
              fontFamily: 'var(--font-display)',
              fontVariationSettings: '"opsz" 72',
              fontStyle: 'italic',
              fontSize: '34px',
              lineHeight: 1.15,
              color: 'var(--ink-1)',
            }}
          >
            Run a test and<br />the first entry appears here.
          </p>
          <button
            onClick={() => router.push('/tests')}
            className="vt-btn vt-btn--primary"
          >
            Pick a test
          </button>
        </div>
      ) : (
        <div className="space-y-16">
          {Array.from(grouped.entries()).map(([day, rows]) => (
            <section key={day}>
              {/* Day heading — big italic date; rule underline */}
              <div className="flex items-baseline gap-4 mb-4 pb-2 border-b" style={{ borderColor: 'var(--rule)' }}>
                <span
                  className="vt-italic"
                  style={{
                    fontVariationSettings: '"opsz" 72',
                    fontWeight: 340,
                    fontSize: '30px',
                    letterSpacing: '-0.01em',
                    color: 'var(--ink-0)',
                  }}
                >
                  {day}
                </span>
                <span
                  className="vt-kicker ml-auto"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {/* Table-like rows */}
              <ul className="m-0 p-0 list-none">
                {rows.map((execution, i) => {
                  const config = statusConfig[execution.status];
                  const isLive = ['PENDING', 'QUEUED', 'RUNNING'].includes(execution.status);
                  const statusColor =
                    execution.status === 'PASSED'
                      ? 'var(--pass)'
                      : execution.status === 'FAILED'
                      ? 'var(--fail)'
                      : isLive
                      ? 'var(--accent)'
                      : 'var(--ink-2)';
                  return (
                    <li
                      key={execution.id}
                      className="group border-b"
                      style={{
                        borderColor: 'var(--rule-soft)',
                        animation: `vt-reveal var(--dur-reveal) ${i * 30}ms var(--ease-out) both`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/executions/${execution.id}`)}
                        className="w-full text-left grid items-baseline py-4 gap-6 transition-colors"
                        style={{
                          gridTemplateColumns: '72px 1fr auto auto',
                        }}
                      >
                        {/* time + status glyph column */}
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{
                              background: statusColor,
                              boxShadow: isLive ? `0 0 10px 0 ${statusColor}` : 'none',
                            }}
                          />
                          <span
                            className="vt-mono text-[12px] tabular-nums"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            {formatClock(execution.startedAt || execution.createdAt)}
                          </span>
                        </div>

                        {/* title */}
                        <div className="min-w-0">
                          <div
                            className="text-[16px] truncate transition-colors group-hover:text-[color:var(--accent)]"
                            style={{ color: 'var(--ink-0)' }}
                          >
                            {execution.test?.name || execution.suite?.name || 'Execution'}
                          </div>
                          <div
                            className="vt-mono text-[11px] tracking-[0.06em] mt-0.5 truncate"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            {execution.triggeredBy?.toLowerCase()}
                            {execution.platform && execution.platform !== 'WEB' && ` · ${execution.platform.toLowerCase()}`}
                            {execution.triggerRef?.startsWith('workflow:') && ' · workflow'}
                            {' · '}
                            <span style={{ color: statusColor }}>{config.label.toLowerCase()}</span>
                          </div>
                        </div>

                        {/* duration — right-aligned metric */}
                        <span
                          className="vt-mono text-[13px] tabular-nums"
                          style={{ color: 'var(--ink-1)' }}
                        >
                          {formatDuration(execution.duration)}
                        </span>

                        {/* live indicator */}
                        {isLive && (
                          <span
                            className="vt-chip vt-chip--accent vt-breathe"
                            style={{ letterSpacing: '0.24em', padding: '2px 8px' }}
                          >
                            live
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// Group executions by calendar day for the ledger presentation.
function groupByDay(items: Execution[]): Map<string, Execution[]> {
  const map = new Map<string, Execution[]>();
  for (const e of items) {
    const d = new Date(e.startedAt || e.createdAt);
    const key = d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function formatClock(iso: string | null): string {
  if (!iso) return '——:——';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
