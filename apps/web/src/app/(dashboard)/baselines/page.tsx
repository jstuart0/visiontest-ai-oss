'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { baselinesApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Image, Trash2, GitBranch, Calendar } from 'lucide-react';

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
    onError: (error: any) => toast.error(error.message || 'Failed to delete'),
  });

  if (!project) return <div className="p-6 text-muted-foreground">Select a project to manage baselines.</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Baselines</h1>
        <p className="text-muted-foreground">
          Manage approved baseline screenshots for visual regression testing.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !baselines?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No baselines yet. Run a test and approve its screenshots to create baselines.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {baselines.map((baseline: any) => (
            <Card key={baseline.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <Image className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{baseline.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" /> {baseline.branch || 'main'}
                      </span>
                      <Badge variant="outline" className="text-xs">{baseline.type || 'PROJECT'}</Badge>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {new Date(baseline.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onClick={() => deleteMutation.mutate(baseline.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
