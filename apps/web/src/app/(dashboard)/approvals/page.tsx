'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsApi, ApprovalRequest } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ApprovalsPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: ['approvals', 'pending', project?.id],
    queryFn: () => approvalsApi.pending(project!.id),
    enabled: !!project?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ['approvals', 'stats', project?.id],
    queryFn: () => approvalsApi.stats(project!.id),
    enabled: !!project?.id,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Approved');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id, 'Rejected via approvals page'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Rejected');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to reject'),
  });

  function severityColor(severity?: string) {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      default: return 'secondary';
    }
  }

  if (!project) return <div className="p-6 text-muted-foreground">Select a project to view approvals.</div>;

  // Tribunal — decisions, not a feed. Escalations and rules live here;
  // the surface mirrors the /visual review room in spirit but focuses on
  // the routing itself (who approves what).
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-5">§ Tribunal · Approval routing</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 0.98 }}>
          Who decides <em>what</em>.
        </h1>
        <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
          Escalations, rules, and the queue of changes awaiting a human verdict.
          The review itself happens in the room next door.
        </p>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl">{stats.pending || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved Today</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.approvedToday || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rejected Today</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.rejectedToday || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Escalations</CardDescription>
              <CardTitle className="text-2xl">{stats.avgEscalations?.toFixed(1) || '0'}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Pending Approvals */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !pending?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground">All caught up! No pending approvals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((approval: ApprovalRequest) => (
            <Card key={approval.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Comparison #{approval.comparisonId.slice(0, 8)}</span>
                      {approval.severity && (
                        <Badge variant={severityColor(approval.severity) as any}>
                          {approval.severity}
                        </Badge>
                      )}
                      {approval.escalations > 0 && (
                        <Badge variant="outline">Escalated x{approval.escalations}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {approval.changeType || 'Visual change'} &middot;{' '}
                      {new Date(approval.createdAt).toLocaleString()}
                      {approval.dueAt && (
                        <span className="ml-2">
                          <Clock className="h-3 w-3 inline" /> Due {new Date(approval.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/visual/${approval.comparisonId}`}>
                    <Button variant="outline" size="sm">
                      View <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(approval.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => rejectMutation.mutate(approval.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Delegation Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Delegation Rules</CardTitle>
          <CardDescription>
            Configure how visual changes are routed for approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RulesSection projectId={project.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function RulesSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: rules, isLoading } = useQuery({
    queryKey: ['approval-rules', projectId],
    queryFn: () => approvalsApi.rules(projectId),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => approvalsApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
      toast.success('Rule deleted');
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading rules...</div>;

  if (!rules?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No delegation rules configured. Approvals will stay in the pending queue until manually reviewed.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule: any) => (
        <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="text-sm font-medium">{rule.name}</p>
            <p className="text-xs text-muted-foreground">
              Priority {rule.priority} &middot; Route to {rule.routeType}: {rule.routeTo}
              {rule.autoApprove && ' (auto-approve)'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-400"
            onClick={() => deleteRuleMutation.mutate(rule.id)}
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
