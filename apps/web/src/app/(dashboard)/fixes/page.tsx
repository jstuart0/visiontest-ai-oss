'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Wrench,
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  GitMerge,
  Loader2,
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

interface BugCandidate {
  id: string;
  title: string;
  plainLanguageSummary: string | null;
  failureType: string;
  severity: string;
  confidenceScore: number;
  riskScore: number;
  status: string;
  classification: string;
  branch: string | null;
  createdByMode: string;
  createdAt: string;
  updatedAt: string;
  fixSessions?: { id: string; status: string; mode: string; confidenceScore: number | null }[];
  _count?: { fixSessions: number; analyses: number };
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  TRIAGING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  INVESTIGATING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  AWAITING_APPROVAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  APPLYING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  VERIFYING: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  READY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MERGED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  DISMISSED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const statusIcons: Record<string, typeof Clock> = {
  NEW: Clock,
  TRIAGING: Search,
  INVESTIGATING: Eye,
  AWAITING_APPROVAL: AlertTriangle,
  APPLYING: Loader2,
  VERIFYING: Loader2,
  READY: CheckCircle2,
  MERGED: GitMerge,
  DISMISSED: XCircle,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function FixesInboxPage() {
  const { project: currentProject } = useCurrentProject();
  const [candidates, setCandidates] = useState<BugCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadCandidates();
    loadStats();
  }, [currentProject?.id, statusFilter]);

  async function loadCandidates() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentProject?.id) params.projectId = currentProject.id;
      if (statusFilter !== 'all') params.status = statusFilter;

      const data = await api.get<{ data: BugCandidate[] }>('/fixes/candidates', params);
      setCandidates((data as any) || []);
    } catch (error) {
      console.error('Failed to load bug candidates:', error);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const params: Record<string, string> = {};
      if (currentProject?.id) params.projectId = currentProject.id;
      const data = await api.get('/fixes/stats', params);
      setStats(data);
    } catch (error) {
      console.error('Failed to load fix stats:', error);
    }
  }

  const filtered = candidates.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fixes</h1>
          <p className="text-muted-foreground">
            Bug candidates, investigations, and automated fixes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Open Candidates</div>
            <div className="text-2xl font-bold">{stats.openCandidates}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">High-Confidence Ready</div>
            <div className="text-2xl font-bold text-green-600">{stats.highConfidenceReady}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Auto-Fix Success Rate</div>
            <div className="text-2xl font-bold">{stats.autoFixSuccessRate}%</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Recent Fixes (7d)</div>
            <div className="text-2xl font-bold">{stats.recentFixes}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bug candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="INVESTIGATING">Investigating</SelectItem>
            <SelectItem value="AWAITING_APPROVAL">Awaiting Approval</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="MERGED">Merged</SelectItem>
            <SelectItem value="DISMISSED">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Candidate List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No bug candidates</h3>
          <p className="text-muted-foreground mt-1">
            Bug candidates will appear here when test failures are detected and classified.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((candidate) => {
            const StatusIcon = statusIcons[candidate.status] || Clock;
            const latestSession = candidate.fixSessions?.[0];

            return (
              <Link
                key={candidate.id}
                href={`/fixes/${candidate.id}`}
                className="block rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className="h-4 w-4 flex-shrink-0" />
                      <h3 className="font-medium truncate">{candidate.title}</h3>
                    </div>
                    {candidate.plainLanguageSummary && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {candidate.plainLanguageSummary}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={statusColors[candidate.status]}>
                        {candidate.status.replace(/_/g, ' ')}
                      </Badge>
                      <Badge variant="outline" className={severityColors[candidate.severity]}>
                        {candidate.severity}
                      </Badge>
                      <Badge variant="outline">
                        {candidate.failureType.replace(/_/g, ' ')}
                      </Badge>
                      {candidate.classification !== 'UNCLASSIFIED' && (
                        <Badge variant="outline">
                          {candidate.classification.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {candidate.branch && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {candidate.branch}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground flex-shrink-0">
                    <span>{formatDate(candidate.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      <span>Confidence: {Math.round(candidate.confidenceScore * 100)}%</span>
                    </div>
                    {latestSession && (
                      <Badge variant="outline" className="text-xs">
                        {latestSession.mode.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
