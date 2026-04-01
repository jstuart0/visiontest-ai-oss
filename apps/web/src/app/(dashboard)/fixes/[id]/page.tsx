'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  GitMerge,
  FileCode,
  Eye,
  MessageSquare,
  Play,
  Loader2,
  Shield,
  Target,
  Zap,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FixSession {
  id: string;
  bugCandidateId: string;
  mode: string;
  strategy: string | null;
  agentModel: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  plainLanguageSummary: string | null;
  technicalSummary: string | null;
  confidenceScore: number | null;
  riskScore: number | null;
  patchDiff: string | null;
  patchFiles: any[] | null;
  branchName: string | null;
  prUrl: string | null;
  verificationOutcome: string | null;
  rootCauseHypothesis: string | null;
  impactedFiles: any[] | null;
  eventLog: any[] | null;
  artifacts: any[];
  verificationRuns: any[];
  analyses: any[];
  feedback: any[];
}

interface BugCandidateDetail {
  id: string;
  projectId: string;
  title: string;
  plainLanguageSummary: string | null;
  failureType: string;
  severity: string;
  confidenceScore: number;
  riskScore: number;
  status: string;
  classification: string;
  branch: string | null;
  commitSha: string | null;
  evidence: Record<string, unknown> | null;
  suggestedActions: any[] | null;
  createdByMode: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; orgId: string };
  repoConnection: { id: string; provider: string; repoUrl: string } | null;
  fixSessions: FixSession[];
  analyses: any[];
  feedback: any[];
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  TRIAGING: 'bg-yellow-100 text-yellow-800',
  INVESTIGATING: 'bg-purple-100 text-purple-800',
  AWAITING_APPROVAL: 'bg-orange-100 text-orange-800',
  APPLYING: 'bg-indigo-100 text-indigo-800',
  VERIFYING: 'bg-cyan-100 text-cyan-800',
  READY: 'bg-green-100 text-green-800',
  MERGED: 'bg-emerald-100 text-emerald-800',
  DISMISSED: 'bg-gray-100 text-gray-800',
};

const severityColors: Record<string, string> = {
  CRITICAL: 'text-red-600',
  HIGH: 'text-orange-600',
  MEDIUM: 'text-yellow-600',
  LOW: 'text-blue-600',
};

