'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Image,
  Filter,
  Check,
  X,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentProject } from '@/hooks/useProject';
import { visualApi, getApiBaseUrl, type VisualComparison } from '@/lib/api';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { color: string; textColor: string; bgColor: string; icon: typeof Clock; label: string }> = {
  PENDING: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: Clock,
    label: 'Pending Review',
  },
  APPROVED: {
    color: 'bg-green-500',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: CheckCircle2,
    label: 'Approved',
  },
  AUTO_APPROVED: {
    color: 'bg-green-500',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: CheckCircle2,
    label: 'Auto-Approved',
  },
  REJECTED: {
    color: 'bg-red-500',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: XCircle,
    label: 'Rejected',
  },
  ESCALATED: {
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: Eye,
    label: 'Escalated',
  },
};

function screenshotProxyUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  // If it already has the /api/v1/screenshots prefix, use as-is
  if (rawUrl.startsWith('/api/') || rawUrl.startsWith('http')) return rawUrl;
  // Raw MinIO key like "{executionId}/{filename}" → full API proxy URL
  return `${getApiBaseUrl()}/screenshots/${rawUrl}`;
}

function ComparisonCard({ comparison }: { comparison: VisualComparison }) {
  const config = statusConfig[comparison.status] || statusConfig.PENDING;
  const StatusIcon = config.icon;
  const screenshotUrl = screenshotProxyUrl(comparison.screenshot?.url);
  const screenshotName = comparison.screenshot?.name || (comparison.metadata as any)?.screenshotName || '';
  const diffScore = comparison.diffScore ?? 0;
  const displayName = screenshotName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <Link href={`/visual/${comparison.id || ''}`}>
      <Card className="bg-card border-border hover:border-border/80 transition-colors cursor-pointer group">
        <CardContent className="p-0">
          {/* Preview */}
          <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
            {screenshotUrl ? (
              <img
                src={screenshotUrl}
                alt={displayName || 'Screenshot'}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="w-12 h-12 text-muted-foreground/50" />
              </div>
            )}

            {/* Diff indicator */}
            {diffScore > 0 && (
              <div className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm rounded-md px-2 py-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    diffScore > 5
                      ? 'text-red-400'
                      : diffScore > 1
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  )}
                >
                  {diffScore.toFixed(2)}% diff
                </span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground truncate mr-2">
                {displayName || `#${comparison.id?.slice(0, 8) || '?'}`}
              </span>
              <Badge
                variant="secondary"
                className={cn('gap-1 shrink-0', config.bgColor, config.textColor)}
              >
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </Badge>
            </div>
            {comparison.baseline && (
              <p className="text-xs text-muted-foreground truncate">
                Baseline: {comparison.baseline.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-1">
              {comparison.createdAt ? new Date(comparison.createdAt).toLocaleString() : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function VisualPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: comparisons, isLoading } = useQuery({
    queryKey: ['visual', project?.id, { status: statusFilter }],
    queryFn: () =>
      visualApi.list(project!.id, {
        status: statusFilter || undefined,
      }),
    enabled: !!project?.id,
  });

  const bulkApproveMutation = useMutation({
    mutationFn: () => visualApi.bulkApprove(project!.id, Array.from(selectedIds)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visual'] });
      setSelectedIds(new Set());
      toast.success(`Approved ${selectedIds.size} comparisons`);
    },
    onError: (error: any) => toast.error(error.message || 'Bulk approve failed'),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const items = Array.isArray(comparisons) ? comparisons : (comparisons as any)?.data || [];
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((c: any) => c.id)));
    }
  };

  // Ensure we have an array — API returns { data: [...], meta: {...} } but
  // handleResponse unwraps to just the array. Guard against edge cases.
  const rawData = comparisons as any;
  const comparisonList: VisualComparison[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data)
    ? rawData.data
    : [];
  const filteredComparisons = comparisonList.filter((c) => c && c.id);
  const pendingCount =
    filteredComparisons.filter((c) => c.status === 'PENDING').length || 0;

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      {/* Review room — the binary-decision surface. The pending count
          is the signal the reviewer acts on, so it's sculpted as a
          huge typographic moment rather than a tiny badge. */}
      <header className="pb-8 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-6">§ Review room · Visual regression</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 0.97 }}
            >
              What <em>changed</em>,<br />and what should stay.
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{
                fontVariationSettings: '"opsz" 24',
                fontSize: '17px',
                color: 'var(--ink-1)',
                maxWidth: '56ch',
              }}
            >
              Every differing frame waits here for a verdict. Press{' '}
              <kbd className="vt-mono px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--bg-2)', color: 'var(--ink-0)' }}>A</kbd>{' '}
              to approve,{' '}
              <kbd className="vt-mono px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--bg-2)', color: 'var(--ink-0)' }}>R</kbd>{' '}
              to reject inside an individual review.
            </p>
          </div>

          {/* Pending-count sculpture — single big number, tiny label */}
          <div
            className="text-right"
            style={{ opacity: pendingCount === 0 ? 0.5 : 1 }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 144',
                fontWeight: 300,
                fontSize: 'clamp(64px, 8vw, 120px)',
                lineHeight: 0.88,
                letterSpacing: '-0.04em',
                color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pendingCount}
            </div>
            <div
              className="mt-2 vt-kicker"
              style={{ color: pendingCount > 0 ? 'var(--accent)' : 'var(--ink-2)' }}
            >
              {pendingCount === 0 ? 'all clear' : 'awaiting verdict'}
            </div>
          </div>
        </div>
      </header>

      {/* Bulk Actions */}
      <div className="flex gap-2">
        <Button
          variant={selectedIds.size > 0 ? 'default' : 'outline'}
          size="sm"
          onClick={selectAll}
        >
          {selectedIds.size > 0 ? `Deselect All (${selectedIds.size})` : 'Select All'}
        </Button>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <Button
            size="sm"
            onClick={() => bulkApproveMutation.mutate()}
            disabled={bulkApproveMutation.isPending}
          >
            <CheckCheck className="h-3 w-3 mr-1" /> Approve All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="bg-card border-border text-muted-foreground hover:bg-accent"
            >
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter
                ? statusConfig[statusFilter]?.label
                : 'All Status'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-card border-border">
            <DropdownMenuItem
              className="text-muted-foreground focus:bg-accent"
              onClick={() => setStatusFilter(null)}
            >
              All Status
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            {Object.entries(statusConfig).map(([key, config]) => (
              <DropdownMenuItem
                key={key}
                className="text-muted-foreground focus:bg-accent"
                onClick={() => setStatusFilter(key)}
              >
                <config.icon className={cn('w-4 h-4 mr-2', config.textColor)} />
                {config.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick filters */}
        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === 'PENDING' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() =>
              setStatusFilter(statusFilter === 'PENDING' ? null : 'PENDING')
            }
            className={cn(
              statusFilter === 'PENDING'
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Clock className="w-4 h-4 mr-1" />
            Pending
          </Button>
          <Button
            variant={statusFilter === 'AUTO_APPROVED' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() =>
              setStatusFilter(statusFilter === 'AUTO_APPROVED' ? null : 'AUTO_APPROVED')
            }
            className={cn(
              statusFilter === 'AUTO_APPROVED'
                ? 'bg-green-500/10 text-green-400'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Auto-Approved
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading comparisons...
        </div>
      ) : filteredComparisons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Image className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">
            No Visual Comparisons
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            {statusFilter
              ? `No ${statusConfig[statusFilter]?.label || statusFilter.toLowerCase()} comparisons found`
              : 'Run your tests to generate visual comparisons'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredComparisons.map((comparison) => (
            <div key={comparison.id} className="relative">
              {selectedIds.size > 0 && (
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedIds.has(comparison.id)}
                    onCheckedChange={() => toggleSelect(comparison.id)}
                  />
                </div>
              )}
              <div onClick={(e) => { if (selectedIds.size > 0) { e.preventDefault(); toggleSelect(comparison.id); } }}>
                <ComparisonCard comparison={comparison} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
