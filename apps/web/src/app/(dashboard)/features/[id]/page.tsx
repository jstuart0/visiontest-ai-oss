'use client';

// Feature detail — one feature + its scenarios.
//
// UX: the shared setup is read-only prose up top so it's visible on
// every scenario edit. Scenarios list inline with last-run status
// chips. "Add scenario" jumps to the story editor pre-populated with
// the featureId query param so the resulting test auto-links back.

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Edit3,
  Save,
  X,
  Target,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { featuresApi } from '@/lib/api';

const STATUS_META: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  ACTIVE: { icon: Clock, color: 'text-muted-foreground', label: 'Active' },
  PASSED: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Passed' },
  FAILED: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  DISABLED: { icon: Clock, color: 'text-muted-foreground', label: 'Disabled' },
  ARCHIVED: { icon: Clock, color: 'text-muted-foreground', label: 'Archived' },
};

export default function FeatureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const featureId = params.id as string;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    sharedSetup: '',
  });

  const { data: feature, isLoading } = useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => featuresApi.get(featureId),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      featuresApi.update(featureId, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        sharedSetup: draft.sharedSetup.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature', featureId] });
      queryClient.invalidateQueries({ queryKey: ['features'] });
      setEditing(false);
      toast.success('Feature updated');
    },
    onError: (err: any) => toast.error(err.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => featuresApi.delete(featureId),
    onSuccess: () => {
      toast.success('Feature deleted');
      queryClient.invalidateQueries({ queryKey: ['features'] });
      router.push('/features');
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed'),
  });

  const startEdit = () => {
    if (!feature) return;
    setDraft({
      name: feature.name,
      description: feature.description ?? '',
      sharedSetup: feature.sharedSetup ?? '',
    });
    setEditing(true);
  };

  if (isLoading || !feature) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  const scenarios = feature.tests ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/features')}
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          {editing ? (
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="bg-muted border-border text-foreground text-xl font-bold"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Layers className="w-6 h-6" /> {feature.name}
            </h1>
          )}
          {!editing && feature.description && (
            <p className="text-muted-foreground mt-1">
              {feature.description}
            </p>
          )}
        </div>
        {!editing ? (
          <>
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Edit3 className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (scenarios.length > 0) {
                  toast.error(
                    `Delete ${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} first, or unassign them from this feature.`,
                  );
                  return;
                }
                if (confirm('Delete this feature?')) deleteMutation.mutate();
              }}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 border-red-900/40"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={!draft.name.trim() || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}{' '}
              Save
            </Button>
          </>
        )}
      </div>

      {/* Shared setup card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" /> Shared setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <Textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="Description — what this feature covers"
                className="bg-muted border-border font-normal min-h-[60px]"
              />
              <Textarea
                value={draft.sharedSetup}
                onChange={(e) =>
                  setDraft({ ...draft, sharedSetup: e.target.value })
                }
                placeholder="Shared setup — prose prepended to every scenario"
                className="bg-muted border-border font-mono min-h-[120px]"
              />
            </>
          ) : feature.sharedSetup ? (
            <pre className="font-mono text-sm text-foreground bg-muted/50 rounded px-3 py-2 whitespace-pre-wrap">
              {feature.sharedSetup}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No shared setup defined. Click Edit to add prose that will be
              prepended to every scenario&apos;s story before parsing.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Scenarios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            Scenarios ({scenarios.length})
          </h2>
          <Link
            href={`/tests/new?featureId=${feature.id}`}
            className="inline-flex"
          >
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add scenario
            </Button>
          </Link>
        </div>
        {scenarios.length === 0 ? (
          <Card className="bg-card border-dashed border-border">
            <CardContent className="py-8 flex flex-col items-center text-center gap-3">
              <div className="text-sm text-muted-foreground max-w-md">
                No scenarios yet. Each scenario is a full story + goal that
                inherits this feature&apos;s setup. Good first ones: happy
                path, wrong input, locked/error state.
              </div>
              <Link href={`/tests/new?featureId=${feature.id}`}>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" /> Add the first scenario
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {scenarios.map((s, i) => {
              const meta = STATUS_META[s.status] ?? STATUS_META.ACTIVE;
              const Icon = meta.icon;
              return (
                <Link
                  key={s.id}
                  href={`/tests/${s.id}`}
                  className="block"
                >
                  <Card className="bg-card border-border hover:border-muted-foreground transition-colors">
                    <CardContent className="py-3 flex items-center gap-3">
                      <div className="text-muted-foreground text-xs tabular-nums w-6">
                        {i + 1}.
                      </div>
                      <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground font-medium truncate">
                          {s.name}
                        </div>
                        {s.goal && (
                          <div className="text-xs text-muted-foreground italic truncate mt-0.5">
                            goal: {s.goal}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {meta.label}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
