'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Image as ImageIcon,
  Settings,
  History,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { testsApi, visualApi, masksApi, flakyApi, baselinesApi, type Test, type VisualComparison, type Mask, type Execution } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { StepEditor, type TestStep as EditorTestStep } from '@/components/step-editor';
// Note: useEffect is imported at the top

const statusConfig = {
  passed: {
    color: 'bg-green-500',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: CheckCircle2,
    label: 'Passed',
  },
  failed: {
    color: 'bg-red-500',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: XCircle,
    label: 'Failed',
  },
  flaky: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: AlertTriangle,
    label: 'Flaky',
  },
  running: {
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: Activity,
    label: 'Running',
  },
  pending: {
    color: 'bg-muted',
    textColor: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    icon: Clock,
    label: 'Pending',
  },
};

export default function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: testId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedSteps, setEditedSteps] = useState<EditorTestStep[] | null>(null);
  const [screenshotEveryStep, setScreenshotEveryStep] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);

  const { data: test, isLoading } = useQuery<Test>({
    queryKey: ['test', project?.id, testId],
    queryFn: () => testsApi.get(project!.id, testId),
    enabled: !!project?.id,
  });

  // Update form fields when test loads
  useEffect(() => {
    if (test) {
      setName(test.name);
      setDescription(test.description || '');
      // Load config flags
      const cfg = (test as any).config || {};
      setScreenshotEveryStep(cfg.screenshotEveryStep ?? false);
      setVideoRecording(cfg.videoRecording ?? false);
    }
  }, [test]);

  const { data: visuals } = useQuery<VisualComparison[]>({
    queryKey: ['visual', project?.id, testId],
    queryFn: () => visualApi.list(project!.id),
    enabled: !!project?.id,
  });

  const { data: masks } = useQuery<Mask[]>({
    queryKey: ['masks', project?.id, testId],
    queryFn: () => masksApi.list(project!.id, { testId }),
    enabled: !!project?.id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Test>) =>
      testsApi.update(project!.id, testId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', project?.id, testId] });
      toast.success('Test updated');
      setHasChanges(false);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to update test');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => testsApi.delete(project!.id, testId),
    onSuccess: () => {
      toast.success('Test deleted');
      router.push('/tests');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete test');
    },
  });

  const runMutation = useMutation({
    mutationFn: () => testsApi.run(project!.id, testId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['test', project?.id, testId] });
      toast.success('Test run started - redirecting to live view...');
      router.push(`/executions/${data.id}`);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to run test');
    },
  });

  // Set-as-baseline from the latest PASSED execution.
  // The button is hidden when no passed execution exists; this keeps
  // the workflow single-click when it's viable and invisible otherwise.
  const latestPassed = (test as any)?.recentExecutions?.find(
    (e: { status: string }) => e.status === 'PASSED',
  );
  const setBaselineMutation = useMutation({
    mutationFn: () => {
      if (!latestPassed) throw new Error('No passed execution found');
      return baselinesApi.fromExecution(latestPassed.id, {});
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['baselines'] });
      toast.success(
        res.replaced
          ? `Baseline "${res.name}" updated from the latest passing run`
          : `Baseline "${res.name}" created from the latest passing run`,
      );
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not set baseline');
    },
  });

  const quarantineMutation = useMutation({
    mutationFn: () => {
      const isQuarantined = test?.status === 'QUARANTINED';
      return isQuarantined ? flakyApi.unquarantine(testId) : flakyApi.quarantine(testId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', project?.id, testId] });
      toast.success(test?.status === 'QUARANTINED' ? 'Test released from quarantine' : 'Test quarantined');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update quarantine status'),
  });

  const handleSave = () => {
    const updates: any = { name, description: description || undefined };
    if (editedSteps) {
      updates.steps = editedSteps;
    }
    updates.config = {
      ...((test as any)?.config || {}),
      screenshotEveryStep,
      videoRecording,
    };
    updateMutation.mutate(updates);
  };

  const handleChange = (field: 'name' | 'description', value: string) => {
    if (field === 'name') setName(value);
    else setDescription(value);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading test...</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">Test not found</div>
        <Link href="/tests">
          <Button variant="outline">Back to Tests</Button>
        </Link>
      </div>
    );
  }

  // Derive display status from last execution, not test entity status
  const lastStatus = ((test as any).lastStatus || '').toLowerCase();
  const displayStatus = lastStatus === 'passed' || lastStatus === 'failed' || lastStatus === 'running' || lastStatus === 'flaky'
    ? lastStatus
    : (test as any).lastRun ? 'pending' : 'pending';
  const config =
    statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  const testVisuals = visuals?.filter((v) => v.testId === testId) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/tests')}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{test.name}</h1>
              <Badge
                variant="secondary"
                className={cn('gap-1', config.bgColor, config.textColor)}
              >
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {test.lastRun
                ? `Last run: ${new Date(test.lastRun).toLocaleString()}`
                : 'Never run'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-card border-border text-muted-foreground hover:bg-accent"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Test
          </Button>
          {latestPassed && (
            <Button
              variant="outline"
              onClick={() => setBaselineMutation.mutate()}
              disabled={setBaselineMutation.isPending}
              className="text-blue-400 border-blue-700/40 hover:bg-blue-900/20"
              title={`Use the latest passing run (${new Date(
                latestPassed.createdAt,
              ).toLocaleDateString()}) as the visual baseline. Future runs will compare against it.`}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Set as baseline
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDelete(true)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="steps" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger
            value="steps"
            className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
          >
            <List className="w-4 h-4 mr-2" />
            Steps
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="visuals"
            className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Visuals ({testVisuals.length})
          </TabsTrigger>
          <TabsTrigger
            value="masks"
            className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
          >
            Masks ({masks?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
          >
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Steps Tab */}
        <TabsContent value="steps" className="space-y-6">
          <StepEditor
            steps={(() => {
              if (editedSteps) return editedSteps;
              const raw = (test as any)?.steps;
              if (!raw) return [];
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              return Array.isArray(parsed) ? parsed : [];
            })()}
            platform={(test as any)?.platform || 'WEB'}
            onChange={(newSteps) => {
              setEditedSteps(newSteps);
              setHasChanges(true);
            }}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Test Details</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure your test settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Test Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Optional description"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </CardContent>
          </Card>

          {/* Execution Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Execution Settings</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure how tests are executed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-foreground">
                    Screenshot every step
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Automatically capture a screenshot after each step completes
                  </p>
                </div>
                <Switch
                  checked={screenshotEveryStep}
                  onCheckedChange={(checked) => {
                    setScreenshotEveryStep(checked);
                    setHasChanges(true);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-foreground">
                    Record video
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Record a video of the entire test execution
                  </p>
                </div>
                <Switch
                  checked={videoRecording}
                  onCheckedChange={(checked) => {
                    setVideoRecording(checked);
                    setHasChanges(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {test.flakyScore !== undefined && test.flakyScore > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Flaky Test Detection
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  This test has been flagged as potentially flaky
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Flaky Score</span>
                      <span className="text-sm font-medium text-foreground">
                        {test.flakyScore}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          test.flakyScore > 50
                            ? 'bg-red-500'
                            : test.flakyScore > 20
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        )}
                        style={{ width: `${test.flakyScore}%` }}
                      />
                    </div>
                  </div>
                  <Button
                    variant={test.status === 'QUARANTINED' ? 'default' : 'outline'}
                    className={test.status === 'QUARANTINED' ? '' : 'bg-muted border-border text-muted-foreground'}
                    onClick={() => quarantineMutation.mutate()}
                    disabled={quarantineMutation.isPending}
                  >
                    {test.status === 'QUARANTINED' ? 'Release from Quarantine' : 'Quarantine Test'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Visuals Tab */}
        <TabsContent value="visuals" className="space-y-4">
          {testVisuals.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No visual snapshots yet</p>
                <p className="text-sm text-muted-foreground">
                  Run the test to generate visual snapshots
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testVisuals.map((visual) => (
                <Link key={visual.id} href={`/visual/${visual.id}`}>
                  <Card className="bg-card border-border hover:border-border/80 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/70" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {new Date(visual.createdAt).toLocaleString()}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            visual.status === 'approved' &&
                              'bg-green-500/10 text-green-400',
                            visual.status === 'rejected' &&
                              'bg-red-500/10 text-red-400',
                            visual.status === 'pending' &&
                              'bg-yellow-500/10 text-yellow-400',
                            visual.status === 'changed' &&
                              'bg-blue-500/10 text-blue-400'
                          )}
                        >
                          {visual.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Masks Tab */}
        <TabsContent value="masks" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Ignore Masks</CardTitle>
              <CardDescription className="text-muted-foreground">
                Define regions to ignore during visual comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!masks || masks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No masks defined for this test
                </div>
              ) : (
                <div className="space-y-2">
                  {masks.map((mask) => (
                    <div
                      key={mask.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {mask.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mask.x}, {mask.y} - {mask.width}x{mask.height}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-muted">
                        {mask.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Execution History</CardTitle>
              <CardDescription className="text-muted-foreground">
                Recent test runs and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const executions = (test as any).recentExecutions as Array<{
                  id: string;
                  status: string;
                  duration?: number;
                  createdAt: string;
                }> | undefined;
                if (!executions || executions.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12">
                      <History className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No executions yet</p>
                      <p className="text-sm text-muted-foreground">Run the test to see execution history</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {executions.map((exec) => {
                      const execStatus = exec.status.toLowerCase();
                      const execConfig = statusConfig[execStatus as keyof typeof statusConfig] || statusConfig.pending;
                      const ExecIcon = execConfig.icon;
                      return (
                        <Link key={exec.id} href={`/executions/${exec.id}`}>
                          <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-accent transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className={cn('p-1.5 rounded-md', execConfig.bgColor)}>
                                <ExecIcon className={cn('w-4 h-4', execConfig.textColor)} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {execConfig.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(exec.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {exec.duration != null && (
                                <p className="text-sm text-muted-foreground">
                                  {(exec.duration / 1000).toFixed(1)}s
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Test</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete &quot;{test.name}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDelete(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
