'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentProject } from '@/hooks/useProject';
import { api } from '@/lib/api';

interface Execution {
  id: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  triggeredBy: string;
  triggerRef?: string;
  platform?: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
  test?: { id: string; name: string };
  suite?: { id: string; name: string };
}

const statusConfig = {
  PENDING: { icon: Clock, color: 'bg-muted', label: 'Pending' },
  QUEUED: { icon: Clock, color: 'bg-yellow-500', label: 'Queued' },
  RUNNING: { icon: Activity, color: 'bg-blue-500 animate-pulse', label: 'Running' },
  PASSED: { icon: CheckCircle2, color: 'bg-green-500', label: 'Passed' },
  FAILED: { icon: XCircle, color: 'bg-red-500', label: 'Failed' },
  CANCELLED: { icon: AlertTriangle, color: 'bg-orange-500', label: 'Cancelled' },
  TIMEOUT: { icon: AlertTriangle, color: 'bg-orange-500', label: 'Timeout' },
};

export default function ExecutionsPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ['executions', project?.id, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: project!.id, limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get<Execution[]>(`/executions?${params}`);
      return res;
    },
    enabled: !!project,
    refetchInterval: 5000,
  });

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTime = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a project first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executions</h1>
          <p className="text-muted-foreground">
            Test execution history and live monitoring
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'RUNNING', 'PASSED', 'FAILED', 'PENDING', 'CANCELLED'].map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {status === 'all' ? 'All' : statusConfig[status as keyof typeof statusConfig]?.label || status}
          </Button>
        ))}
      </div>

      {/* Result count */}
      {!isLoading && executions.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {executions.length} execution{executions.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` (filtered by ${statusConfig[statusFilter as keyof typeof statusConfig]?.label || statusFilter})`}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-12 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No executions yet</h3>
            <p className="text-muted-foreground mb-4">
              Run a test to see execution history here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {executions.map((execution) => {
            const config = statusConfig[execution.status];
            const StatusIcon = config.icon;
            const isLive = ['PENDING', 'QUEUED', 'RUNNING'].includes(execution.status);

            return (
              <Card
                key={execution.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  isLive ? 'border-blue-500/50' : ''
                }`}
                onClick={() => router.push(`/executions/${execution.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${config.color}`}>
                        <StatusIcon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {execution.test?.name || execution.suite?.name || 'Execution'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          {isLive && (
                            <Badge className="bg-blue-500 text-white text-xs animate-pulse">
                              LIVE
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>Started: {formatTime(execution.startedAt || execution.createdAt)}</span>
                          <span>Duration: {formatDuration(execution.duration)}</span>
                          <span className="capitalize">{execution.triggeredBy?.toLowerCase()}</span>
                          {execution.platform && execution.platform !== 'WEB' && (
                            <Badge variant="outline" className="text-xs">{execution.platform}</Badge>
                          )}
                          {execution.triggerRef?.startsWith('workflow:') && (
                            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400">Workflow</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
