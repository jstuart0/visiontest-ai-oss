'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldOff,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface ExploreNode {
  id: string;
  executionId: string;
  url: string;
  parentId: string | null;
  orderIndex: number;
  interactionKind: string;
  interactionLabel: string;
  interactionSelector: string | null;
  status: 'ok' | 'warn' | 'fail' | 'skipped';
  skipReason: string | null;
  errorText: string | null;
  httpStatus: number | null;
  screenshotPre: string | null;
  screenshotPost: string | null;
  consoleErrors: string[] | null;
  durationMs: number | null;
}

interface ScanData {
  executionId: string;
  status: string;
  mode: string;
  summary: {
    pagesVisited: number;
    interactionsTried: number;
    ok: number;
    warn: number;
    fail: number;
    skipped: number;
  } | null;
  nodes: ExploreNode[];
}

const STATUS_ICONS = {
  ok: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  skipped: <ShieldOff className="w-4 h-4 text-muted-foreground" />,
};

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const { data, isLoading, refetch } = useQuery<ScanData>({
    queryKey: ['scan', executionId],
    queryFn: async () => api.get(`/executions/${executionId}/nodes`),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'QUEUED' || s === 'RUNNING' ? 2000 : false;
    },
  });

  // Group nodes into a tree by parentId. The root is the single node
  // with a null parentId (created by scanRunner at startup).
  const tree = useMemo(() => {
    if (!data) return null;
    const byParent = new Map<string | null, ExploreNode[]>();
    for (const n of data.nodes) {
      const key = n.parentId;
      const list = byParent.get(key) || [];
      list.push(n);
      byParent.set(key, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return byParent;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading scan…
      </div>
    );
  }

  const stillRunning = data.status === 'QUEUED' || data.status === 'RUNNING';
  const failed = data.nodes.filter((n) => n.status === 'fail');

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 space-y-10 vt-reveal">
      {/* Editorial scan header */}
      <header className="pb-7 border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="flex items-center gap-4 mb-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="vt-kicker inline-flex items-center gap-2 transition-colors"
            style={{ color: 'var(--ink-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
          >
            <ArrowLeft className="w-3 h-3" /> back
          </button>
          <span className="vt-kicker" style={{ color: 'var(--brass)' }}>
            § Exploration · {data.executionId.slice(-8)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(40px, 5vw, 68px)', lineHeight: 0.98 }}
            >
              Scan <em>result</em>
            </h1>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <span
                className={
                  stillRunning
                    ? 'vt-chip vt-chip--accent'
                    : data.status === 'FAILED'
                    ? 'vt-chip vt-chip--fail'
                    : 'vt-chip vt-chip--pass'
                }
              >
                <span className="vt-dot" />
                {data.status}
              </span>
              {data.summary && (
                <span
                  className="vt-mono text-[11.5px] tracking-[0.12em]"
                  style={{ color: 'var(--ink-1)' }}
                >
                  {data.summary.pagesVisited} pages · {data.summary.interactionsTried} interactions
                </span>
              )}
            </div>
          </div>
          {stillRunning && (
            <button
              type="button"
              onClick={() => refetch()}
              className="vt-btn"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Refresh
            </button>
          )}
        </div>
      </header>

      {data.summary && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryTile
            label="Passed"
            value={data.summary.ok}
            color="bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
          />
          <SummaryTile
            label="Warnings"
            value={data.summary.warn}
            color="bg-amber-900/30 border-amber-700/50 text-amber-300"
          />
          <SummaryTile
            label="Failures"
            value={data.summary.fail}
            color="bg-red-900/30 border-red-700/50 text-red-300"
          />
          <SummaryTile
            label="Skipped"
            value={data.summary.skipped}
            color="bg-neutral-800 border-neutral-700 text-muted-foreground"
          />
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Tree</CardTitle>
        </CardHeader>
        <CardContent>
          {data.nodes.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              {stillRunning
                ? 'Scan is starting — tree will populate here.'
                : 'No interactions were recorded.'}
            </div>
          ) : (
            <TreeNodes
              parent={null}
              byParent={tree!}
              depth={0}
            />
          )}
        </CardContent>
      </Card>

      {failed.length > 0 && (
        <Card className="bg-card border-red-900/40">
          <CardHeader>
            <CardTitle className="text-red-300">
              Failed ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failed.map((n) => (
              <div
                key={n.id}
                className="border border-red-900/40 bg-red-900/10 rounded-md p-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-red-300">
                      {n.interactionLabel}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      on {n.url}
                    </div>
                    {n.errorText && (
                      <div className="text-sm mt-2 text-red-200 font-mono">
                        {n.errorText}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <Button variant="outline" size="sm" disabled>
                      Convert to test
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`border rounded-md px-4 py-3 ${color}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function TreeNodes({
  parent,
  byParent,
  depth,
}: {
  parent: string | null;
  byParent: Map<string | null, ExploreNode[]>;
  depth: number;
}) {
  const nodes = byParent.get(parent) || [];
  if (nodes.length === 0) return null;
  return (
    <div className="space-y-1">
      {nodes.map((n) => (
        <div key={n.id}>
          <div
            className="flex items-start gap-2 text-sm py-1"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            <span className="flex-shrink-0 mt-0.5">
              {STATUS_ICONS[n.status]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-foreground truncate">
                  {n.interactionLabel}
                </span>
                {n.httpStatus && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      n.httpStatus >= 500
                        ? 'text-red-300 border-red-700'
                        : n.httpStatus >= 400
                        ? 'text-amber-300 border-amber-700'
                        : 'text-muted-foreground border-border'
                    }`}
                  >
                    {n.httpStatus}
                  </Badge>
                )}
              </div>
              {n.skipReason && (
                <div className="text-xs text-muted-foreground italic">
                  skipped — {n.skipReason}
                </div>
              )}
              {n.url && n.interactionKind === 'navigate' && (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                >
                  {n.url} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <TreeNodes
            parent={n.id}
            byParent={byParent}
            depth={depth + 1}
          />
        </div>
      ))}
    </div>
  );
}
