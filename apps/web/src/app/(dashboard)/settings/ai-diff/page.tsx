'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Eye, Loader2, CheckCircle2, XCircle, Save, Zap, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AiDiffSettingsPage() {
  const { project } = useCurrentProject();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState<any>(null);
  const [testingSidecar, setTestingSidecar] = useState(false);

  useEffect(() => { if (project?.id) loadConfig(); }, [project?.id]);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await api.get<any>('/ai-diff/config', { projectId: project!.id });
      setConfig(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await api.put('/ai-diff/config', { ...config, projectId: project!.id });
    } catch (error) { console.error(error); } finally { setSaving(false); }
  }

  async function testSidecar() {
    setTestingSidecar(true);
    try {
      const result = await api.post<any>('/ai-diff/test-sidecar', { projectId: project!.id });
      setSidecarStatus(result);
    } catch (error) { console.error(error); } finally { setTestingSidecar(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Visual Diff</h1>
          <p className="text-muted-foreground">Configure AI-powered visual difference analysis</p>
        </div>
        <Link href="/settings/ai-diff/wizard">
          <Button variant="outline" size="sm"><Wand2 className="h-4 w-4 mr-1" /> Guided Setup</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Enable AI Visual Diff</CardTitle>
            <Switch checked={config?.enabled || false} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
          </div>
          <CardDescription>When enabled, comparisons are automatically analyzed by the AI pipeline to classify diffs and filter noise.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Analysis Depth (Max Stage)</Label>
            <Select value={String(config?.maxStage ?? 3)} onValueChange={(v) => setConfig({ ...config, maxStage: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Fast (Stages 0-1) - SSIM + LPIPS only ~50ms</SelectItem>
                <SelectItem value="2">Balanced (Stages 0-2) - Adds DINOv2 ~200ms</SelectItem>
                <SelectItem value="3">Deep (Stages 0-3) - Full VLM analysis ~5s</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Embeddings Sidecar URL</Label>
            <div className="flex items-center gap-2">
              <Input value={config?.sidecarUrl || ''} onChange={(e) => setConfig({ ...config, sidecarUrl: e.target.value })} placeholder="http://visiontest-embeddings:8100" />
              <Button variant="outline" size="sm" onClick={testSidecar} disabled={testingSidecar}>
                {testingSidecar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
            {sidecarStatus && (
              <div className={`mt-2 text-sm ${sidecarStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                {sidecarStatus.connected ? (
                  <><CheckCircle2 className="h-3 w-3 inline mr-1" /> Connected ({sidecarStatus.latencyMs}ms) - GPU: {sidecarStatus.gpuAvailable ? 'Yes' : 'No'} - Models: {sidecarStatus.modelsLoaded?.length || 0}</>
                ) : (
                  <><XCircle className="h-3 w-3 inline mr-1" /> {sidecarStatus.error}</>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sensitivity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>SSIM + LPIPS Threshold (Stage 1): {config?.ssimThreshold || 0.97}</Label>
            <Input type="range" min={0.85} max={0.99} step={0.005} value={config?.ssimThreshold || 0.97} onChange={(e) => setConfig({ ...config, ssimThreshold: parseFloat(e.target.value) })} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>More sensitive</span><span>Less sensitive</span></div>
          </div>
          <div>
            <Label>DINOv2 Embedding Threshold (Stage 2): {config?.dinoThreshold || 0.94}</Label>
            <Input type="range" min={0.80} max={0.99} step={0.005} value={config?.dinoThreshold || 0.94} onChange={(e) => setConfig({ ...config, dinoThreshold: parseFloat(e.target.value) })} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>More sensitive</span><span>Less sensitive</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Automation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Auto-approve NOISE diffs</Label><p className="text-xs text-muted-foreground">Automatically approve diffs classified as rendering noise</p></div>
            <Switch checked={config?.autoApproveNoise || false} onCheckedChange={(v) => setConfig({ ...config, autoApproveNoise: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Auto-approve MINOR diffs</Label><p className="text-xs text-muted-foreground">Automatically approve minor visual changes</p></div>
            <Switch checked={config?.autoApproveMinor || false} onCheckedChange={(v) => setConfig({ ...config, autoApproveMinor: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Auto-escalate BREAKING diffs</Label><p className="text-xs text-muted-foreground">Automatically escalate breaking visual changes</p></div>
            <Switch checked={config?.escalateBreaking ?? true} onCheckedChange={(v) => setConfig({ ...config, escalateBreaking: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cost Limits</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>VLM calls per execution</Label>
            <Input type="number" value={config?.vlmCallsPerExecution || 50} onChange={(e) => setConfig({ ...config, vlmCallsPerExecution: parseInt(e.target.value) })} />
          </div>
          <div>
            <Label>Monthly VLM budget (blank = unlimited)</Label>
            <Input type="number" value={config?.vlmMonthlyBudget || ''} onChange={(e) => setConfig({ ...config, vlmMonthlyBudget: e.target.value ? parseInt(e.target.value) : null })} placeholder="Unlimited" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save Configuration
      </Button>
    </div>
  );
}
