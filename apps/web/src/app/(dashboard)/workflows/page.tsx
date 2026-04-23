'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  GitBranch,
  Plus,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentProject } from '@/hooks/useProject';
import { workflowsApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function WorkflowsPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows', project?.id],
    queryFn: () => workflowsApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; projectId: string }) =>
      workflowsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setCreateOpen(false);
      setName('');
      setDescription('');
      toast.success('Workflow created');
    },
    onError: () => toast.error('Failed to create workflow'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      workflowsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
    },
    onError: () => toast.error('Failed to delete workflow'),
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <GitBranch className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Project Selected</h2>
        <p className="text-muted-foreground">Select a project to manage workflows.</p>
      </div>
    );
  }

  // Orchestra — workflows chain blocks together. Use a musical metaphor
  // for the headline: a workflow is a scored sequence.
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Orchestra · Workflows</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 0.98 }}>
            The <em>score</em>.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            A workflow is an arrangement — blocks played in sequence, with
            conditions that branch and loops that repeat. Schedule it, trigger
            it from a webhook, run it on demand.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Workflow</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Define a new test workflow with composable steps.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Full Regression Suite"
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this workflow do?"
                  className="bg-muted border-border"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name,
                    description: description || undefined,
                    projectId: project.id,
                  })
                }
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : (workflows as any[])?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="w-12 h-12 text-muted-foreground/70 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-1">No workflows yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first workflow to automate test sequences.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(workflows as any[])?.map((workflow: any) => (
            <Card key={workflow.id} className="bg-card border-border hover:border-border/80 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      workflow.isActive ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <Link
                      href={`/workflows/${workflow.id}`}
                      className="font-medium text-foreground hover:text-blue-400 transition-colors"
                    >
                      {workflow.name}
                    </Link>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(workflow.createdAt).toLocaleDateString()}
                      </span>
                      <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                        {workflow.steps?.length || 0} steps
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Switch
                      checked={workflow.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: workflow.id, isActive: checked })
                      }
                    />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-card border-border">
                      <DropdownMenuItem asChild>
                        <Link href={`/workflows/${workflow.id}`} className="gap-2">
                          <Edit className="w-4 h-4" />
                          Edit Steps
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400 gap-2"
                        onClick={() => deleteMutation.mutate(workflow.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
