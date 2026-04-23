'use client';

// Template gallery.
//
// Browseable standalone view of every story template. Grouped by source
// (builtin first, community second), sorted by usage within each group
// so popular starters surface. Card hover reveals a preview of the
// compiled story + goal so you can judge fit before committing.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Search,
  TrendingUp,
  BookOpen,
  Target,
  ArrowRight,
  Loader2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCurrentProject } from '@/hooks/useProject';
import { templatesApi, type Template } from '@/lib/api';

export default function TemplatesPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'builtin' | 'community'>('all');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list(),
  });

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = query.toLowerCase().trim();
    return templates
      .filter((t) => sourceFilter === 'all' || t.source === sourceFilter)
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.storyText.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Builtins float to top within a filtered view; within a source,
        // heavier-used templates rank higher. Ties break alphabetically.
        if (a.source !== b.source) {
          return a.source === 'builtin' ? -1 : 1;
        }
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return a.title.localeCompare(b.title);
      });
  }, [templates, query, sourceFilter]);

  const pickTemplate = async (t: Template) => {
    // Bump usage asynchronously, then route to /tests/new with the
    // template slug as a query param. The editor reads ?template=<slug>
    // and pre-populates the story + goal + name.
    if (project) {
      try {
        await templatesApi.pick(t.slug, project.id);
      } catch {
        // Non-fatal — pick is an engagement signal, not a requirement.
      }
    }
    router.push(`/tests/new?template=${encodeURIComponent(t.slug)}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6" /> Templates
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          One-click story scaffolds for common journeys. Pick one,
          substitute the tokens ({`{{baseUrl}}`}, {`{{password}}`}), and
          run against your app.
        </p>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-9 bg-muted border-border"
          />
        </div>
        <div className="flex items-center gap-1 text-xs bg-muted rounded-md p-1">
          {(['all', 'builtin', 'community'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-1 rounded capitalize ${
                sourceFilter === s
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-dashed border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates match that filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card
              key={t.slug}
              className="bg-card border-border hover:border-muted-foreground transition-colors flex flex-col"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-foreground text-base leading-tight">
                    {t.title}
                  </CardTitle>
                  {t.source === 'community' ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-purple-900/20 text-purple-300 border-purple-800/50 flex-shrink-0"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      community
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-900/20 text-blue-300 border-blue-800/50 flex-shrink-0"
                    >
                      builtin
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground line-clamp-2">
                  {t.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col pt-0">
                {/* Story preview */}
                <div className="flex-1 min-h-0">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <BookOpen className="w-3 h-3" /> Story
                  </div>
                  <pre className="font-mono text-[11px] text-muted-foreground/90 bg-muted/50 rounded px-2 py-1.5 whitespace-pre-wrap line-clamp-5">
                    {t.storyText}
                  </pre>
                </div>
                {t.goalText && (
                  <div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      <Target className="w-3 h-3" /> Goal
                    </div>
                    <pre className="font-mono text-[11px] text-muted-foreground/90 bg-muted/50 rounded px-2 py-1.5 whitespace-pre-wrap line-clamp-3">
                      {t.goalText}
                    </pre>
                  </div>
                )}
                {/* Footer row */}
                <div className="flex items-center justify-between pt-1 mt-auto">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {t.usageCount > 0 ? (
                      <>
                        <TrendingUp className="w-3 h-3" />{' '}
                        {t.usageCount} use{t.usageCount === 1 ? '' : 's'}
                      </>
                    ) : (
                      'Unused'
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => pickTemplate(t)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Use template
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
