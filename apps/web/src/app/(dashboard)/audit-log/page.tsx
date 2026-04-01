'use client';

import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, User, Clock } from 'lucide-react';

export default function AuditLogPage() {
  const { project } = useCurrentProject();
  const orgId = project?.orgId;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', orgId],
    queryFn: () => organizationsApi.auditLog(orgId!, { limit: '100' }),
    enabled: !!orgId,
  });

  const logs = data?.data || data || [];

  if (!orgId) return <div className="p-6 text-muted-foreground">Select a project to view audit logs.</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Track all actions performed in your organization.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !logs.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ScrollText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No audit log entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <Card key={log.id} className="hover:bg-accent/5 transition-colors">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {log.user?.name || log.user?.email || 'System'}
                      </span>
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {log.resource} {log.resourceId ? `#${log.resourceId.slice(0, 8)}` : ''}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details).slice(0, 100)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
