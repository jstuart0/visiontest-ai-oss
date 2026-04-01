'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Play,
  ChevronUp,
  ChevronDown,
  GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentProject } from '@/hooks/useProject';
import { workflowsApi, blocksApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id?: string;
  blockId: string;
  block?: any;
  order: number;
  config: Record<string, any>;
}

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();
  const workflowId = params.id as string;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ['workflows', workflowId],
    queryFn: () => workflowsApi.get(workflowId),
    enabled: !!workflowId,
  });

  const { data: blocks } = useQuery({
    queryKey: ['blocks', project?.id],
    queryFn: () => blocksApi.list(project!.id),
    enabled: !!project?.id,
  });

  useEffect(() => {
    if (workflow) {
      const wf = workflow as any;
      setName(wf.name || '');
      setDescription(wf.description || '');
      setSteps(
        (wf.steps || []).map((s: any) => ({
          id: s.id,
          blockId: s.blockId || s.block?.id || '',
          block: s.block,
          order: s.order,
          config: s.config || {},
        }))
      );
    }
  }, [workflow]);

  async function handleSave() {
    setSaving(true);
    try {
      // Update workflow metadata
      await workflowsApi.update(workflowId, {
        name,
        description: description || undefined,
      });

      // Update steps individually via the step sub-resource API
      // Delete existing steps and re-create (simplest approach for reordering)
      const existingSteps = workflow?.steps || [];
      for (const step of existingSteps) {
        if (step.id) {
          await workflowsApi.deleteStep(workflowId, step.id);
        }
      }
      for (let i = 0; i < steps.length; i++) {
        await workflowsApi.addStep(workflowId, {
          blockId: steps[i].blockId,
          order: i,
          config: steps[i].config,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow saved');
    } catch {
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }

  function addStep(blockId: string) {
    const block = (blocks as any[])?.find((b: any) => b.id === blockId);
    if (!block) return;
    setSteps([
      ...steps,
      {
        blockId,
        block,
        order: steps.length,
        config: {},
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const newSteps = [...steps];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newSteps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps);
  }

  // Group blocks by type
  const blocksByType = ((blocks as any[]) || []).reduce<Record<string, any[]>>((acc, b) => {
    const type = b.type || 'General';
    if (!acc[type]) acc[type] = [];
    acc[type].push(b);
    return acc;
  }, {});

  if (workflowLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workflows
          </Link>
          <div className="mt-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-1 text-foreground"
              placeholder="Workflow name"
            />
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description..."
            className="text-sm text-muted-foreground bg-transparent border-none p-0 h-auto mt-1 focus-visible:ring-1"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="default"
            className="gap-2 bg-green-600 hover:bg-green-700"
            disabled={steps.length === 0}
            onClick={async () => {
              try {
                const result = await workflowsApi.run(workflowId);
                toast.success('Workflow run started');
                router.push(`/executions/${result.executionId}`);
              } catch {
                toast.error('Failed to run workflow');
              }
            }}
          >
            <Play className="h-4 w-4" />
            Run
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const json = await workflowsApi.exportJson(workflowId);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `workflow-${name || workflowId}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Workflow exported');
            }}
          >
            Export
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Workflow Canvas */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-foreground">Workflow Steps</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add task blocks from the sidebar to compose your workflow
              </p>
            </CardHeader>
            <CardContent className="p-4 min-h-[400px]">
              {steps.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  <div className="text-center">
                    <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Add task blocks from the sidebar</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {steps.map((step, i) => {
                    const block =
                      step.block || (blocks as any[])?.find((b: any) => b.id === step.blockId);
                    return (
                      <div
                        key={`${step.blockId}-${i}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 group hover:border-border/80 transition-colors"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/70 cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}.</span>
                            <span className="font-medium text-sm text-foreground">
                              {block?.name || 'Unknown Block'}
                            </span>
                            {block?.type && (
                              <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                                {block.type}
                              </Badge>
                            )}
                          </div>
                          {block?.description && (
                            <p className="ml-8 mt-0.5 text-xs text-muted-foreground truncate">
                              {block.description}
                            </p>
                          )}
                        </div>

                        {/* Parameter Bindings */}
                        <div className="flex flex-col gap-1">
                          {block?.config?.parameters && Array.isArray(block.config.parameters) && (
                            <div className="flex flex-wrap gap-1">
                              {block.config.parameters.map((param: any) => (
                                <Input
                                  key={param.name || param}
                                  placeholder={`${typeof param === 'string' ? param : param.name}`}
                                  value={(step.config?.params as any)?.[typeof param === 'string' ? param : param.name] || ''}
                                  onChange={(e) => {
                                    const paramName = typeof param === 'string' ? param : param.name;
                                    const newSteps = [...steps];
                                    newSteps[i] = {
                                      ...newSteps[i],
                                      config: {
                                        ...newSteps[i].config,
                                        params: {
                                          ...((newSteps[i].config?.params as any) || {}),
                                          [paramName]: e.target.value,
                                        },
                                      },
                                    };
                                    setSteps(newSteps);
                                  }}
                                  className="h-6 text-xs w-24 bg-muted border-border"
                                />
                              ))}
                            </div>
                          )}
                          {i > 0 && (
                            <Input
                              placeholder="Bind from prev: {{step1.output}}"
                              value={(step.config?.inputBinding as string) || ''}
                              onChange={(e) => {
                                const newSteps = [...steps];
                                newSteps[i] = {
                                  ...newSteps[i],
                                  config: { ...newSteps[i].config, inputBinding: e.target.value },
                                };
                                setSteps(newSteps);
                              }}
                              className="h-6 text-xs bg-muted border-border font-mono"
                            />
                          )}
                        </div>

                        <Select
                          value={(step.config as any)?.onFailure || 'STOP'}
                          onValueChange={(val) => {
                            const newSteps = [...steps];
                            newSteps[i] = {
                              ...newSteps[i],
                              config: { ...newSteps[i].config, onFailure: val },
                            };
                            setSteps(newSteps);
                          }}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs bg-muted border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="STOP">Stop on fail</SelectItem>
                            <SelectItem value="CONTINUE">Continue</SelectItem>
                            <SelectItem value="RETRY">Retry</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => moveStep(i, 'up')}
                            disabled={i === 0}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => moveStep(i, 'down')}
                            disabled={i === steps.length - 1}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                            onClick={() => removeStep(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Block Sidebar */}
        <div>
          <Card className="bg-card border-border sticky top-4">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-foreground text-base">Available Blocks</CardTitle>
            </CardHeader>
            <CardContent className="p-3 max-h-[600px] overflow-y-auto">
              {Object.keys(blocksByType).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No blocks available.</p>
                  <p className="text-xs mt-1">
                    Create task blocks first to use them in workflows.
                  </p>
                </div>
              ) : (
                Object.entries(blocksByType).map(([type, typeBlocks]) => (
                  <div key={type} className="mb-4">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      {type}
                    </h3>
                    <div className="space-y-1">
                      {typeBlocks.map((block: any) => (
                        <button
                          key={block.id}
                          onClick={() => addStep(block.id)}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition flex items-center gap-2 text-muted-foreground"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{block.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
