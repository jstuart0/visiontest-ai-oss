'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesApi, Schedule } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { Plus, Trash2, Play, Clock, CalendarDays } from 'lucide-react';

export default function SchedulesPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    cron: '0 2 * * *',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules', project?.id],
    queryFn: () => schedulesApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; cron: string; timezone: string }) =>
      schedulesApi.create({ ...data, projectId: project!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setCreateOpen(false);
      setNewSchedule({ name: '', cron: '0 2 * * *', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      toast.success('Schedule created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create schedule'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.run(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule triggered');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to trigger schedule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete schedule'),
  });

  function describeCron(cron: string): string {
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;
    const [min, hour, dom, month, dow] = parts;
    if (dom === '*' && month === '*' && dow === '*') {
      return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    if (dom === '*' && month === '*' && dow !== '*') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[parseInt(dow)] || dow} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    return cron;
  }

  if (!project) return <div className="p-6 text-muted-foreground">Select a project to manage schedules.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">Automate test execution with cron-based scheduling.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Schedule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Schedule</DialogTitle>
              <DialogDescription>Set up automated test execution on a cron schedule.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Nightly Regression"
                />
              </div>
              <div>
                <Label htmlFor="cron">Cron Expression</Label>
                <Input
                  id="cron"
                  value={newSchedule.cron}
                  onChange={(e) => setNewSchedule((s) => ({ ...s, cron: e.target.value }))}
                  placeholder="0 2 * * *"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {describeCron(newSchedule.cron)} ({newSchedule.timezone})
                </p>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={newSchedule.timezone}
                  onChange={(e) => setNewSchedule((s) => ({ ...s, timezone: e.target.value }))}
                  placeholder="America/New_York"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(newSchedule)}
                disabled={!newSchedule.name || !newSchedule.cron || createMutation.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !schedules?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No schedules yet. Create one to automate your test runs.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule: Schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {schedule.name}
                    <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                      {schedule.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {describeCron(schedule.cron)} ({schedule.timezone})
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.isActive}
                    onCheckedChange={() => toggleMutation.mutate(schedule.id)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runMutation.mutate(schedule.id)}
                    disabled={runMutation.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" /> Run Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      deleteMutation.mutate(schedule.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {schedule.lastRunAt && (
                    <span>Last run: {new Date(schedule.lastRunAt).toLocaleString()}</span>
                  )}
                  {schedule.nextRunAt && (
                    <span>Next run: {new Date(schedule.nextRunAt).toLocaleString()}</span>
                  )}
                  {!schedule.lastRunAt && !schedule.nextRunAt && (
                    <span>Never run</span>
                  )}
                  <span className="font-mono text-xs">cron: {schedule.cron}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
