'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  const { project } = useCurrentProject();
  const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary');

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', project?.id, reportType],
    queryFn: () => reportsApi.get(project!.id, { type: reportType }),
    enabled: !!project?.id,
  });

  if (!project) return <div className="p-6 text-muted-foreground">Select a project to view reports.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Test execution reports and analytics exports.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={reportType === 'summary' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReportType('summary')}
          >
            Summary
          </Button>
          <Button
            variant={reportType === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReportType('detailed')}
          >
            Detailed
          </Button>
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `visiontest-report-${reportType}-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3 w-3 mr-1" /> Export JSON
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !report ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No report data available. Run some tests first.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Executions</CardDescription>
                <CardTitle className="text-2xl">{report.totalExecutions || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pass Rate</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {((report.passRate || 0) * 100).toFixed(1)}%
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Duration</CardDescription>
                <CardTitle className="text-2xl">
                  {report.avgDuration ? `${(report.avgDuration / 1000).toFixed(1)}s` : '-'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Tests</CardDescription>
                <CardTitle className="text-2xl">{report.totalTests || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Report Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {reportType === 'summary' ? 'Summary Report' : 'Detailed Report'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(report, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
