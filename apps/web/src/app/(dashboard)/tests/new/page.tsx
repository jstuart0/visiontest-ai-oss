'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, Loader2, Wand2, Code, FileText, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCurrentProject } from '@/hooks/useProject';
import { api, testsApi, type Platform, type DeviceProfile } from '@/lib/api';
import { DeviceSelector } from '@/components/devices/DeviceSelector';
import { TouchGestureRecorder } from '@/components/devices/TouchGestureRecorder';
import { StepEditor, type TestStep as EditorTestStep } from '@/components/step-editor';
import { toast } from 'sonner';

interface TestStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  name?: string;
  assertion?: string;
}

interface ParseResult {
  steps: TestStep[];
  format: string;
  warnings?: string[];
}

const QUICK_REFERENCE = [
  { action: 'navigate', natural: 'Go to URL', yaml: '- navigate: URL' },
  { action: 'click', natural: 'Click the button', yaml: '- click: "#selector"' },
  { action: 'type', natural: 'Type "text" in field', yaml: '- type: {selector, value}' },
  { action: 'waitFor', natural: 'Wait for element', yaml: '- waitFor: ".selector"' },
  { action: 'screenshot', natural: 'Take screenshot', yaml: '- screenshot: "name"' },
  { action: 'assert', natural: 'Verify visible', yaml: '- assert: ".selector"' },
];

const YAML_EXAMPLE = `# VisionTest YAML Script
# Each line is a step

- navigate: https://example.com
- click: "#login-button"
- type:
    selector: "#username"
    value: "testuser"
- type:
    selector: "#password"
    value: "secret123"
- click: "button[type=submit]"
- waitFor: ".dashboard"
- screenshot: "after-login"`;

const NATURAL_EXAMPLE = `Go to https://example.com
Click the login button
Type "testuser" in the username field
Type "secret123" in the password field
Click submit
Wait for the dashboard to appear
Take a screenshot named "after-login"`;

