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
  Plus,
  ArrowRight,
  Play,
  GitBranch,
  Key,
  BarChart3,
  Users,
  Bell,
  Wrench,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCurrentProject } from '@/hooks/useProject';
import { api, dashboardApi, testsApi, visualApi, type DashboardStats, type Test, type VisualComparison } from '@/lib/api';
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
    <Card className="bg-card border-border">
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
                  trend === 'up' ? 'text-green-400' : 'text-red-400'
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
  const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
    passed: { color: 'bg-green-500', icon: CheckCircle2, label: 'Passed' },
    failed: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
    flaky: { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Flaky' },
    running: { color: 'bg-blue-500', icon: Activity, label: 'Running' },
    pending: { color: 'bg-muted', icon: Clock, label: 'Pending' },
  };

  return (
    <div className="space-y-3">
      {tests.slice(0, 5).map((test) => {
        const displayStatus = (test.lastStatus || '').toLowerCase() || 'pending';
        const config = statusConfig[displayStatus] || statusConfig.pending;
        const StatusIcon = config.icon;

        return (
          <Link
            key={test.id}
            href={`/tests/${test.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-2 h-2 rounded-full', config.color)} />
              <div>
                <p className="text-sm font-medium text-foreground">{test.name}</p>
                <p className="text-xs text-muted-foreground">
                  {test.lastRun
                    ? `Last run ${new Date(test.lastRun).toLocaleDateString()}`
                    : 'Never run'}
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'gap-1',
                displayStatus === 'passed' && 'bg-green-500/10 text-green-400',
                displayStatus === 'failed' && 'bg-red-500/10 text-red-400',
                displayStatus === 'flaky' && 'bg-yellow-500/10 text-yellow-400',
                displayStatus === 'running' && 'bg-blue-500/10 text-blue-400',
                (displayStatus === 'pending' || !displayStatus) && 'bg-muted/50 text-muted-foreground'
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {config.label}
            </Badge>
          </Link>
        );
      })}
      {tests.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No tests yet</p>
          <p className="text-xs">Create your first test to get started</p>
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
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Image className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Visual comparison #{comparison.id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground">
                {comparison.diffPercentage !== undefined
                  ? `${comparison.diffPercentage.toFixed(2)}% different`
                  : 'Calculating...'}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-yellow-500/10 text-yellow-400"
          >
            Review
          </Badge>
        </div>
      ))}
      {comparisons.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>All caught up!</p>
          <p className="text-xs">No visual changes pending review</p>
        </div>
      )}
    </div>
  );
}

const quickActions = [
  { label: 'Create Test', href: '/tests/new', icon: Plus, color: 'text-blue-400' },
  { label: 'Run All Tests', href: '/executions', icon: Play, color: 'text-green-400' },
  { label: 'View Analytics', href: '/analytics', icon: BarChart3, color: 'text-purple-400' },
  { label: 'Manage Teams', href: '/teams', icon: Users, color: 'text-amber-400' },
  { label: 'Workflows', href: '/workflows', icon: GitBranch, color: 'text-cyan-400' },
  { label: 'Webhooks', href: '/webhooks', icon: Bell, color: 'text-pink-400' },
  { label: 'API Keys', href: '/api-keys', icon: Key, color: 'text-orange-400' },
];

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

  const { data: fixStats } = useQuery({
    queryKey: ['fix-stats', project?.id],
    queryFn: () => api.get<any>('/fixes/stats', { projectId: project!.id }),
    enabled: !!project?.id,
  });

  const { data: apiTestStats } = useQuery({
    queryKey: ['api-test-stats', project?.id],
    queryFn: () => api.get<any>('/api-tests/stats/summary', { projectId: project!.id }),
    enabled: !!project?.id,
  });

  const isLoading = projectLoading || statsLoading;

  // Calculate pass rate
  const passRate = stats
    ? Math.round((stats.passingTests / Math.max(stats.totalTests, 1)) * 100)
    : 0;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <FlaskConical className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">
          No Project Selected
        </h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a project from the dropdown above or create a new one to get
          started with visual regression testing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your visual regression tests
          </p>
        </div>
        <Link href="/tests/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Test
          </Button>
        </Link>
      </div>

      {/* Getting Started -- shown when no tests */}
      {!isLoading && stats && stats.totalTests === 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <FlaskConical className="h-6 w-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Get Started with VisionTest</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create your first visual regression test to start catching UI changes automatically.
                </p>
                <div className="flex gap-2">
                  <Link href="/tests/new">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-3 w-3 mr-1" /> Create First Test
                    </Button>
                  </Link>
                  <Link href="/help">
                    <Button size="sm" variant="outline">View Documentation</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Fix Stats */}
      {fixStats && (fixStats.openCandidates > 0 || fixStats.recentFixes > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/fixes">
            <Card className="bg-card border-border hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Wrench className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Open Fix Candidates</p>
                    <p className="text-xl font-bold">{fixStats.openCandidates}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/fixes?status=READY">
            <Card className="bg-card border-border hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">High-Confidence Ready</p>
                    <p className="text-xl font-bold text-green-500">{fixStats.highConfidenceReady}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Auto-Fix Success Rate</p>
                  <p className="text-xl font-bold">{fixStats.autoFixSuccessRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <GitBranch className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recent Fixes (7d)</p>
                  <p className="text-xl font-bold">{fixStats.recentFixes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Test Stats */}
      {apiTestStats && apiTestStats.totalApiTests > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/api-tests">
            <Card className="bg-card border-border hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Globe className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">API Tests</p>
                    <p className="text-xl font-bold">{apiTestStats.activeApiTests}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">API Pass Rate (7d)</p>
                  <p className="text-xl font-bold">{apiTestStats.apiPassRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Play className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">API Runs (7d)</p>
                  <p className="text-xl font-bold">{apiTestStats.recentExecutions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Globe className="h-4 w-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total API Tests</p>
                  <p className="text-xl font-bold">{apiTestStats.totalApiTests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pass Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className="text-4xl font-bold text-foreground">
                {passRate}%
              </span>
              <span className="text-sm text-green-400 pb-1">+2% this week</span>
            </div>
            <Progress value={passRate} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
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
              <span className="text-sm text-muted-foreground pb-1">
                require review
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {stats?.testsRunToday || 0} runs today
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground">
            Jump to common tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-accent transition-colors cursor-pointer">
                  <action.icon className={cn('w-5 h-5', action.color)} />
                  <span className="text-sm font-medium text-muted-foreground">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Recent Tests</CardTitle>
              <CardDescription className="text-muted-foreground">
                Latest test runs and their status
              </CardDescription>
            </div>
            <Link href="/tests">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {testsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <RecentTestsList tests={recentTests || []} />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Pending Visual Reviews</CardTitle>
              <CardDescription className="text-muted-foreground">
                Visual changes waiting for approval
              </CardDescription>
            </div>
            <Link href="/visual">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
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
