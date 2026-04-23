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

  // Case files — each open candidate is a folder of evidence on a desk.
  // Header treats the count as the focal "open case" number; stats move
  // to a monospace meta-strip beneath, like a summary cover sheet.
  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-6" style={{ color: 'var(--fail)' }}>
          § Casefiles · Open investigations
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-end">
          <div>
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 0.97 }}
            >
              Every failure is a <em>case.</em>
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{
                fontVariationSettings: '"opsz" 24',
                fontSize: '17px',
                color: 'var(--ink-1)',
                maxWidth: '60ch',
              }}
            >
              A classifier reads each failure, opens a candidate file, and
              hands it to an investigator. You review, approve, or dismiss
              — the machine does the typing.
            </p>
          </div>
          <div className="text-right">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 144',
                fontWeight: 300,
                fontSize: 'clamp(64px, 8vw, 112px)',
                lineHeight: 0.88,
                letterSpacing: '-0.04em',
                color: (stats?.openCandidates || 0) > 0 ? 'var(--fail)' : 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {stats?.openCandidates ?? 0}
            </div>
            <div
              className="mt-2 vt-kicker"
              style={{ color: (stats?.openCandidates || 0) > 0 ? 'var(--fail)' : 'var(--ink-2)' }}
            >
              open case{(stats?.openCandidates ?? 0) === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {/* Cover sheet — secondary stats as mono meta, not as peers */}
        {stats && (
          <div
            className="mt-8 grid grid-cols-3 gap-10 vt-mono text-[11.5px] tracking-[0.1em]"
            style={{ color: 'var(--ink-2)' }}
          >
            <div>
              <span style={{ color: 'var(--ink-1)' }}>ready — </span>
              <span style={{ color: 'var(--pass)', fontWeight: 500 }}>{stats.highConfidenceReady}</span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-1)' }}>auto-fix rate — </span>
              <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>{stats.autoFixSuccessRate}%</span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-1)' }}>closed (7d) — </span>
              <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>{stats.recentFixes}</span>
            </div>
          </div>
        )}
      </header>

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
