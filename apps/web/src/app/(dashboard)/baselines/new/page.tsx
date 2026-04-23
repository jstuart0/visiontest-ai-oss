'use client';

// Manual baseline creation — pick any passing execution, give it a
// name, and promote its screenshots into a new baseline.
//
// UX rule: this is the "advanced" entry point. 95% of users should
// reach the "Set as baseline" button directly on /executions/[id] or
// /tests/[id]. This page exists for cross-test naming, for restoring
// a historical snapshot, and as a discoverable alternative if the
// inline button isn't visible (e.g. the test never passed).

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Layers,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCurrentProject } from '@/hooks/useProject';
import { baselinesApi, executionsApi } from '@/lib/api';

const STATUS_META: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  PASSED: { icon: CheckCircle2, color: 'text-emerald-400' },
  FAILED: { icon: XCircle, color: 'text-red-400' },
  RUNNING: { icon: Activity, color: 'text-blue-400' },
  PENDING: { icon: Clock, color: 'text-muted-foreground' },
  QUEUED: { icon: Clock, color: 'text-muted-foreground' },
};

export default function NewBaselinePage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('main');

  // Show recent executions, prioritise PASSED. We don't block other
  // statuses — there are legitimate reasons to baseline a failing run
  // (e.g. recording "expected error" screens).
  const { data: executions, isLoading } = useQuery({
    queryKey: ['executions', project?.id, 'for-baseline'],
    queryFn: () =>
      executionsApi.list(project!.id, { limit: '30' } as any),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Pick an execution');
      return baselinesApi.fromExecution(selected, {
        name: name.trim() || undefined,
        branch: branch.trim() || 'main',
      });
    },
    onSuccess: (res: any) => {
      toast.success(
        res.replaced
          ? `Baseline "${res.name}" updated`
          : `Baseline "${res.name}" created`,
      );
      router.push('/baselines');
    },
    onError: (err: any) => toast.error(err.message || 'Create failed'),
  });

  const selectedExec = executions?.find((e) => e.id === selected);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">
          Select a project first
        </div>
        <Link href="/">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/baselines')}
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6" /> New baseline
          </h1>
          <p className="text-muted-foreground mt-1">
            Pick an execution; we&apos;ll promote its screenshots.
          </p>
        </div>
      </div>

      <div className="border border-blue-800/50 bg-blue-900/10 rounded-md p-3 flex items-start gap-2 text-sm">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-blue-200">
          Most people use the{' '}
          <strong className="font-medium">Set as baseline</strong>{' '}
          button on a specific execution instead. This page is for when
          you want to name or rebrand the baseline, or pick an older run.
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Pick an execution</CardTitle>
          <CardDescription>
            Recent runs from this project. Passing runs are the obvious
            choice, but you can pick any run with screenshots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !executions || executions.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              No executions yet. Run a test first — then the Set-as-
              baseline button will show up inline on the execution page.
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {executions.map((e: any) => {
                const meta = STATUS_META[e.status] ?? STATUS_META.PENDING;
                const Icon = meta.icon;
                const isSelected = e.id === selected;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setSelected(e.id);
                      if (!name && e.test?.name) setName(e.test.name);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-900/20 border border-blue-700/50'
                        : 'hover:bg-accent border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground text-sm truncate">
                        {e.test?.name || 'Untitled execution'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] flex-shrink-0"
                    >
                      {e.status}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedExec && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Baseline details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={(selectedExec as any).test?.name || 'Run baseline'}
                  className="bg-muted border-border"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tests with this name will compare against this
                  baseline. Convention: use the exact test name.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Branch
                </label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="bg-muted border-border"
                />
                <p className="text-[11px] text-muted-foreground">
                  Baselines are per-branch. Leave as{' '}
                  <code>main</code> if you&apos;re not branching.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={() => router.push('/baselines')}>
          Cancel
        </Button>
        <Button
          disabled={!selected || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…
            </>
          ) : (
            'Create baseline'
          )}
        </Button>
      </div>
    </div>
  );
}
