'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Image,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/status-badge';
import { useCurrentProject } from '@/hooks/useProject';
import { dashboardApi, testsApi, visualApi, type DashboardStats, type Test, type VisualComparison } from '@/lib/api';
import { cn } from '@/lib/utils';

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
}: {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-green-500 bg-green-500/10',
    red: 'text-red-500 bg-red-500/10',
    yellow: 'text-yellow-500 bg-yellow-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {(description || trendValue) && (
          <div className="flex items-center gap-2 mt-1">
            {trendValue && (
              <span
                className={cn(
                  'text-xs font-medium flex items-center gap-0.5',
                  trend === 'up' ? 'text-green-500' : 'text-red-500'
                )}
              >
                {trend === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trendValue}
              </span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTestsList({ tests }: { tests: Test[] }) {
  return (
    <div className="space-y-3">
      {tests.slice(0, 5).map((test) => {
        const displayStatus = (test.lastStatus || '').toLowerCase() || 'pending';
        return (
          <div
            key={test.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  displayStatus === 'passed' && 'bg-green-500',
                  displayStatus === 'failed' && 'bg-red-500',
                  displayStatus === 'flaky' && 'bg-yellow-500',
                  displayStatus === 'running' && 'bg-blue-500',
                  (displayStatus === 'pending' || !displayStatus) && 'bg-muted-foreground'
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{test.name}</p>
                <p className="text-xs text-muted-foreground">
                  {test.lastRun
                    ? `Last run ${new Date(test.lastRun).toLocaleDateString()}`
                    : 'Never run'}
                </p>
              </div>
            </div>
            <StatusBadge status={displayStatus} size="xs" />
          </div>
        );
      })}
      {tests.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No tests yet</p>
          <p className="text-xs mt-1">Create your first test to get started</p>
        </div>
      )}
    </div>
  );
}

function PendingVisualsList({ comparisons }: { comparisons: VisualComparison[] }) {
  return (
    <div className="space-y-3">
      {comparisons.slice(0, 5).map((comparison) => (
        <div
          key={comparison.id}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Image className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Comparison #{comparison.id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground">
                {comparison.diffPercentage !== undefined
                  ? `${comparison.diffPercentage.toFixed(2)}% different`
                  : 'Calculating...'}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
            Review
          </Badge>
        </div>
      ))}
      {comparisons.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>All caught up!</p>
          <p className="text-xs mt-1">No visual changes pending review</p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { project, isLoading: projectLoading } = useCurrentProject();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats', project?.id],
    queryFn: () => dashboardApi.stats(project!.id),
    enabled: !!project?.id,
  });

  const { data: recentTests, isLoading: testsLoading } = useQuery({
    queryKey: ['tests', project?.id, 'recent'],
    queryFn: () => testsApi.list(project!.id),
    enabled: !!project?.id,
  });

  const { data: pendingVisuals, isLoading: visualsLoading } = useQuery({
    queryKey: ['visual', project?.id, 'pending'],
    queryFn: () => visualApi.list(project!.id, { status: 'pending' }),
    enabled: !!project?.id,
  });

  const isLoading = projectLoading || statsLoading;
  const passRate = stats
    ? Math.round((stats.passingTests / Math.max(stats.totalTests, 1)) * 100)
    : 0;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
          <FlaskConical className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Project Selected</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Select a project from the dropdown above or create a new one to get started with visual regression testing.
        </p>
        <Button asChild>
          <Link href="/tests/new">
            Get Started <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your visual regression tests</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard
          title="Total Tests"
          value={isLoading ? '...' : stats?.totalTests || 0}
          description="across all suites"
          icon={FlaskConical}
          color="blue"
        />
        <StatCard
          title="Passing"
          value={isLoading ? '...' : stats?.passingTests || 0}
          description={`${passRate}% pass rate`}
          icon={CheckCircle2}
          color="green"
          trend="up"
          trendValue="+5%"
        />
        <StatCard
          title="Failing"
          value={isLoading ? '...' : stats?.failingTests || 0}
          description="need attention"
          icon={XCircle}
          color="red"
        />
        <StatCard
          title="Flaky"
          value={isLoading ? '...' : stats?.flakyTests || 0}
          description="quarantined"
          icon={AlertTriangle}
          color="yellow"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pass Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className="text-4xl font-bold text-foreground">{passRate}%</span>
              <span className="text-sm text-green-500 pb-1">+2% this week</span>
            </div>
            <Progress value={passRate} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visual Changes Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className="text-4xl font-bold text-foreground">
                {isLoading ? '...' : stats?.pendingVisuals || 0}
              </span>
              <span className="text-sm text-muted-foreground pb-1">require review</span>
            </div>
            <div className="flex gap-2 mt-4">
              <Badge variant="secondary">
                {stats?.testsRunToday || 0} runs today
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tests</CardTitle>
            <CardDescription>Latest test runs and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {testsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <RecentTestsList tests={recentTests || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Visual Reviews</CardTitle>
            <CardDescription>Visual changes waiting for approval</CardDescription>
          </CardHeader>
          <CardContent>
            {visualsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <PendingVisualsList comparisons={pendingVisuals || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
