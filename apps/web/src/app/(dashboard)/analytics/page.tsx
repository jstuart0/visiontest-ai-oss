'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Percent,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentProject } from '@/hooks/useProject';
import { analyticsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// Simple bar chart component (no external chart library dependency)
function MiniBarChart({
  data,
  maxVal,
  color = 'blue',
}: {
  data: number[];
  maxVal?: number;
  color?: string;
}) {
  const max = maxVal || Math.max(...data, 1);
  const colorClass =
    color === 'green'
      ? 'bg-green-500'
      : color === 'red'
        ? 'bg-red-500'
        : 'bg-blue-500';

  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((val, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-t', colorClass)}
          style={{ height: `${(val / max) * 100}%`, minHeight: val > 0 ? '2px' : '0' }}
        />
      ))}
    </div>
  );
}

function TrendLine({ data }: { data: Array<{ date: string; passed: number; failed: number }> }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.passed, d.failed)), 1);
  const width = 100;
  const height = 40;
  const stepX = width / Math.max(data.length - 1, 1);

  const passedPoints = data
    .map((d, i) => `${i * stepX},${height - (d.passed / maxVal) * height}`)
    .join(' ');
  const failedPoints = data
    .map((d, i) => `${i * stepX},${height - (d.failed / maxVal) * height}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      <polyline fill="none" stroke="#22c55e" strokeWidth="1.5" points={passedPoints} />
      <polyline fill="none" stroke="#ef4444" strokeWidth="1.5" points={failedPoints} />
    </svg>
  );
}

export default function AnalyticsPage() {
  const { project } = useCurrentProject();
  const [period, setPeriod] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', project?.id, period],
    queryFn: () => analyticsApi.get({ projectId: project!.id, days: period }),
    enabled: !!project?.id,
  });

  const analytics = data as any;

  const passRateTrend = useMemo(() => {
    if (!analytics?.trends) return 0;
    const trends = analytics.trends;
    const midpoint = Math.floor(trends.length / 2);
    const recent = trends.slice(midpoint);
    const older = trends.slice(0, midpoint);

    const avgRate = (arr: any[]) =>
      arr.reduce((sum: number, d: any) => sum + (d.total > 0 ? (d.passed / d.total) * 100 : 0), 0) /
      Math.max(arr.length, 1);

    return avgRate(recent) - avgRate(older);
  }, [analytics]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <BarChart3 className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Project Selected</h2>
        <p className="text-muted-foreground">Select a project to view analytics.</p>
      </div>
    );
  }

  const summary = analytics?.summary || {
    totalRuns: 0,
    passedRuns: 0,
    failedRuns: 0,
    passRate: 0,
    avgDiff: 0,
    flakyTests: 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Test performance metrics and trends</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '...' : summary.totalRuns}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">
                    {isLoading ? '...' : `${summary.passRate}%`}
                  </p>
                  {!isLoading && passRateTrend !== 0 && (
                    <span
                      className={cn(
                        'flex items-center text-xs gap-0.5',
                        passRateTrend > 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {passRateTrend > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(passRateTrend).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <Percent className="h-5 w-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flaky Tests</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '...' : summary.flakyTests}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Diff %</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '...' : `${summary.avgDiff}%`}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Test Results Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>
          ) : analytics?.trends?.length > 0 ? (
            <>
              <TrendLine data={analytics.trends} />
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  Passed
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-3 h-3 bg-red-500 rounded-full" />
                  Failed
                </span>
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground">
              No trend data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pass/Fail Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Results Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Passed
                </span>
                <span className="text-sm font-medium text-foreground">{summary.passedRuns}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${summary.totalRuns > 0 ? (summary.passedRuns / summary.totalRuns) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4 text-red-400" />
                  Failed
                </span>
                <span className="text-sm font-medium text-foreground">{summary.failedRuns}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${summary.totalRuns > 0 ? (summary.failedRuns / summary.totalRuns) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.trends?.length > 0 ? (
              <MiniBarChart data={analytics.trends.map((d: any) => d.total)} color="blue" />
            ) : (
              <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">
                No data
              </div>
            )}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>
                {analytics?.trends?.[0]?.date
                  ? new Date(analytics.trends[0].date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''}
              </span>
              <span>
                {analytics?.trends?.[analytics.trends.length - 1]?.date
                  ? new Date(
                      analytics.trends[analytics.trends.length - 1].date
                    ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Failing Tests */}
      {analytics?.topFailingTests?.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Top Failing Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topFailingTests.slice(0, 5).map((item: any, index: number) => (
                <div
                  key={item.test?.id || index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground/70">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-foreground">{item.testName || item.test?.name || 'Unknown'}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-400">
                    {item.failureCount || item.failures} failures
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.recentActivity?.length > 0 ? (
            <div className="space-y-2">
              {analytics.recentActivity.slice(0, 10).map((activity: any) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {activity.status === 'PASSED' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : activity.status === 'FAILED' ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.testName}</p>
                      {activity.projectName && (
                        <p className="text-xs text-muted-foreground">{activity.projectName}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
