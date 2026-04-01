'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  Globe,
  Code,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  AlertTriangle,
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

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  PASSED: CheckCircle2,
  FAILED: XCircle,
  ERROR: AlertTriangle,
  RUNNING: Loader2,
  PENDING: Clock,
  TIMEOUT: Clock,
};

export default function ApiTestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => { loadTest(); }, [id]);

  async function loadTest() {
    setLoading(true);
    try {
      const data = await api.get<any>(`/api-tests/${id}`);
      setTest(data);
    } catch (error) {
      console.error('Failed to load API test:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await api.post(`/api-tests/${id}/run`);
      await loadTest();
    } catch (error) {
      console.error('Failed to run:', error);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!test) return <div className="text-center py-24"><XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3>API test not found</h3></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/api-tests')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {test.protocol === 'GRAPHQL' ? <Code className="h-5 w-5 text-purple-500" /> : <Globe className="h-5 w-5 text-blue-500" />}
            <h1 className="text-xl font-bold">{test.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={methodColors[test.method] || 'bg-gray-100'}>{test.protocol === 'GRAPHQL' ? 'GraphQL' : test.method}</Badge>
            <span className="text-sm font-mono text-muted-foreground">{test.urlTemplate}</span>
            {test.tags.map((tag: string) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
          </div>
        </div>
        <Button onClick={handleRun} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Run Test
        </Button>
      </div>

      {test.description && <p className="text-sm text-muted-foreground">{test.description}</p>}

      <Tabs defaultValue="assertions">
        <TabsList>
          <TabsTrigger value="assertions">Assertions ({test.assertions?.length || 0})</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="executions">Execution History ({test.executions?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="assertions" className="space-y-3">
          {test.assertions?.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No assertions defined.</p>
          ) : (
            test.assertions?.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Badge variant="outline" className="text-xs">{a.type.replace(/_/g, ' ')}</Badge>
                <Badge variant="outline" className="text-xs">{a.operator}</Badge>
                {a.target && <span className="text-sm font-mono">{a.target}</span>}
                <span className="text-sm">{a.expectedValue || '(any)'}</span>
                <Badge variant="outline" className="text-xs ml-auto">{a.severity}</Badge>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Protocol:</span> <span className="font-medium">{test.protocol}</span></div>
                <div><span className="text-muted-foreground">Method:</span> <span className="font-medium">{test.method}</span></div>
                <div><span className="text-muted-foreground">Timeout:</span> <span className="font-medium">{test.timeoutMs}ms</span></div>
                <div><span className="text-muted-foreground">Retries:</span> <span className="font-medium">{test.retries}</span></div>
              </div>
              {test.headersTemplate && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Headers</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg">{JSON.stringify(test.headersTemplate, null, 2)}</pre>
                </div>
              )}
              {test.bodyTemplate && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Body Template</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap">{test.bodyTemplate}</pre>
                </div>
              )}
              {test.graphqlQuery && (
                <div>
                  <h4 className="text-sm font-medium mb-1">GraphQL Query</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap">{test.graphqlQuery}</pre>
                </div>
              )}
              {test.environmentBinding && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Environment</h4>
                  <p className="text-sm">{test.environmentBinding.name} - {test.environmentBinding.baseUrl}</p>
                </div>
              )}
              {test.authBinding && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Auth</h4>
                  <p className="text-sm">{test.authBinding.name} ({test.authBinding.authType})</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-3">
          {test.executions?.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No executions yet. Click "Run Test" to execute.</p>
          ) : (
            test.executions?.map((exec: any) => {
              const Icon = statusIcons[exec.status] || Clock;
              return (
                <Link key={exec.id} href={`/api-tests/executions/${exec.id}`} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <Icon className={`h-4 w-4 ${exec.status === 'PASSED' ? 'text-green-600' : exec.status === 'FAILED' ? 'text-red-600' : 'text-yellow-600'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{exec.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {exec.passedAssertions}/{exec.totalAssertions} assertions passed
                      </span>
                      {exec.durationMs !== null && <span className="text-xs text-muted-foreground">{exec.durationMs}ms</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(exec.createdAt).toLocaleString()}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
