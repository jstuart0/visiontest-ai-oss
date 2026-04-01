'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Globe,
  Code,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Assertion {
  type: string;
  operator: string;
  target: string;
  expectedValue: string;
  description: string;
}

export default function NewApiTestPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'guided' | 'developer'>('guided');

  // Test fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [protocol, setProtocol] = useState('REST');
  const [method, setMethod] = useState('GET');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [graphqlQuery, setGraphqlQuery] = useState('');
  const [graphqlVariables, setGraphqlVariables] = useState('');
  const [tags, setTags] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('30000');

  // Assertions
  const [assertions, setAssertions] = useState<Assertion[]>([
    { type: 'STATUS_CODE', operator: 'EQUALS', target: '', expectedValue: '200', description: 'Status is 200 OK' },
  ]);

  function addAssertion() {
    setAssertions([...assertions, { type: 'STATUS_CODE', operator: 'EQUALS', target: '', expectedValue: '', description: '' }]);
  }

  function removeAssertion(index: number) {
    setAssertions(assertions.filter((_, i) => i !== index));
  }

  function updateAssertion(index: number, field: string, value: string) {
    const updated = [...assertions];
    (updated[index] as any)[field] = value;
    setAssertions(updated);
  }

  async function handleSave() {
    if (!project?.id || !name || !urlTemplate) return;
    setSaving(true);
    try {
      let parsedHeaders: Record<string, string> | undefined;
      if (headersText) {
        try {
          parsedHeaders = JSON.parse(headersText);
        } catch {
          parsedHeaders = headersText.split('\n').reduce((acc, line) => {
            const [key, ...vals] = line.split(':');
            if (key?.trim()) acc[key.trim()] = vals.join(':').trim();
            return acc;
          }, {} as Record<string, string>);
        }
      }

      let parsedGqlVars: Record<string, unknown> | undefined;
      if (graphqlVariables) {
        try { parsedGqlVars = JSON.parse(graphqlVariables); } catch { /* ignore */ }
      }

      const data = await api.post<any>('/api-tests', {
        projectId: project.id,
        name,
        description: description || undefined,
        protocol,
        method: protocol === 'GRAPHQL' ? 'POST' : method,
        urlTemplate,
        headersTemplate: parsedHeaders,
        bodyTemplate: protocol === 'REST' ? (bodyTemplate || undefined) : undefined,
        graphqlQuery: protocol === 'GRAPHQL' ? graphqlQuery : undefined,
        graphqlVariables: parsedGqlVars,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        timeoutMs: parseInt(timeoutMs),
        assertions: assertions.filter(a => a.type).map(a => ({
          type: a.type,
          operator: a.operator || 'EQUALS',
          target: a.target || undefined,
          expectedValue: a.expectedValue || undefined,
          description: a.description || undefined,
        })),
      });

      router.push(`/api-tests/${data.id}`);
    } catch (error) {
      console.error('Failed to create API test:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/api-tests')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New API Test</h1>
          <p className="text-sm text-muted-foreground">Define a REST or GraphQL test</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <Button variant={mode === 'guided' ? 'default' : 'outline'} size="sm" onClick={() => setMode('guided')}>
          <Wand2 className="h-3 w-3 mr-1" /> Guided
        </Button>
        <Button variant={mode === 'developer' ? 'default' : 'outline'} size="sm" onClick={() => setMode('developer')}>
          <Code className="h-3 w-3 mr-1" /> Developer
        </Button>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Test Definition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Get users list" />
            </div>
            <div>
              <Label>Protocol</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REST">REST</SelectItem>
                  <SelectItem value="GRAPHQL">GraphQL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'guided' && (
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this test verify?" />
            </div>
          )}

          <div className="flex items-center gap-3">
            {protocol === 'REST' && (
              <div className="w-28">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex-1">
              <Input value={urlTemplate} onChange={(e) => setUrlTemplate(e.target.value)} placeholder="https://api.example.com/users or /users (with env base URL)" className="font-mono text-sm" />
            </div>
          </div>

          {mode === 'developer' && (
            <>
              <div>
                <Label>Headers (JSON or key:value per line)</Label>
                <Textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)} className="font-mono text-sm min-h-[80px]" placeholder={'{"Content-Type": "application/json"}'} />
              </div>

              {protocol === 'REST' && (
                <div>
                  <Label>Request Body</Label>
                  <Textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} className="font-mono text-sm min-h-[100px]" placeholder='{"name": "{{userName}}", "email": "{{userEmail}}"}' />
                </div>
              )}

              {protocol === 'GRAPHQL' && (
                <>
                  <div>
                    <Label>GraphQL Query</Label>
                    <Textarea value={graphqlQuery} onChange={(e) => setGraphqlQuery(e.target.value)} className="font-mono text-sm min-h-[120px]" placeholder={'query GetUsers($limit: Int) {\n  users(limit: $limit) {\n    id\n    name\n    email\n  }\n}'} />
                  </div>
                  <div>
                    <Label>GraphQL Variables (JSON)</Label>
                    <Textarea value={graphqlVariables} onChange={(e) => setGraphqlVariables(e.target.value)} className="font-mono text-sm min-h-[60px]" placeholder='{"limit": 10}' />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="auth, users, smoke" />
                </div>
                <div>
                  <Label>Timeout (ms)</Label>
                  <Input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Assertions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Assertions</CardTitle>
            <Button variant="outline" size="sm" onClick={addAssertion}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Define what the response should look like</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assertions.map((assertion, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg border">
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={assertion.type} onValueChange={(v) => updateAssertion(i, 'type', v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STATUS_CODE">Status Code</SelectItem>
                    <SelectItem value="HEADER">Header</SelectItem>
                    <SelectItem value="JSON_PATH">JSON Path</SelectItem>
                    <SelectItem value="BODY_CONTAINS">Body Contains</SelectItem>
                    <SelectItem value="BODY_REGEX">Body Regex</SelectItem>
                    <SelectItem value="LATENCY">Latency</SelectItem>
                    <SelectItem value="SCHEMA">Schema</SelectItem>
                    <SelectItem value="GRAPHQL_ERROR_ABSENT">No GQL Errors</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={assertion.operator} onValueChange={(v) => updateAssertion(i, 'operator', v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EQUALS">Equals</SelectItem>
                    <SelectItem value="NOT_EQUALS">Not Equals</SelectItem>
                    <SelectItem value="CONTAINS">Contains</SelectItem>
                    <SelectItem value="GREATER_THAN">Greater Than</SelectItem>
                    <SelectItem value="LESS_THAN">Less Than</SelectItem>
                    <SelectItem value="MATCHES_REGEX">Matches Regex</SelectItem>
                    <SelectItem value="EXISTS">Exists</SelectItem>
                    <SelectItem value="SCHEMA_VALID">Schema Valid</SelectItem>
                  </SelectContent>
                </Select>
                {['HEADER', 'JSON_PATH'].includes(assertion.type) && (
                  <Input className="text-xs" value={assertion.target} onChange={(e) => updateAssertion(i, 'target', e.target.value)} placeholder={assertion.type === 'HEADER' ? 'content-type' : '$.data.id'} />
                )}
                <Input className="text-xs" value={assertion.expectedValue} onChange={(e) => updateAssertion(i, 'expectedValue', e.target.value)} placeholder={assertion.type === 'STATUS_CODE' ? '200' : assertion.type === 'LATENCY' ? '5000' : 'expected'} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAssertion(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !name || !urlTemplate}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
          Create API Test
        </Button>
        <Button variant="outline" onClick={() => router.push('/api-tests')}>Cancel</Button>
      </div>
    </div>
  );
}
