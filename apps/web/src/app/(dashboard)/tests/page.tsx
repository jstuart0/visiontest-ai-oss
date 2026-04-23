'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  Play,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Trash2,
  Edit,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { testsApi, type Test, type Platform } from '@/lib/api';
import { PlatformFilter, PlatformBadge } from '@/components/devices/PlatformFilter';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig = {
  passed: {
    color: 'bg-green-500',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: CheckCircle2,
    label: 'Passed',
  },
  failed: {
    color: 'bg-red-500',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: XCircle,
    label: 'Failed',
  },
  flaky: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: AlertTriangle,
    label: 'Flaky',
  },
  running: {
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: Activity,
    label: 'Running',
  },
  pending: {
    color: 'bg-muted',
    textColor: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    icon: Clock,
    label: 'Pending',
  },
};

export default function TestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);
  const [deleteTest, setDeleteTest] = useState<Test | null>(null);
  const { sortColumn, sortDirection, handleSort, sortData } = useSortableTable<Test>();

  const { data: tests, isLoading } = useQuery({
    queryKey: ['tests', project?.id, { search, status: statusFilter, platform: platformFilter }],
    queryFn: () =>
      testsApi.list(project!.id, {
        search: search || undefined,
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
      } as any),
    enabled: !!project?.id,
  });

  const runMutation = useMutation({
    mutationFn: (testId: string) => testsApi.run(project!.id, testId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Test run started - redirecting to live view...');
      // Navigate to live execution view
      router.push(`/executions/${data.id}`);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to run test');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (testId: string) => testsApi.delete(project!.id, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Test deleted');
      setDeleteTest(null);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete test');
    },
  });

  const filteredTests = sortData(tests || [], {
    name: (t) => t.name,
    status: (t) => t.status,
    lastRun: (t) => t.lastRun,
    flakyScore: (t) => t.flakyScore ?? null,
  });

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 space-y-10 vt-reveal">
      {/* Editorial masthead */}
      <header className="pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="vt-eyebrow mb-5">§ Specimens · Tests</div>
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(44px, 6vw, 76px)', lineHeight: 0.97 }}
            >
              Your <em>tests</em>, in order of interest.
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{
                fontVariationSettings: '"opsz" 24',
                fontSize: '17px',
                color: 'var(--ink-1)',
                maxWidth: '58ch',
              }}
            >
              Each one is a journey you wrote in plain English. Click to open,
              edit, run, or promote its screenshots as the new baseline.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/scan/new" className="vt-btn">
              Scan project
            </Link>
            <Link href="/tests/new" className="vt-btn vt-btn--primary">
              <Plus className="w-4 h-4" />
              New test
            </Link>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="bg-card border-border text-muted-foreground hover:bg-accent"
            >
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter
                ? statusConfig[statusFilter as keyof typeof statusConfig]?.label
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
      </div>

      {/* Tests Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <SortableTableHead column="name" label="Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="lastRun" label="Last Run" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="flakyScore" label="Flaky Score" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading tests...
                </TableCell>
              </TableRow>
            ) : filteredTests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No tests found
                </TableCell>
              </TableRow>
            ) : (
              filteredTests.map((test) => {
                const displayStatus = (test.lastStatus || '').toLowerCase();
                const config =
                  statusConfig[displayStatus as keyof typeof statusConfig] ||
                  statusConfig.pending;
                const StatusIcon = config.icon;

                return (
                  <TableRow
                    key={test.id}
                    className="border-border hover:bg-accent/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/tests/${test.id}`}
                          className="font-medium text-foreground hover:text-blue-400"
                        >
                          {test.name}
                        </Link>
                        <PlatformBadge platform={test.platform} />
                      </div>
                      {test.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {test.description}
                        </p>
                      )}
                      {test.deviceProfile && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📱 {test.deviceProfile.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn('gap-1', config.bgColor, config.textColor)}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {test.lastRun
                        ? new Date(test.lastRun).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {test.flakyScore !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                test.flakyScore > 50
                                  ? 'bg-red-500'
                                  : test.flakyScore > 20
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              )}
                              style={{ width: `${test.flakyScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {test.flakyScore}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={() => runMutation.mutate(test.id)}
                          disabled={runMutation.isPending}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-card border-border"
                          >
                            <DropdownMenuItem className="text-muted-foreground focus:bg-accent">
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-muted-foreground focus:bg-accent">
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              className="text-red-400 focus:bg-accent focus:text-red-400"
                              onClick={() => setDeleteTest(test)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTest} onOpenChange={() => setDeleteTest(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Test</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete &quot;{deleteTest?.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTest(null)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTest && deleteMutation.mutate(deleteTest.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