export default function NewTestPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<Platform>('WEB');
  const [deviceProfileId, setDeviceProfileId] = useState<string | undefined>();
  const [scriptMode, setScriptMode] = useState<'natural' | 'yaml'>('natural');
  const [script, setScript] = useState('');
  const [parsedSteps, setParsedSteps] = useState<TestStep[]>([]);
  const [mobileSteps, setMobileSteps] = useState<TestStep[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; steps: TestStep[]; platform?: Platform; deviceProfileId?: string }) => {
      return api.post(`/tests`, {
        projectId: project!.id,
        name: data.name,
        description: data.description,
        steps: data.steps,
        platform: data.platform || 'WEB',
        deviceProfileId: data.deviceProfileId,
      });
    },
    onSuccess: (test: any) => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Test created successfully');
      router.push(`/tests/${test.id}`);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create test');
    },
  });

  const parseScript = async () => {
    if (!script.trim()) {
      toast.error('Please enter a test script');
      return;
    }

    setIsParsing(true);
    try {
      const result = await api.post<ParseResult>('/tests/parse', {
        script,
        format: scriptMode,
        projectId: project?.id,
      });
      setParsedSteps(result.steps);
      setParseWarnings(result.warnings || []);
      
      if (result.steps.length > 0) {
        toast.success(`Parsed ${result.steps.length} steps`);
      } else {
        toast.warning('No steps could be parsed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to parse script');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a test name');
      return;
    }

    const isMobileNative = platform === 'IOS' || platform === 'ANDROID';
    const steps = isMobileNative ? mobileSteps : parsedSteps;

    if (steps.length === 0) {
      toast.error(isMobileNative
        ? 'Please add mobile test steps'
        : 'Please parse your script first to generate steps'
      );
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      steps,
      platform,
      deviceProfileId,
    });
  };

  const loadExample = () => {
    setScript(scriptMode === 'yaml' ? YAML_EXAMPLE : NATURAL_EXAMPLE);
    setParsedSteps([]);
    setParseWarnings([]);
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">Please select a project first</div>
        <Link href="/">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/tests')}
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Test</h1>
          <p className="text-muted-foreground mt-1">
            Write your test in natural language or YAML
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Test Details */}
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              Test Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-muted-foreground">
                  Test Name <span className="text-red-400">*</span>
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Login Flow Test"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            {/* Platform & Device Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => {
                    setPlatform(e.target.value as Platform);
                    setDeviceProfileId(undefined);
                    setParsedSteps([]);
                    setMobileSteps([]);
                    setScript('');
                  }}
                  className="w-full h-10 rounded-md bg-muted border border-border text-foreground px-3 text-sm"
                >
                  <option value="WEB">🌐 Web (Playwright)</option>
                  <option value="MOBILE_WEB">📱 Mobile Web (Emulated)</option>
                  <option value="IOS">🍎 iOS (Appium)</option>
                  <option value="ANDROID">🤖 Android (Appium)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Device Profile</label>
                <DeviceSelector
                  projectId={project?.id}
                  platform={platform}
                  value={deviceProfileId}
                  onChange={(id) => setDeviceProfileId(id)}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Reference */}
        <Card className="bg-muted/50 border-border mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Quick Reference
              </CardTitle>
              <Link href="/help" className="text-xs text-blue-400 hover:text-blue-300">
                Full Documentation →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {QUICK_REFERENCE.map((ref) => (
                <div key={ref.action} className="bg-card/50 rounded p-2">
                  <Badge variant="outline" className="text-xs mb-1 font-mono">{ref.action}</Badge>
                  <div className="text-muted-foreground truncate" title={ref.natural}>{ref.natural}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Script Editor */}
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Code className="w-5 h-5" />
                Test Script
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadExample}
                className="text-muted-foreground hover:text-foreground"
              >
                Load Example
              </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              Write your test steps in natural language or structured YAML
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={scriptMode} onValueChange={(v) => {
              setScriptMode(v as 'natural' | 'yaml');
              setScript('');
              setParsedSteps([]);
              setParseWarnings([]);
            }}>
              <TabsList className="bg-muted">
                <TabsTrigger value="natural" className="data-[state=active]:bg-accent">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Natural Language
                </TabsTrigger>
                <TabsTrigger value="yaml" className="data-[state=active]:bg-accent">
                  <FileText className="w-4 h-4 mr-2" />
                  YAML Script
                </TabsTrigger>
              </TabsList>

              <TabsContent value="natural" className="mt-4">
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder={`Write your test in plain English, one step per line:

Go to https://example.com
Click the login button
Type "myuser" in the username field
Type "mypassword" in the password field
Click submit
Wait for the dashboard
Take a screenshot`}
                  className="bg-muted border-border text-foreground font-mono min-h-[250px]"
                />
              </TabsContent>

              <TabsContent value="yaml" className="mt-4">
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder={`# YAML test script
- navigate: https://example.com
- click: "#login-btn"
- type:
    selector: "#username"
    value: "testuser"
- click: "button[type=submit]"
- waitFor: ".dashboard"
- screenshot: "result"`}
                  className="bg-muted border-border text-foreground font-mono min-h-[250px]"
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={parseScript}
                disabled={isParsing || !script.trim()}
                className="bg-muted hover:bg-muted"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Parse Script
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Gesture Steps (for native iOS/Android) */}
        {(platform === 'IOS' || platform === 'ANDROID') && (
          <TouchGestureRecorder
            steps={mobileSteps}
            onAddStep={(step) => setMobileSteps([...mobileSteps, step])}
            onRemoveStep={(index) => setMobileSteps(mobileSteps.filter((_, i) => i !== index))}
            className="mb-6"
          />
        )}

        {/* Parsed Steps Editor */}
        {(parsedSteps.length > 0 || parseWarnings.length > 0) && (
          <div className="mb-6">
            {parseWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Warnings</span>
                </div>
                <ul className="text-sm text-yellow-300 space-y-1">
                  {parseWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <StepEditor
              steps={parsedSteps}
              platform={platform}
              onChange={(newSteps) => setParsedSteps(newSteps)}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/tests')}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              !name.trim() ||
              ((platform === 'IOS' || platform === 'ANDROID') ? mobileSteps.length === 0 : parsedSteps.length === 0) ||
              createMutation.isPending
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Test'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
