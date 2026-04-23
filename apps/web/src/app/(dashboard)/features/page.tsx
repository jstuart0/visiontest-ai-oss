'use client';

// Features list — scenario-grouping surface.
//
// UX principles from the plan: (a) text-first — the free-form name and
// sharedSetup are the point, not a wizard; (b) empty state teaches with
// a concrete example; (c) preview-and-edit — you see the setup prose
// inline, no nested dialog for the core content.

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  ArrowRight,
  Loader2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { featuresApi, type Feature } from '@/lib/api';

const EXAMPLE_SETUP =
  'navigate /login, wait for input[type=password]';

export default function FeaturesPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    sharedSetup: '',
  });

  const { data: features, isLoading } = useQuery({
    queryKey: ['features', project?.id],
    queryFn: () => featuresApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      featuresApi.create({
        projectId: project!.id,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        sharedSetup: draft.sharedSetup.trim() || undefined,
      }),
    onSuccess: (f: Feature) => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      toast.success(`Feature "${f.name}" created`);
      setCreateOpen(false);
      setDraft({ name: '', description: '', sharedSetup: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Create failed'),
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">
          Select a project to manage features
        </div>
        <Link href="/">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 space-y-10 vt-reveal">
      <header className="pb-6 border-b flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Features · Scenario groups</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 0.97 }}>
            Group <em>related</em> scenarios.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            One Feature, many scenarios, shared setup. Perfect for "login"
            with a happy path, a wrong-password path, a lockout path — all
            sharing the same setup prose.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> New feature
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>New feature</DialogTitle>
              <DialogDescription>
                A feature is a group of scenarios that share setup. Think
                &quot;Login&quot; with scenarios for happy path, wrong
                password, lockout, forgot password.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.name.trim()) return;
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  autoFocus
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  placeholder="e.g. Login, Checkout, Settings"
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  placeholder="What this feature covers"
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Shared setup (prose)
                </label>
                <Textarea
                  value={draft.sharedSetup}
                  onChange={(e) =>
                    setDraft({ ...draft, sharedSetup: e.target.value })
                  }
                  placeholder={EXAMPLE_SETUP}
                  className="bg-muted border-border font-mono min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Prepended to every scenario&apos;s story before parsing.
                  One action per sentence, same rules as the regular story
                  editor.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!draft.name.trim() || createMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create feature'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading features…
        </div>
      ) : features && features.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <Link key={f.id} href={`/features/${f.id}`} className="group">
              <Card className="bg-card border-border hover:border-muted-foreground transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-foreground text-base">
                      {f.name}
                    </CardTitle>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
                  </div>
                  {f.description && (
                    <CardDescription className="text-muted-foreground">
                      {f.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {f.sharedSetup && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Shared setup
                      </div>
                      <pre className="font-mono text-xs text-muted-foreground/90 bg-muted/50 rounded px-2 py-1.5 whitespace-pre-wrap line-clamp-3">
                        {f.sharedSetup}
                      </pre>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="bg-muted/50">
                      {f._count?.tests ?? 0} scenario
                      {(f._count?.tests ?? 0) === 1 ? '' : 's'}
                    </Badge>
                    <span className="text-muted-foreground">
                      updated{' '}
                      {new Date(f.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-border">
          <CardContent className="py-12 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <Layers className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-foreground font-medium">
                No features yet
              </h3>
              <p className="text-sm text-muted-foreground">
                A feature is a group of scenarios with shared setup. Great
                for a page or journey that has multiple variations — happy
                path, error cases, edge cases.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Try an example
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
