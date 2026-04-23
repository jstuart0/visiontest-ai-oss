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

  // Instrument panel — one headline number (Pass rate) typeset as huge,
  // the rest as mono readouts like laboratory dials. The period selector
  // sits quietly under the headline, not as a top-right tool button.
  const trend = passRateTrend;
  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-8 border-b mb-12" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-6">§ Instruments · {period}-day window</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-end">
          <div>
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 0.97 }}
            >
              Readings — <em>{isLoading ? '…' : summary.passRate}%</em> passing.
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{
                fontVariationSettings: '"opsz" 24',
                fontSize: '17px',
                color: 'var(--ink-1)',
                maxWidth: '58ch',
              }}
            >
              Pass rate, trend, flicker, diff, runtime — the numbers that
              tell you if the machine is quieter than yesterday.
            </p>
            <div className="mt-4 flex gap-2">
              {(['7', '14', '30', '90'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className="vt-mono text-[10.5px] tracking-[0.14em] uppercase px-3 h-8 border transition-colors"
                  style={{
                    borderColor: period === p ? 'var(--accent)' : 'var(--rule)',
                    color: period === p ? 'var(--accent)' : 'var(--ink-2)',
                    background: period === p ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>

          {/* Single huge hero number — the pass-rate dial */}
          <div className="text-right">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 144',
                fontWeight: 300,
                fontSize: 'clamp(96px, 12vw, 176px)',
                lineHeight: 0.85,
                letterSpacing: '-0.045em',
                color: 'var(--ink-0)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isLoading ? '——' : summary.passRate}
              <span style={{ color: 'var(--ink-2)', fontSize: '50%' }}>%</span>
            </div>
            {!isLoading && trend !== 0 && (
              <div
                className="vt-mono text-[12px] tracking-[0.08em] mt-2 flex items-center justify-end gap-2"
                style={{ color: trend > 0 ? 'var(--pass)' : 'var(--fail)' }}
              >
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%{' '}
                <span style={{ color: 'var(--ink-2)' }}>vs. prior window</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Secondary instrument readouts — mono dials, not equal-weight cards */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 mb-14 border-b pb-8"
        style={{ borderColor: 'var(--rule)' }}
      >
        <Dial label="Total runs" value={isLoading ? '…' : summary.totalRuns.toString()} />
        <Dial
          label="Flaky tests"
          value={isLoading ? '…' : summary.flakyTests.toString()}
          tone={summary.flakyTests > 0 ? 'warn' : undefined}
        />
        <Dial
          label="Avg diff"
          value={isLoading ? '…' : `${summary.avgDiff}%`}
          tone={summary.avgDiff > 5 ? 'fail' : undefined}
        />
        <Dial label="Window" value={`${period}d`} />
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

function Dial({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'fail' }) {
  const color = tone === 'warn' ? 'var(--warn)' : tone === 'fail' ? 'var(--fail)' : 'var(--ink-0)';
  return (
    <div className="px-8 first:pl-0 border-l first:border-l-0" style={{ borderColor: 'var(--rule)' }}>
      <div className="vt-kicker" style={{ color: 'var(--ink-2)' }}>
        {label}
      </div>
      <div
        className="mt-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontVariationSettings: '"opsz" 72',
          fontWeight: 340,
          fontSize: 'clamp(28px, 3vw, 44px)',
          letterSpacing: '-0.025em',
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
