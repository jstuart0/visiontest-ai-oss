'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { BookOpen, Loader2, CheckCircle2, XCircle, Save, Plus, Trash2, Zap, Copy, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Viewport { name: string; width: number; height: number; }

export default function StorybookSettingsPage() {
  const { project } = useCurrentProject();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [viewports, setViewports] = useState<Viewport[]>([
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 375, height: 812 },
  ]);

  useEffect(() => { if (project?.id) loadConfig(); }, [project?.id]);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await api.get<any>('/storybook/config', { projectId: project!.id });
      setConfig(data);
      if (data.viewports && Array.isArray(data.viewports)) setViewports(data.viewports);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/storybook/config', { ...config, projectId: project!.id, viewports });
    } catch (error) { console.error(error); } finally { setSaving(false); }
  }

  async function testConnection() {
    if (!config?.storybookUrl) return;
    setTestingConnection(true);
    try {
      const result = await api.post<any>('/storybook/test-connection', { projectId: project!.id, storybookUrl: config.storybookUrl });
      setConnectionResult(result);
    } catch (error) { console.error(error); } finally { setTestingConnection(false); }
  }

  function addViewport() { setViewports([...viewports, { name: 'Tablet', width: 768, height: 1024 }]); }
  function removeViewport(i: number) { setViewports(viewports.filter((_, idx) => idx !== i)); }
  function updateViewport(i: number, field: string, value: string | number) {
    const updated = [...viewports];
    (updated[i] as any)[field] = value;
    setViewports(updated);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const cliSnippet = `npx visiontest storybook capture \\
  --static-dir ./storybook-static \\
  --upload --fail-on-breaking`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Storybook Integration</h1>
          <p className="text-muted-foreground">Connect your Storybook to auto-discover components and create visual regression tests</p>
        </div>
        <Link href="/settings/storybook/wizard">
          <Button variant="outline" size="sm"><Wand2 className="h-4 w-4 mr-1" /> Guided Setup</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Enable Storybook Integration</CardTitle>
            <Switch checked={config?.enabled || false} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Integration Mode</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={config?.mode || 'cli'} onValueChange={(v) => setConfig({ ...config, mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cli">CLI (recommended) - Screenshots taken in CI, uploaded to VisionTest.ai</SelectItem>
              <SelectItem value="connected">Connected - VisionTest.ai screenshots from a URL</SelectItem>
              <SelectItem value="hybrid">Hybrid - Upload static build, VisionTest.ai screenshots</SelectItem>
            </SelectContent>
          </Select>

          {config?.mode === 'cli' && (
            <div>
              <Label>Add to your CI pipeline:</Label>
              <div className="relative">
                <pre className="text-xs bg-muted p-4 rounded-lg font-mono overflow-x-auto">{cliSnippet}</pre>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => navigator.clipboard.writeText(cliSnippet)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {(config?.mode === 'connected' || config?.mode === 'hybrid') && (
            <div>
              <Label>Storybook URL</Label>
              <div className="flex items-center gap-2">
                <Input value={config?.storybookUrl || ''} onChange={(e) => setConfig({ ...config, storybookUrl: e.target.value })} placeholder="https://storybook.staging.myapp.com" />
                <Button variant="outline" size="sm" onClick={testConnection} disabled={testingConnection || !config?.storybookUrl}>
                  {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                </Button>
              </div>
              {connectionResult && (
                <div className={`mt-2 text-sm ${connectionResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                  {connectionResult.connected ? (
                    <><CheckCircle2 className="h-3 w-3 inline mr-1" /> Connected - {connectionResult.storyCount} stories found (index {connectionResult.indexVersion})</>
                  ) : (
                    <><XCircle className="h-3 w-3 inline mr-1" /> {connectionResult.error}</>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Viewport Sizes</CardTitle>
            <Button variant="outline" size="sm" onClick={addViewport}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          <CardDescription>Each story is tested at every viewport size</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {viewports.map((vp, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={vp.name} onChange={(e) => updateViewport(i, 'name', e.target.value)} className="w-32" />
                <Input type="number" value={vp.width} onChange={(e) => updateViewport(i, 'width', parseInt(e.target.value))} className="w-24" placeholder="Width" />
                <span className="text-muted-foreground">x</span>
                <Input type="number" value={vp.height} onChange={(e) => updateViewport(i, 'height', parseInt(e.target.value))} className="w-24" placeholder="Height" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeViewport(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Story Filtering</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Include patterns (glob, comma-separated)</Label>
            <Input value={(config?.includePatterns || []).join(', ')} onChange={(e) => setConfig({ ...config, includePatterns: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} placeholder="Leave empty = include all" />
          </div>
          <div>
            <Label>Exclude patterns (glob, comma-separated)</Label>
            <Input value={(config?.excludePatterns || ['*--docs']).join(', ')} onChange={(e) => setConfig({ ...config, excludePatterns: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} placeholder="*--docs" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sync Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Wait after page load (ms)</Label>
            <Input type="number" value={config?.waitAfterLoadMs || 500} onChange={(e) => setConfig({ ...config, waitAfterLoadMs: parseInt(e.target.value) })} />
          </div>
          {config?.mode !== 'cli' && (
            <div>
              <Label>Sync Mode</Label>
              <Select value={config?.syncMode || 'manual'} onValueChange={(v) => setConfig({ ...config, syncMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual - sync via CLI or "Sync Now" button</SelectItem>
                  <SelectItem value="polling">Polling - check for changes periodically</SelectItem>
                  <SelectItem value="webhook">Webhook - POST to VisionTest.ai when stories change</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save Configuration
      </Button>
    </div>
  );
}
