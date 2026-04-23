'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Globe,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Zap,
  Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApiTestItem {
  id: string;
  name: string;
  description: string | null;
  protocol: string;
  method: string;
  urlTemplate: string;
  status: string;
  tags: string[];
  _count?: { assertions: number; executions: number };
  lastExecution?: {
    id: string;
    status: string;
    durationMs: number | null;
    passedAssertions: number;
    failedAssertions: number;
    createdAt: string;
  } | null;
}

const execStatusColors: Record<string, string> = {
  PASSED: 'text-green-600',
  FAILED: 'text-red-600',
  ERROR: 'text-red-600',
  RUNNING: 'text-blue-600',
  PENDING: 'text-yellow-600',
  TIMEOUT: 'text-orange-600',
};

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function ApiTestsPage() {
  const { project } = useCurrentProject();
  const [tests, setTests] = useState<ApiTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (project?.id) {
      loadTests();
      loadStats();
    }
  }, [project?.id, protocolFilter]);

  async function loadTests() {
    setLoading(true);
    try {
      const params: Record<string, string> = { projectId: project!.id };
      if (protocolFilter !== 'all') params.protocol = protocolFilter;
      const data = await api.get<any>('/api-tests', params);
      setTests(data || []);
    } catch (error) {
      console.error('Failed to load API tests:', error);
      setTests([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api.get('/api-tests/stats/summary', { projectId: project!.id });
      setStats(data);
    } catch (error) {
      console.error('Failed to load API test stats:', error);
    }
  }

  async function handleRun(testId: string) {
    try {
      const result = await api.post<any>(`/api-tests/${testId}/run`);
      await loadTests();
    } catch (error) {
      console.error('Failed to run API test:', error);
    }
  }

  const filtered = tests.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.urlTemplate.toLowerCase().includes(search.toLowerCase()));

  // Contract room — API tests are what the contract should return.
  // Kept quiet and mono-adjacent since it's technical surface.
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Contracts · API tests</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 0.98 }}>
            Does it <em>still</em> return what you asked for?
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '62ch' }}>
            REST and GraphQL assertions for the endpoints your tests depend on.
            Run them alongside visual tests to catch breakage above and below
            the UI.
          </p>
        </div>
        <Link href="/api-tests/new" className="vt-btn vt-btn--primary shrink-0">
          <Plus className="w-4 h-4" />
          New API test
        </Link>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total API Tests</div>
            <div className="text-2xl font-bold">{stats.totalApiTests}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold">{stats.activeApiTests}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Pass Rate (7d)</div>
            <div className="text-2xl font-bold">{stats.apiPassRate}%</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Recent Runs (7d)</div>
            <div className="text-2xl font-bold">{stats.recentExecutions}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={protocolFilter} onValueChange={setProtocolFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="REST">REST</SelectItem>
            <SelectItem value="GRAPHQL">GraphQL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Test List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No API tests</h3>
          <p className="text-muted-foreground mt-1">Create your first API test to start validating your endpoints.</p>
          <Link href="/api-tests/new">
            <Button className="mt-4"><Plus className="h-4 w-4 mr-2" />Create API Test</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((test) => (
            <div key={test.id} className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/api-tests/${test.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {test.protocol === 'GRAPHQL' ? <Code className="h-4 w-4 text-purple-500" /> : <Globe className="h-4 w-4 text-blue-500" />}
                    <h3 className="font-medium truncate">{test.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={methodColors[test.method] || 'bg-gray-100'}>
                      {test.protocol === 'GRAPHQL' ? 'GQL' : test.method}
                    </Badge>
                    <span className="text-sm text-muted-foreground font-mono truncate">{test.urlTemplate}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {test.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">{test._count?.assertions || 0} assertions</span>
                    {test.lastExecution && (
                      <span className={`text-xs font-medium ${execStatusColors[test.lastExecution.status] || ''}`}>
                        {test.lastExecution.status}
                        {test.lastExecution.durationMs !== null && ` (${test.lastExecution.durationMs}ms)`}
                      </span>
                    )}
                  </div>
                </Link>
                <Button variant="outline" size="sm" onClick={() => handleRun(test.id)}>
                  <Zap className="h-3 w-3 mr-1" /> Run
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