export default function FixDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [candidate, setCandidate] = useState<BugCandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackType, setFeedbackType] = useState('CORRECT_FIX');

  useEffect(() => {
    loadCandidate();
  }, [id]);

  async function loadCandidate() {
    setLoading(true);
    try {
      const data = await api.get<BugCandidateDetail>(`/fixes/candidates/${id}`);
      setCandidate(data);
    } catch (error) {
      console.error('Failed to load bug candidate:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvestigate() {
    setActionLoading('investigate');
    try {
      await api.post(`/fixes/candidates/${id}/investigate`);
      await loadCandidate();
    } catch (error) {
      console.error('Failed to start investigation:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePatch() {
    setActionLoading('patch');
    try {
      await api.post(`/fixes/candidates/${id}/patch`);
      await loadCandidate();
    } catch (error) {
      console.error('Failed to generate patch:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApply() {
    setActionLoading('apply');
    try {
      await api.post(`/fixes/candidates/${id}/apply`);
      await loadCandidate();
    } catch (error) {
      console.error('Failed to apply fix:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOpenPR() {
    setActionLoading('pr');
    try {
      await api.post(`/fixes/candidates/${id}/pr`);
      await loadCandidate();
    } catch (error) {
      console.error('Failed to open PR:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDismiss() {
    setActionLoading('dismiss');
    try {
      await api.patch(`/fixes/candidates/${id}`, { status: 'DISMISSED' });
      await loadCandidate();
    } catch (error) {
      console.error('Failed to dismiss:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubmitFeedback(sessionId: string) {
    try {
      await api.post(`/fixes/sessions/${sessionId}/feedback`, {
        feedbackType,
        comment: feedbackComment || undefined,
      });
      setFeedbackComment('');
      await loadCandidate();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-24">
        <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Bug candidate not found</h3>
      </div>
    );
  }

  const latestSession = candidate.fixSessions[0];

  return (
    <div className="space-y-6">
      {/* Back and Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/fixes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{candidate.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={statusColors[candidate.status]}>
              {candidate.status.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className={severityColors[candidate.severity]}>
              {candidate.severity}
            </Badge>
            <Badge variant="outline">{candidate.failureType}</Badge>
            {candidate.classification !== 'UNCLASSIFIED' && (
              <Badge variant="outline">{candidate.classification.replace(/_/g, ' ')}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {candidate.plainLanguageSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{candidate.plainLanguageSummary}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                Confidence: {Math.round(candidate.confidenceScore * 100)}%
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Risk: {Math.round(candidate.riskScore * 100)}%
              </span>
              {candidate.branch && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-4 w-4" />
                  {candidate.branch}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {candidate.status === 'NEW' && (
          <>
            <Button onClick={handleInvestigate} disabled={!!actionLoading}>
              {actionLoading === 'investigate' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Investigate
            </Button>
            <Button variant="outline" onClick={handlePatch} disabled={!!actionLoading}>
              {actionLoading === 'patch' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Investigate & Fix
            </Button>
          </>
        )}
        {(candidate.status === 'READY' || candidate.status === 'AWAITING_APPROVAL') && (
          <>
            <Button onClick={handleApply} disabled={!!actionLoading}>
              {actionLoading === 'apply' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
              Apply to Branch
            </Button>
            <Button variant="outline" onClick={handleOpenPR} disabled={!!actionLoading}>
              {actionLoading === 'pr' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
              Open Pull Request
            </Button>
          </>
        )}
        {candidate.status !== 'DISMISSED' && candidate.status !== 'MERGED' && (
          <Button variant="ghost" onClick={handleDismiss} disabled={!!actionLoading}>
            {actionLoading === 'dismiss' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Dismiss
          </Button>
        )}
      </div>

      {/* Suggested Actions */}
      {candidate.suggestedActions && candidate.suggestedActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suggested Actions</CardTitle>
            <CardDescription>Recommended next steps based on the analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {candidate.suggestedActions.map((action: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{action.title}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {action.actionFamily}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {action.deliveryClass}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Confidence: {Math.round(action.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed view */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            Fix Sessions ({candidate.fixSessions.length})
          </TabsTrigger>
          <TabsTrigger value="analyses">
            Analyses ({candidate.analyses.length})
          </TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="feedback">
            Feedback ({candidate.feedback.length})
          </TabsTrigger>
        </TabsList>

        {/* Fix Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          {candidate.fixSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No fix sessions yet. Start an investigation to begin.</p>
          ) : (
            candidate.fixSessions.map((session) => (
              <Card key={session.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {session.mode.replace(/_/g, ' ')} Session
                    </CardTitle>
                    <Badge className={statusColors[session.status] || 'bg-gray-100'}>
                      {session.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {session.plainLanguageSummary && (
                    <CardDescription>{session.plainLanguageSummary}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Session Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {session.confidenceScore !== null && (
                      <div>
                        <span className="text-muted-foreground">Confidence</span>
                        <div className="font-medium">{Math.round(session.confidenceScore * 100)}%</div>
                      </div>
                    )}
                    {session.riskScore !== null && (
                      <div>
                        <span className="text-muted-foreground">Risk</span>
                        <div className="font-medium">{Math.round(session.riskScore * 100)}%</div>
                      </div>
                    )}
                    {session.verificationOutcome && (
                      <div>
                        <span className="text-muted-foreground">Verification</span>
                        <div className="font-medium capitalize">{session.verificationOutcome}</div>
                      </div>
                    )}
                    {session.branchName && (
                      <div>
                        <span className="text-muted-foreground">Branch</span>
                        <div className="font-mono text-xs">{session.branchName}</div>
                      </div>
                    )}
                  </div>

                  {/* Root Cause */}
                  {session.rootCauseHypothesis && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Root Cause Hypothesis</h4>
                      <p className="text-sm text-muted-foreground">{session.rootCauseHypothesis}</p>
                    </div>
                  )}

                  {/* Technical Summary */}
                  {session.technicalSummary && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Technical Details</h4>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {session.technicalSummary}
                      </pre>
                    </div>
                  )}

                  {/* Patch Diff */}
                  {session.patchDiff && (
                    <div>
                      <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        Proposed Patch
                      </h4>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                        {session.patchDiff}
                      </pre>
                    </div>
                  )}

                  {/* Impacted Files */}
                  {session.impactedFiles && session.impactedFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Impacted Files</h4>
                      <ul className="space-y-1">
                        {session.impactedFiles.map((file: any, i: number) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <FileCode className="h-3 w-3" />
                            <span className="font-mono text-xs">{file.path}</span>
                            <span className="text-muted-foreground text-xs">
                              ({Math.round(file.confidence * 100)}%)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Verification Runs */}
                  {session.verificationRuns.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Verification</h4>
                      {session.verificationRuns.map((run: any) => (
                        <div key={run.id} className="flex items-center gap-3 text-sm">
                          {run.status === 'PASSED' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : run.status === 'FAILED' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-600" />
                          )}
                          <span>
                            {run.passedSteps}/{run.totalSteps} steps passed
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {run.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PR Link */}
                  {session.prUrl && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      <a
                        href={session.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Pull Request
                      </a>
                    </div>
                  )}

                  {/* Feedback for this session */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Feedback
                    </h4>
                    <div className="flex items-start gap-2">
                      <Select value={feedbackType} onValueChange={setFeedbackType}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CORRECT_FIX">Correct Fix</SelectItem>
                          <SelectItem value="PARTIAL_FIX">Partial Fix</SelectItem>
                          <SelectItem value="WRONG_ROOT_CAUSE">Wrong Root Cause</SelectItem>
                          <SelectItem value="TOO_RISKY">Too Risky</SelectItem>
                          <SelectItem value="TOO_BROAD">Too Broad</SelectItem>
                          <SelectItem value="SHOULD_BE_BASELINE_CHANGE">Should Be Baseline Change</SelectItem>
                          <SelectItem value="SHOULD_BE_TEST_ISSUE">Should Be Test Issue</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Optional comment..."
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSubmitFeedback(session.id)}
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Analyses Tab */}
        <TabsContent value="analyses" className="space-y-4">
          {candidate.analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No analyses yet.</p>
          ) : (
            candidate.analyses.map((analysis: any) => (
              <Card key={analysis.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {analysis.analysisType.replace(/_/g, ' ')}
                    </CardTitle>
                    <Badge variant="outline">{analysis.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {analysis.summary && (
                    <p className="text-sm mb-2">{analysis.summary}</p>
                  )}
                  {analysis.content && (
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {analysis.content}
                    </pre>
                  )}
                  {analysis.confidence !== null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Confidence: {Math.round(analysis.confidence * 100)}%
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence Bundle</CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.evidence ? (
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(candidate.evidence, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No evidence gathered yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {latestSession?.eventLog && latestSession.eventLog.length > 0 ? (
                <div className="space-y-3">
                  {latestSession.eventLog.map((event: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{event.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()} - {event.phase}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feedback History</CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {candidate.feedback.map((fb: any) => (
                    <div key={fb.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      {fb.feedbackType === 'CORRECT_FIX' ? (
                        <ThumbsUp className="h-4 w-4 text-green-600 mt-0.5" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{fb.feedbackType.replace(/_/g, ' ')}</div>
                        {fb.comment && (
                          <p className="text-sm text-muted-foreground">{fb.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(fb.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
