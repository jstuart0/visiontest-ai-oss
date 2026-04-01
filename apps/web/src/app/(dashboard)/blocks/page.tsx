'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blocksApi, TaskBlock } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Puzzle, FileCode } from 'lucide-react';

const BLOCK_TYPES = [
  { value: 'authentication', label: 'Authentication' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'form', label: 'Form' },
  { value: 'data', label: 'Data' },
  { value: 'assertion', label: 'Assertion' },
];

export default function BlocksPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({ name: '', description: '', type: 'navigation' });

  const { data: blocks, isLoading } = useQuery({
    queryKey: ['blocks', project?.id],
    queryFn: () => blocksApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; type: string }) =>
      blocksApi.create({ ...data, projectId: project!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setCreateOpen(false);
      setNewBlock({ name: '', description: '', type: 'navigation' });
      toast.success('Block created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create block'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blocksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('Block deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete block'),
  });

  if (!project) return <div className="p-6 text-muted-foreground">Select a project to manage blocks.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Task Blocks</h1>
          <p className="text-muted-foreground">Reusable building blocks for workflow automation.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Block</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task Block</DialogTitle>
              <DialogDescription>Define a reusable block for your workflows.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newBlock.name}
                  onChange={(e) => setNewBlock((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Login Flow"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newBlock.description}
                  onChange={(e) => setNewBlock((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Handles user authentication"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newBlock.type} onValueChange={(v) => setNewBlock((s) => ({ ...s, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(newBlock)}
                disabled={!newBlock.name || createMutation.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !blocks?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No task blocks yet. Create one to use in workflows.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blocks.map((block: TaskBlock) => (
            <Card key={block.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    {block.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      deleteMutation.mutate(block.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <CardDescription>{block.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{block.type}</Badge>
                  {block.isTemplate && <Badge variant="secondary">Template</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
