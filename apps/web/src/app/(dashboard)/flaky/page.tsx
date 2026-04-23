'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Play,
  Shield,
  ShieldOff,
  TrendingUp,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentProject } from '@/hooks/useProject';
import { flakyApi, testsApi, type FlakyTest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

function FlakyScoreIndicator({ score }: { score: number }) {
  const color =
    score > 50 ? 'text-red-400' : score > 20 ? 'text-yellow-400' : 'text-green-400';
  const bgColor =
    score > 50
      ? 'bg-red-500'
      : score > 20
      ? 'bg-yellow-500'
      : 'bg-green-500';

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', bgColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-sm font-medium', color)}>{score}%</span>
    </div>
  );
}

export default function FlakyPage() {
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const { data: flakyTests, isLoading } = useQuery({
    queryKey: ['flaky', project?.id],
    queryFn: () => flakyApi.list(project!.id),
    enabled: !!project?.id,
  });

  const quarantineMutation = useMutation({
    mutationFn: (testId: string) => flakyApi.quarantine(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flaky', project?.id] });
      toast.success('Test quarantined');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to quarantine test');
    },
  });

  const unquarantineMutation = useMutation({
    mutationFn: (testId: string) => flakyApi.unquarantine(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flaky', project?.id] });
      toast.success('Test removed from quarantine');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to unquarantine test');
    },
  });

  const runMutation = useMutation({
    mutationFn: (testId: string) => testsApi.run(project!.id, testId),
    onSuccess: () => {
      toast.success('Test run started');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to run test');
    },
  });

  const tests = flakyTests || [];
  const quarantinedCount = tests.filter((t) => t.status === 'QUARANTINED').length;
  const avgFlakyScore =
    tests.length > 0
      ? Math.round(
          tests.reduce((acc, t) => acc + (t.flakinessScore || 0), 0) / tests.length
        )
      : 0;

  // Quarantine ward — the clinical surface where we diagnose unreliable
  // tests. Typography is restrained; the single number that matters
  // (tests still showing inconsistent behaviour) is rendered at display
  // size. Other figures read as chart meta, not as co-equal hero stats.
  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-6" style={{ color: 'var(--warn)' }}>
          § Quarantine ward · Flakiness
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-end">
          <div>
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 0.98 }}
            >
              Tests that <em>flicker</em>.
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
              Inconsistent pass/fail patterns — the ones that aren&apos;t
              quite broken and aren&apos;t quite working either. Review the
              run history, quarantine the worst, fix at your own pace.
            </p>
          </div>
          <div className="text-right">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 144',
                fontWeight: 300,
                fontSize: 'clamp(64px, 8vw, 112px)',
                lineHeight: 0.88,
                letterSpacing: '-0.04em',
                color: tests.length > 0 ? 'var(--warn)' : 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {tests.length}
            </div>
            <div
              className="mt-2 vt-kicker"
              style={{ color: tests.length > 0 ? 'var(--warn)' : 'var(--ink-2)' }}
            >
              {tests.length === 1 ? 'flickering test' : 'flickering tests'}
            </div>
          </div>
        </div>
      </header>

      {/* Secondary ledger: quarantined, avg score — small, as chart-meta */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-0 mb-10 pb-6 border-b"
        style={{ borderColor: 'var(--rule)' }}
      >
        <MetaCell label="Quarantined" value={quarantinedCount.toString()} hint="Isolated from main pipeline" />
        <MetaCell label="Avg flakiness" value={`${avgFlakyScore}%`} hint="Across all flickering tests" tone={avgFlakyScore > 60 ? 'warn' : 'default'} />
        <MetaCell label="Detection" value="automatic" hint="Every run feeds the score" />
      </div>

      {/* Flaky Tests Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Flaky Tests</CardTitle>
          <CardDescription className="text-muted-foreground">
            Tests showing inconsistent behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading flaky tests...
            </div>
          ) : tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No Flaky Tests Detected
              </h3>
              <p className="text-muted-foreground text-center max-w-md">
                Great news! All your tests are showing consistent behavior. Keep
                running your test suite to continue monitoring.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Test Name</TableHead>
                  <TableHead className="text-muted-foreground">Flaky Score</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Last Run</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((ft) => (
                  <TableRow
                    key={ft.id}
                    className="border-border hover:bg-accent/50"
                  >
                    <TableCell>
                      <Link
                        href={`/tests/${ft.testId}`}
                        className="font-medium text-foreground hover:text-blue-400"
                      >
                        {ft.test.name}
                      </Link>
                      {ft.test.tags && ft.test.tags.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ft.test.tags.join(', ')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <FlakyScoreIndicator score={ft.flakinessScore || 0} />
                    </TableCell>
                    <TableCell>
                      {ft.status === 'QUARANTINED' ? (
                        <Badge
                          variant="secondary"
                          className="bg-blue-500/10 text-blue-400 gap-1"
                        >
                          <Shield className="w-3 h-3" />
                          Quarantined
                        </Badge>
                      ) : ft.status === 'WARNING' ? (
                        <Badge
                          variant="secondary"
                          className="bg-orange-500/10 text-orange-400 gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Warning
                        </Badge>
                      ) : ft.status === 'STABLE' ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-400 gap-1"
                        >
                          <TrendingUp className="w-3 h-3" />
                          Stable
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-yellow-500/10 text-yellow-400 gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Watching
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ft.lastAnalyzedAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ft.lastAnalyzedAt).toLocaleDateString()}
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runMutation.mutate(ft.testId)}
                          disabled={runMutation.isPending}
                          className="text-muted-foreground hover:text-foreground hover:bg-accent"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Run
                        </Button>
                        {ft.status === 'QUARANTINED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unquarantineMutation.mutate(ft.testId)}
                            disabled={unquarantineMutation.isPending}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent"
                          >
                            <ShieldOff className="w-4 h-4 mr-1" />
                            Release
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => quarantineMutation.mutate(ft.testId)}
                            disabled={quarantineMutation.isPending}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Quarantine
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetaCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'warn';
}) {
  const color = tone === 'warn' ? 'var(--warn)' : 'var(--ink-0)';
  return (
    <div className="px-8 first:pl-0 border-l first:border-l-0" style={{ borderColor: 'var(--rule)' }}>
      <div className="vt-kicker" style={{ color: 'var(--ink-2)' }}>{label}</div>
      <div
        className="mt-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontVariationSettings: '"opsz" 72',
          fontWeight: 360,
          fontSize: '32px',
          letterSpacing: '-0.02em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div className="vt-mono text-[11px] tracking-[0.06em] mt-1" style={{ color: 'var(--ink-2)' }}>
        {hint}
      </div>
    </div>
  );
}
