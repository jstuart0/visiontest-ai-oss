'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Brain,
  Plus,
  Trash2,
  Loader2,
  Star,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Globe,
  Server,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ProviderConfig {
  id: string;
  provider: string;
  name: string;
  hasApiKey: boolean;
  baseUrl: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRuntimeSeconds: number;
  supportsStreaming: boolean;
  supportsImages: boolean;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsImages?: boolean;
  pricing?: { inputPerMToken?: number; outputPerMToken?: number };
}

interface ProviderDefaults {
  displayName: string;
  baseUrl: string | null;
  defaultModel: string;
  requiresApiKey: boolean;
  staticModels: ModelInfo[];
}

const providerIcons: Record<string, string> = {
  ANTHROPIC: '🟠',
  OPENAI: '🟢',
  OPENROUTER: '🔵',
  GEMINI: '🔷',
  LOCAL: '🖥️',
};

export default function AIProvidersPage() {
  const { project } = useCurrentProject();
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [defaults, setDefaults] = useState<Record<string, ProviderDefaults>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state
  const [provider, setProvider] = useState('ANTHROPIC');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.2);
  const [maxRuntime, setMaxRuntime] = useState(120);
  const [isDefault, setIsDefault] = useState(false);

  // Dynamic models
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    loadDefaults();
    if (project?.id) loadConfigs();
  }, [project?.id]);

  // When provider changes, prefill from defaults
  useEffect(() => {
    const d = defaults[provider];
    if (d) {
      setName(d.displayName);
      setBaseUrl(d.baseUrl || '');
      setModel(d.defaultModel);
      setModels(d.staticModels || []);
    }
  }, [provider, defaults]);

  async function loadDefaults() {
    try {
      const data = await api.get<Record<string, ProviderDefaults>>('/ai-providers/defaults');
      setDefaults(data || {});
    } catch (error) {
      console.error('Failed to load defaults:', error);
    }
  }

  async function loadConfigs() {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await api.get<ProviderConfig[]>('/ai-providers', { projectId: project.id });
      setConfigs(data || []);
    } catch (error) {
      console.error('Failed to load configs:', error);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchModels() {
    setLoadingModels(true);
    try {
      const params: Record<string, string> = { provider };
      if (apiKey) params.apiKey = apiKey;
      if (baseUrl) params.baseUrl = baseUrl;
      const data = await api.get<{ provider: string; models: ModelInfo[] }>('/ai-providers/models', params);
      if (data?.models?.length > 0) {
        setModels(data.models);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSave() {
    if (!project?.id || !model) return;
    setSaving(true);
    try {
      await api.post('/ai-providers', {
        projectId: project.id,
        provider,
        name: name || defaults[provider]?.displayName || provider,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model,
        maxTokens,
        temperature,
        maxRuntimeSeconds: maxRuntime,
        isDefault,
        supportsStreaming: true,
        supportsImages: models.find(m => m.id === model)?.supportsImages ?? false,
      });
      setShowAdd(false);
      setApiKey('');
      await loadConfigs();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(configId: string) {
    setTesting(configId);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message: string; latencyMs: number }>(`/ai-providers/${configId}/test`);
      setTestResult({ id: configId, ...result });
    } catch (error) {
      setTestResult({ id: configId, success: false, message: 'Failed to test connection' });
    } finally {
      setTesting(null);
    }
  }

  async function handleDelete(configId: string) {
    if (!confirm('Remove this AI provider?')) return;
    try {
      await api.delete(`/ai-providers/${configId}`);
      await loadConfigs();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  async function handleSetDefault(configId: string) {
    try {
      await api.patch(`/ai-providers/${configId}`, { isDefault: true });
      await loadConfigs();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  }

  const selectedModelInfo = models.find(m => m.id === model);

  // Engine room — pluggable LLM brains. Headline treats providers as
  // a retainer of minds, not a list of services.
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Settings · AI providers</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(34px, 4.5vw, 56px)', lineHeight: 0.98 }}>
            The <em>brains</em> on retainer.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            Which models read the failure, write the fix, interpret the story.
            OpenAI, Anthropic, Gemini, a local Ollama — all pluggable.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Provider</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add AI Provider</DialogTitle>
              <DialogDescription>Configure a new LLM provider for AI-powered features</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <Label>Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANTHROPIC">{providerIcons.ANTHROPIC} Anthropic (Claude)</SelectItem>
                    <SelectItem value="OPENAI">{providerIcons.OPENAI} OpenAI (GPT)</SelectItem>
                    <SelectItem value="GEMINI">{providerIcons.GEMINI} Google Gemini</SelectItem>
                    <SelectItem value="OPENROUTER">{providerIcons.OPENROUTER} OpenRouter</SelectItem>
                    <SelectItem value="LOCAL">{providerIcons.LOCAL} Local LLM (Ollama)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div>
                <Label>Display Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              {/* API Key */}
              {defaults[provider]?.requiresApiKey && (
                <div>
                  <Label>API Key</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider === 'ANTHROPIC' ? 'sk-ant-...' : provider === 'OPENAI' ? 'sk-...' : provider === 'GEMINI' ? 'AIza...' : 'sk-or-...'}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Base URL */}
              {(provider === 'LOCAL' || provider === 'OPENROUTER') && (
                <div>
                  <Label>Base URL</Label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={defaults[provider]?.baseUrl || ''} />
                </div>
              )}

              {/* Model Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Model</Label>
                  <Button variant="ghost" size="sm" onClick={fetchModels} disabled={loadingModels}>
                    {loadingModels ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    {apiKey || provider === 'LOCAL' ? 'Refresh Models' : 'Load Models'}
                  </Button>
                </div>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.pricing?.inputPerMToken !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              ${m.pricing.inputPerMToken}/M in
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModelInfo && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {selectedModelInfo.description && <p>{selectedModelInfo.description}</p>}
                    <div className="flex gap-3">
                      {selectedModelInfo.contextWindow && <span>Context: {(selectedModelInfo.contextWindow / 1000).toFixed(0)}K</span>}
                      {selectedModelInfo.maxOutputTokens && <span>Max output: {(selectedModelInfo.maxOutputTokens / 1000).toFixed(0)}K</span>}
                      {selectedModelInfo.supportsImages && <Badge variant="outline" className="text-xs">Vision</Badge>}
                    </div>
                  </div>
                )}
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Tokens</Label>
                  <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)} />
                </div>
                <div>
                  <Label>Max Runtime (seconds)</Label>
                  <Input type="number" value={maxRuntime} onChange={(e) => setMaxRuntime(parseInt(e.target.value) || 120)} />
                </div>
              </div>

              <div>
                <Label>Temperature ({temperature})</Label>
                <Input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Precise (0)</span>
                  <span>Creative (1)</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Set as Default Provider</Label>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !model}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Provider
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* Provider List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No AI providers configured</h3>
            <p className="text-muted-foreground mt-1">
              Add an AI provider to enable intelligent failure analysis and fix generation.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Without an AI provider, the system uses rule-based heuristics for classification and analysis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <Card key={config.id} className={!config.isActive ? 'opacity-50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{providerIcons[config.provider] || '🤖'}</span>
                    <CardTitle className="text-base">{config.name}</CardTitle>
                    {config.isDefault && (
                      <Badge variant="outline" className="text-yellow-600">
                        <Star className="h-3 w-3 mr-1" /> Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{config.provider}</Badge>
                    <Badge variant="outline" className="font-mono text-xs">{config.model}</Badge>
                  </div>
                </div>
                <CardDescription>
                  {config.hasApiKey ? 'API key configured' : 'No API key'} - Max {config.maxTokens} tokens - Temp {config.temperature}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testResult?.id === config.id && (
                  <div className={`mb-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>
                    {testResult.success ? <CheckCircle2 className="h-4 w-4 inline mr-2" /> : <XCircle className="h-4 w-4 inline mr-2" />}
                    {testResult.message}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleTest(config.id)} disabled={testing === config.id}>
                    {testing === config.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                    Test Connection
                  </Button>
                  {!config.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(config.id)}>
                      <Star className="h-4 w-4 mr-2" /> Set Default
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(config.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
