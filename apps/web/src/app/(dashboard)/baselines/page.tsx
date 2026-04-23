'use client';

// Baselines list.
//
// A baseline is a set of approved screenshots a test compares against.
// Create one from any PASSED execution with a single click — the
// "Set as baseline" button on /executions/[id] and /tests/[id] does
// the heavy lifting; this page is for browsing, searching, and
// deleting afterwards.

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { baselinesApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Image as ImageIcon,
  Trash2,
  GitBranch,
  Calendar,
  Play,
  ArrowRight,
  Layers,
  Info,
} from 'lucide-react';

export default function BaselinesPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  const { data: baselines, isLoading } = useQuery({
    queryKey: ['baselines', project?.id],
    queryFn: () => baselinesApi.list(project!.id),
    enabled: !!project?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => baselinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines'] });
      toast.success('Baseline deleted');
    },
    onError: (error: any) =>
      toast.error(error.message || 'Failed to delete'),
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">
          Select a project to manage baselines
        </div>
        <Link href="/">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 space-y-10 vt-reveal">
      <header className="pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-5">§ Baselines · Photographic record</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 0.97 }}>
          The <em>reference</em> print.
        </h1>
        <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '62ch' }}>
          Approved screenshot sets that future runs get compared against.
          One baseline per test, per branch. Visual diffs open a review
          screen where you approve or reject the new version.
        </p>
      </header>

      {/* How-to card — replaces the misleading old empty-state hint */}
      {(!baselines || baselines.length === 0) && !isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 flex flex-col items-center text-center gap-5">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1 max-w-lg">
              <h3 className="text-foreground font-medium text-lg">
                No baselines yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Create one in a single click: run a test, open the
                execution, and press{' '}
                <span className="font-medium text-foreground">
                  Set as baseline
                </span>
                . We&apos;ll snapshot every step screenshot and promote
                them into a new baseline. Future runs of that test will
                compare against them automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/tests">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Play className="w-4 h-4 mr-2" /> Pick a test to run
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/baselines/new">
                <Button variant="outline">
                  Or create manually
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Running list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : baselines && baselines.length > 0 ? (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3 h-3" /> Each baseline is one approved
            screenshot set. Delete to force future runs to ignore it.
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0 divide-y divide-border">
              {baselines.map((b: any) => {
                const shots =
                  typeof b.screenshots === 'string'
                    ? JSON.parse(b.screenshots)
                    : b.screenshots;
                const shotCount = Array.isArray(shots) ? shots.length : 0;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {b.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono"
                        >
                          {shotCount} frame
                          {shotCount === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {b.branch || 'main'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-muted/50"
                        >
                          {b.type || 'PROJECT'}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(b.updatedAt || b.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => {
                        if (confirm(`Delete baseline "${b.name}"?`))
                          deleteMutation.mutate(b.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
