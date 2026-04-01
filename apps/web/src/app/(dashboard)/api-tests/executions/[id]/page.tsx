'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowUpDown,
  Globe,
  FileCode,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ApiExecutionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [exec, setExec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadExecution(); }, [id]);

  async function loadExecution() {
    setLoading(true);
    try {
      const data = await api.get<any>(`/api-tests/executions/${id}`);
      setExec(data);
    } catch (error) {
      console.error('Failed to load execution:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!exec) return <div className="text-center py-24"><XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3>Execution not found</h3></div>;

  const isPassed = exec.status === 'PASSED';
  const isFailed = exec.status === 'FAILED' || exec.status === 'ERROR';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">API Execution</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={isPassed ? 'bg-green-100 text-green-800' : isFailed ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
              {exec.status}
            </Badge>
            {exec.apiTest && (
              <span className="text-sm text-muted-foreground">{exec.apiTest.name}</span>
            )}
            {exec.durationMs !== null && (
              <span className="text-sm text-muted-foreground">{exec.durationMs}ms</span>
            )}
          </div>
        </div>
        {isFailed && (
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-600/30"
            onClick={() => {
              api.post('/fixes/candidates', {
                projectId: exec.projectId,
                executionId: exec.id,
                sourceType: 'execution',
                title: `API test failure: ${exec.apiTest?.name || exec.id}`,
                plainLanguageSummary: exec.failureSummary || exec.errorMessage || 'API test failed',
                failureType: 'API',
                severity: 'MEDIUM',
              }).then((data: any) => {
                router.push(`/fixes/${data.id}`);
              }).catch(() => {});
            }}
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> Investigate
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Status Code</div>
            <div className="text-xl font-bold">{exec.responseStatus || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="text-xl font-bold">{exec.durationMs ? `${exec.durationMs}ms` : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Latency</div>
            <div className="text-xl font-bold">{exec.latencyMs ? `${exec.latencyMs}ms` : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Body Size</div>
            <div className="text-xl font-bold">{exec.responseBodySize ? `${(exec.responseBodySize / 1024).toFixed(1)}KB` : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Assertions</div>
            <div className="text-xl font-bold">
              <span className="text-green-600">{exec.passedAssertions}</span>
              <span className="text-muted-foreground">/</span>
              <span className={exec.failedAssertions > 0 ? 'text-red-600' : ''}>{exec.totalAssertions}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {exec.failureSummary && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800 dark:text-red-400">Failure Summary</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{exec.failureSummary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="assertions">
        <TabsList>
          <TabsTrigger value="assertions">Assertions ({exec.totalAssertions})</TabsTrigger>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts ({exec.artifacts?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="assertions" className="space-y-2">
          {exec.assertionResults && exec.assertionResults.length > 0 ? (
            exec.assertionResults.map((result: any, i: number) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${result.passed ? 'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10' : 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10'}`}>
                {result.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{result.type}</Badge>
                    <span className="text-sm">{result.message}</span>
                  </div>
                  {!result.passed && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Expected: {result.expected} | Actual: {result.actual}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4">No assertion results.</p>
          )}
        </TabsContent>

        <TabsContent value="request">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{exec.requestMethod}</Badge>
                <span className="text-sm font-mono">{exec.requestUrl}</span>
              </div>
              {exec.requestHeaders && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Headers</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{JSON.stringify(exec.requestHeaders, null, 2)}</pre>
                </div>
              )}
              {exec.requestBody && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Body</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{exec.requestBody}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={exec.responseStatus >= 200 && exec.responseStatus < 300 ? 'text-green-600' : exec.responseStatus >= 400 ? 'text-red-600' : ''}>
                  {exec.responseStatus || 'N/A'}
                </Badge>
                {exec.responseBodySize && (
                  <span className="text-xs text-muted-foreground">{(exec.responseBodySize / 1024).toFixed(1)} KB</span>
                )}
              </div>
              {exec.responseHeaders && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Headers</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{JSON.stringify(exec.responseHeaders, null, 2)}</pre>
                </div>
              )}
              {exec.responseBody && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Body</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(exec.responseBody), null, 2); } catch { return exec.responseBody; }
                    })()}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-3">
          {exec.artifacts?.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No artifacts.</p>
          ) : (
            exec.artifacts?.map((artifact: any) => (
              <Card key={artifact.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{artifact.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">{artifact.type}</Badge>
                  </div>
                </CardHeader>
                {artifact.content && (
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{artifact.content}</pre>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
