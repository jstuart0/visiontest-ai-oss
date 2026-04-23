'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FlaskConical,
  Loader2,
  Wand2,
  Code,
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Radio,
  BookOpen,
  Target,
  Info,
  Sparkles,
  ListPlus,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCurrentProject } from '@/hooks/useProject';
import { api, type Platform } from '@/lib/api';
import { DeviceSelector } from '@/components/devices/DeviceSelector';
import { TouchGestureRecorder } from '@/components/devices/TouchGestureRecorder';
import { StepEditor } from '@/components/step-editor';
import { toast } from 'sonner';

// -----------------------------------------------------------------------
// Types that mirror the API response shape.
// -----------------------------------------------------------------------
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

interface GoalCompileResult {
  checks: Array<{
    kind: string;
    selector?: string;
    value?: string;
    urlOp?: string;
    source: string;
  }>;
  unresolvedClauses: string[];
  llmAvailable: boolean;
  canSave: boolean;
}

interface GoalPattern {
  pattern: string;
  example: string;
  compiles: string;
}

interface Template {
  slug: string;
  title: string;
  description: string;
  storyText: string;
  goalText: string | null;
  source: string;
  usageCount: number;
}

// Slash-command picker entries. Each line below maps to a scaffold the
// editor inserts at the cursor position when the user picks it.
const SLASH_COMMANDS: Array<{
  key: string;
  label: string;
  template: string;
  description: string;
}> = [
  {
    key: '/click',
    label: '/click',
    template: 'Click the "{target}"',
    description: 'Click an element by text',
  },
  {
    key: '/type',
    label: '/type',
    template: 'Type "{value}" in the {target}',
    description: 'Type into an input',
  },
  {
    key: '/wait',
    label: '/wait',
    template: 'Wait for the {target}',
    description: 'Wait for a selector',
  },
  {
    key: '/assert',
    label: '/assert',
    template: 'Verify "{target}" is visible',
    description: 'Assert visible',
  },
  {
    key: '/missing',
    label: '/missing',
    template: 'Verify "{target}" is NOT visible',
    description: 'Assert hidden',
  },
  {
    key: '/goal',
    label: '/goal',
    template: 'The URL contains {path}. "{target}" is visible.',
    description: 'Goal template (goes in Goal field)',
  },
  {
    key: '/login',
    label: '/login',
    template:
      'Go to {baseUrl}/login\nType "{email}" in the email field\nType "{password}" in the password field\nClick "Sign in"',
    description: 'Login block',
  },
];

type ConfidenceBadge = 'exact' | 'heuristic' | 'AI' | 'unknown';

// Heuristic map from step type to a confidence badge. The real source-of-
// truth is the warnings array on the parser response — anything marked
// AI-interpreted gets the AI badge; runtime `ai` steps get 'unknown'; all
// other step types are 'exact' because they came out of the regex parser.
function confidenceFor(
  step: TestStep,
  index: number,
  warnings: string[],
): ConfidenceBadge {
  if (step.type === 'ai') {
    // Worker resolves at runtime — DOM heuristic match.
    return 'unknown';
  }
  const w = warnings.find((w) =>
    w.toLowerCase().includes(`ai-interpreted`) ||
    w.toLowerCase().includes(`unrecognized`),
  );
  if (w) return 'heuristic';
  return 'exact';
}

const CONFIDENCE_COLORS: Record<ConfidenceBadge, string> = {
  exact:
    'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  heuristic:
    'bg-amber-900/40 text-amber-300 border-amber-700/50',
  AI: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  unknown:
    'bg-neutral-800 text-neutral-400 border-neutral-700',
};

const STORY_PLACEHOLDER = `Describe the journey, one action per sentence.

Example:
Go to https://example.com
Type "admin@example.com" in the email field
Type "SuperSecret1!" in the password field
Click "Sign in"
Wait for the dashboard
Take a screenshot`;

const GOAL_PLACEHOLDER = `Example:
The URL contains /dashboard.
"Welcome back" is visible.
"Error" is NOT visible.`;

const YAML_EXAMPLE = `- navigate: https://example.com
- click: "#login"
- type:
    selector: "#email"
    value: "admin@example.com"
- screenshot: after-login`;

export default function NewTestPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const [activeTab, setActiveTab] = useState<'story' | 'record' | 'script'>(
    'story',
  );

  // Shared test metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<Platform>('WEB');
  const [deviceProfileId, setDeviceProfileId] = useState<string | undefined>();

  // Story tab state
  const [story, setStory] = useState('');
  const [goal, setGoal] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSource, setImportSource] = useState<
    'jira' | 'github' | 'slack' | 'markdown'
  >('markdown');
  const [parsedSteps, setParsedSteps] = useState<TestStep[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [goalResult, setGoalResult] = useState<GoalCompileResult | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);
  const [captureMode, setCaptureMode] = useState<'story' | 'incremental'>(
    'story',
  );
  // Incremental mode: single input at the top, each Enter commits a step.
  const [nextStep, setNextStep] = useState('');
  // Slash-command picker: visible when the textarea's current line starts
  // with "/" and we want to show candidate completions.
  const [slashOpen, setSlashOpen] = useState(false);
  const storyRef = useRef<HTMLTextAreaElement | null>(null);
  const nextStepRef = useRef<HTMLInputElement | null>(null);

  // Script tab state (YAML / JSON)
  const [scriptMode, setScriptMode] = useState<'natural' | 'yaml'>('yaml');
  const [script, setScript] = useState('');
  const [scriptSteps, setScriptSteps] = useState<TestStep[]>([]);
  const [scriptWarnings, setScriptWarnings] = useState<string[]>([]);

  // Mobile gesture state
  const [mobileSteps, setMobileSteps] = useState<TestStep[]>([]);

  // ---------------------------------------------------------------------
  // Fetch goal pattern reference once on mount for the help drawer.
  // ---------------------------------------------------------------------
  const { data: patternData } = useQuery<{ patterns: GoalPattern[] }>({
    queryKey: ['goal-patterns'],
    queryFn: async () => api.get('/tests/goal-patterns'),
  });

  // Fetch built-in templates for the chips row above the textarea.
  const { data: templateData } = useQuery<{ templates: Template[] }>({
    queryKey: ['templates'],
    queryFn: async () => api.get('/templates'),
  });

  // ---------------------------------------------------------------------
  // Debounced live preview for the Story tab.
  // ---------------------------------------------------------------------
  const storyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (storyDebounce.current) clearTimeout(storyDebounce.current);
    if (!story.trim() || activeTab !== 'story') return;
    storyDebounce.current = setTimeout(async () => {
      try {
        const result = await api.post<ParseResult>('/tests/parse', {
          script: story,
          format: 'natural',
          projectId: project?.id,
        });
        setParsedSteps(result.steps);
        setParseWarnings(result.warnings || []);
      } catch {
        // silent — user is mid-typing
      }
    }, 450);
    return () => {
      if (storyDebounce.current) clearTimeout(storyDebounce.current);
    };
  }, [story, activeTab, project?.id]);

  // Debounced goal compile — so the user sees canSave status live.
  const goalDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (goalDebounce.current) clearTimeout(goalDebounce.current);
    if (!goal.trim()) {
      setGoalResult(null);
      return;
    }
    goalDebounce.current = setTimeout(async () => {
      try {
        const result = await api.post<GoalCompileResult>('/tests/compile-goal', {
          goal,
          projectId: project?.id,
        });
        setGoalResult(result);
      } catch {
        // silent
      }
    }, 400);
    return () => {
      if (goalDebounce.current) clearTimeout(goalDebounce.current);
    };
  }, [goal, project?.id]);

  // ---------------------------------------------------------------------
  // Submission — Story tab uses POST /tests/story, Script tab uses the
  // existing POST /tests path (parser → step array).
  // ---------------------------------------------------------------------
  const storyMutation = useMutation({
    mutationFn: async () => {
      return api.post('/tests/story', {
        projectId: project!.id,
        name,
        description: description || undefined,
        story,
        goal: goal || undefined,
        baseUrl: baseUrl || undefined,
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Story test created');
      router.push(`/tests/${res.test.id}`);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not save story test');
    },
  });

  const scriptMutation = useMutation({
    mutationFn: async () => {
      const isMobileNative = platform === 'IOS' || platform === 'ANDROID';
      const steps = isMobileNative ? mobileSteps : scriptSteps;
      return api.post('/tests', {
        projectId: project!.id,
        name,
        description: description || undefined,
        steps,
        platform,
        deviceProfileId,
      });
    },
    onSuccess: (test: any) => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Test created');
      router.push(`/tests/${test.id}`);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Could not save test');
    },
  });

  const parseScript = async () => {
    if (!script.trim()) {
      toast.error('Please enter a test script');
      return;
    }
    try {
      const result = await api.post<ParseResult>('/tests/parse', {
        script,
        format: scriptMode,
        projectId: project?.id,
      });
      setScriptSteps(result.steps);
      setScriptWarnings(result.warnings || []);
      toast.success(`Parsed ${result.steps.length} step${result.steps.length === 1 ? '' : 's'}`);
    } catch (error: any) {
      toast.error(error.message || 'Parse failed');
    }
  };

  const isMobileNative = platform === 'IOS' || platform === 'ANDROID';

  const canSaveStory = useMemo(() => {
    if (!name.trim() || !story.trim()) return false;
    if (!goal.trim()) return true;
    return goalResult?.canSave ?? true;
  }, [name, story, goal, goalResult]);

  const canSaveScript = useMemo(() => {
    if (!name.trim()) return false;
    return isMobileNative
      ? mobileSteps.length > 0
      : scriptSteps.length > 0;
  }, [name, scriptSteps, mobileSteps, isMobileNative]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'story') {
      if (!canSaveStory) {
        if (goalResult && !goalResult.canSave) {
          toast.error(
            'Goal has clauses that cannot be verified without an LLM. Rewrite them in pattern form or configure an AI provider.',
          );
        }
        return;
      }
      storyMutation.mutate();
    } else if (activeTab === 'script') {
      if (!canSaveScript) return;
      scriptMutation.mutate();
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">
          Please select a project first
        </div>
        <Link href="/">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
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
          <h1 className="text-2xl font-bold text-foreground">New test</h1>
          <p className="text-muted-foreground mt-1">
            Describe the journey in plain English, or script it manually.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Test Details — always visible */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FlaskConical className="w-5 h-5" /> Test details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Login happy path"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            {activeTab !== 'story' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => {
                      setPlatform(e.target.value as Platform);
                      setDeviceProfileId(undefined);
                      setScriptSteps([]);
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
                  <label className="text-sm font-medium text-muted-foreground">
                    Device profile
                  </label>
                  <DeviceSelector
                    projectId={project?.id}
                    platform={platform}
                    value={deviceProfileId}
                    onChange={(id) => setDeviceProfileId(id)}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full"
        >
          <TabsList className="bg-muted grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="story" className="data-[state=active]:bg-accent">
              <BookOpen className="w-4 h-4 mr-2" /> Story
            </TabsTrigger>
            <TabsTrigger
              value="record"
              className="data-[state=active]:bg-accent"
            >
              <Radio className="w-4 h-4 mr-2" /> Record
            </TabsTrigger>
            <TabsTrigger
              value="script"
              className="data-[state=active]:bg-accent"
            >
              <Code className="w-4 h-4 mr-2" /> Script
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------------------ */}
          {/* STORY TAB                                                     */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="story" className="mt-6 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5" /> The journey
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className="bg-emerald-900/30 text-emerald-300 border-emerald-700/50"
                    >
                      exact
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-amber-900/30 text-amber-300 border-amber-700/50"
                    >
                      heuristic
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-neutral-800 text-neutral-400 border-neutral-700"
                    >
                      unknown
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-muted-foreground">
                  One action per sentence. URLs are auto-detected. Quoted text
                  becomes a click or type target.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template chips + capture mode toggle row. Shown only on
                    an empty story so the editor stays uncluttered once the
                    user is typing. */}
                {story.trim().length === 0 && (
                  <div className="space-y-3">
                    {/* Import from… */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowImport(!showImport)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {showImport ? 'Hide import' : 'Import from bug report'}
                      </Button>
                      {showImport && (
                        <select
                          value={importSource}
                          onChange={(e) =>
                            setImportSource(e.target.value as any)
                          }
                          className="h-9 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                        >
                          <option value="markdown">Markdown</option>
                          <option value="github">GitHub issue</option>
                          <option value="jira">Jira ticket</option>
                          <option value="slack">Slack message</option>
                        </select>
                      )}
                    </div>
                    {showImport && (
                      <div className="space-y-2">
                        <Textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder={`Paste a bug report here. We extract the steps-to-reproduce as your story, the expected result as the goal, and the actual result as NOT-visible assertions.

Example:
# Login fails with valid credentials

## Steps to reproduce
1. Go to /login
2. Click "Sign in"

## Expected
User is redirected to /dashboard

## Actual
"Invalid credentials" toast appears`}
                          className="bg-muted border-border text-foreground font-mono min-h-[160px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={importText.trim().length < 20}
                          onClick={async () => {
                            try {
                              const result = await api.post<{
                                title: string | null;
                                story: string;
                                goal: string;
                              }>('/tests/import', {
                                projectId: project!.id,
                                source: importSource,
                                text: importText,
                              });
                              setStory(result.story);
                              if (result.goal) setGoal(result.goal);
                              if (result.title && !name)
                                setName(result.title);
                              setShowImport(false);
                              setImportText('');
                              toast.success('Imported bug report');
                            } catch (error: any) {
                              toast.error(error.message || 'Import failed');
                            }
                          }}
                        >
                          Extract
                        </Button>
                      </div>
                    )}

                    {templateData?.templates && templateData.templates.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          Start from a template
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {templateData.templates.map((t) => (
                            <button
                              key={t.slug}
                              type="button"
                              onClick={() => {
                                setStory(t.storyText);
                                if (t.goalText) setGoal(t.goalText);
                                api
                                  .post(`/templates/${t.slug}/pick`, {
                                    projectId: project?.id,
                                  })
                                  .catch(() => {});
                              }}
                              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-foreground border border-border transition-colors"
                              title={t.description}
                            >
                              {t.title}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setStory('');
                              setGoal('');
                            }}
                            className="text-xs px-3 py-1.5 rounded-full bg-transparent text-muted-foreground hover:text-foreground border border-border border-dashed"
                          >
                            Blank
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Capture mode toggle */}
                <div className="flex items-center gap-1 text-xs w-fit bg-muted rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setCaptureMode('story')}
                    className={`px-3 py-1 rounded ${
                      captureMode === 'story'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
                    Story
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode('incremental')}
                    className={`px-3 py-1 rounded ${
                      captureMode === 'incremental'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <ListPlus className="w-3.5 h-3.5 inline mr-1.5" />
                    Incremental
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left pane: the story */}
                  <div className="space-y-3 relative">
                    {captureMode === 'story' ? (
                      <>
                        <Textarea
                          ref={storyRef}
                          value={story}
                          onChange={(e) => {
                            setStory(e.target.value);
                            // Open slash picker when the current line
                            // begins with "/" followed by word chars only.
                            const textarea = e.target;
                            const cursor = textarea.selectionStart;
                            const before = textarea.value.slice(0, cursor);
                            const lineStart =
                              before.lastIndexOf('\n') + 1;
                            const line = before.slice(lineStart);
                            setSlashOpen(/^\/[a-z]*$/i.test(line));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setSlashOpen(false);
                          }}
                          placeholder={STORY_PLACEHOLDER}
                          className="bg-muted border-border text-foreground font-mono min-h-[300px]"
                        />
                        {slashOpen && (
                          <div className="absolute left-0 right-0 top-0 -translate-y-full mb-2 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                            {SLASH_COMMANDS.filter((c) => {
                              // Filter by prefix of the slash-token
                              const textarea = storyRef.current;
                              if (!textarea) return true;
                              const cursor = textarea.selectionStart;
                              const before = textarea.value.slice(0, cursor);
                              const lineStart =
                                before.lastIndexOf('\n') + 1;
                              const line = before.slice(lineStart);
                              return c.key.startsWith(line.toLowerCase());
                            }).map((cmd) => (
                              <button
                                type="button"
                                key={cmd.key}
                                className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border/50 last:border-0"
                                onClick={() => {
                                  const textarea = storyRef.current;
                                  if (!textarea) return;
                                  const cursor = textarea.selectionStart;
                                  const before = textarea.value.slice(
                                    0,
                                    cursor,
                                  );
                                  const after = textarea.value.slice(cursor);
                                  const lineStart =
                                    before.lastIndexOf('\n') + 1;
                                  // Drop the partial slash-token, insert
                                  // the template scaffold.
                                  const newVal =
                                    before.slice(0, lineStart) +
                                    cmd.template +
                                    after;
                                  setStory(newVal);
                                  setSlashOpen(false);
                                  requestAnimationFrame(() => {
                                    textarea.focus();
                                    const pos =
                                      lineStart + cmd.template.length;
                                    textarea.setSelectionRange(pos, pos);
                                  });
                                }}
                              >
                                <div className="flex items-baseline gap-2">
                                  <span className="font-mono text-sm text-foreground">
                                    {cmd.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {cmd.description}
                                  </span>
                                </div>
                                <div className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                                  {cmd.template.split('\n')[0]}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs uppercase tracking-wider text-muted-foreground">
                            Step {parsedSteps.length + 1} — what should happen next?
                          </label>
                          <Input
                            ref={nextStepRef}
                            value={nextStep}
                            onChange={(e) => setNextStep(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && nextStep.trim()) {
                                e.preventDefault();
                                // Append as a new sentence to the story
                                const s = nextStep.trim().replace(/\.$/, '');
                                setStory((prev) =>
                                  prev.trim()
                                    ? `${prev.trim()}\n${s}`
                                    : s,
                                );
                                setNextStep('');
                                requestAnimationFrame(() => {
                                  nextStepRef.current?.focus();
                                });
                              }
                            }}
                            placeholder='e.g. click the "Sign in" button'
                            className="bg-muted border-border text-foreground"
                          />
                          <p className="text-xs text-muted-foreground">
                            Press <kbd className="px-1 rounded bg-muted-foreground/20">Enter</kbd> to add the step. Backspace
                            to delete the last one.
                          </p>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-md p-3 min-h-[240px] space-y-1">
                          {story.trim() === '' ? (
                            <div className="text-sm text-muted-foreground italic">
                              No steps yet.
                            </div>
                          ) : (
                            story
                              .split('\n')
                              .filter((l) => l.trim())
                              .map((line, i) => (
                                <div
                                  key={i}
                                  className="text-sm font-mono text-foreground"
                                >
                                  <span className="text-muted-foreground w-6 inline-block">
                                    {i + 1}.
                                  </span>
                                  {line}
                                </div>
                              ))
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const lines = story.split('\n').filter((l) => l.trim());
                            lines.pop();
                            setStory(lines.join('\n'));
                          }}
                          disabled={!story.trim()}
                          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                        >
                          ← Remove last step
                        </button>
                      </>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Base URL (optional)
                      </label>
                      <Input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://app.example.com"
                        className="bg-muted border-border text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">
                        Prepended to relative paths in the story ("/orders" →
                        "{baseUrl || 'https://...'}/orders").
                      </p>
                    </div>
                  </div>

                  {/* Right pane: live preview */}
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      Preview
                    </div>
                    <div className="bg-muted/40 border border-border rounded-md p-3 min-h-[300px] space-y-1.5">
                      {parsedSteps.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic">
                          Start typing a story — steps will appear here.
                        </div>
                      ) : (
                        parsedSteps.map((step, i) => {
                          const badge = confidenceFor(step, i, parseWarnings);
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="text-muted-foreground w-6 text-right tabular-nums">
                                {i + 1}.
                              </span>
                              <Badge
                                variant="outline"
                                className={`${CONFIDENCE_COLORS[badge]} text-[10px] px-1.5 py-0 font-mono`}
                                title={
                                  badge === 'unknown'
                                    ? 'Will use DOM analysis at runtime'
                                    : badge
                                }
                              >
                                {badge === 'unknown' ? '?' : badge}
                              </Badge>
                              <span className="font-mono text-foreground">
                                {step.type}
                              </span>
                              <span className="text-muted-foreground truncate">
                                {step.url || step.selector || step.value || ''}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {parseWarnings.length > 0 && (
                      <div className="text-xs text-amber-300/80">
                        {parseWarnings.slice(0, 3).map((w, i) => (
                          <div key={i}>⚠ {w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goal block */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Target className="w-5 h-5" /> Success goal
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPatternHelp(!showPatternHelp)}
                    className="text-muted-foreground"
                  >
                    <HelpCircle className="w-4 h-4 mr-1" />
                    {showPatternHelp ? 'Hide patterns' : 'Show patterns'}
                  </Button>
                </div>
                <CardDescription className="text-muted-foreground">
                  What should be true when this test passes? Optional — leave
                  blank for plain step-based pass/fail.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={GOAL_PLACEHOLDER}
                  className="bg-muted border-border text-foreground min-h-[100px]"
                />

                {/* Pattern reference drawer */}
                {showPatternHelp && patternData?.patterns && (
                  <div className="bg-muted/40 border border-border rounded-md p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Layer-1 pattern vocabulary (no AI required)
                    </div>
                    <div className="grid gap-2">
                      {patternData.patterns.map((p) => (
                        <div key={p.pattern} className="text-sm">
                          <div className="font-medium text-foreground">
                            {p.pattern}
                          </div>
                          <div className="text-xs text-muted-foreground italic">
                            e.g. {p.example}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compilation result */}
                {goalResult && (
                  <div className="space-y-2">
                    {goalResult.checks.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-emerald-300">
                            {goalResult.checks.length} verifiable check
                            {goalResult.checks.length === 1 ? '' : 's'}
                          </span>{' '}
                          will run against the final page.
                        </div>
                      </div>
                    )}
                    {goalResult.unresolvedClauses.length > 0 && (
                      <div
                        className={
                          goalResult.canSave
                            ? 'border border-blue-800/60 bg-blue-900/10 rounded-md p-3'
                            : 'border border-red-800/60 bg-red-900/10 rounded-md p-3'
                        }
                      >
                        <div className="flex items-start gap-2 text-sm">
                          {goalResult.canSave ? (
                            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="space-y-1">
                            <div
                              className={
                                goalResult.canSave
                                  ? 'text-blue-300'
                                  : 'text-red-300'
                              }
                            >
                              {goalResult.canSave
                                ? `${goalResult.unresolvedClauses.length} clause${
                                    goalResult.unresolvedClauses.length === 1
                                      ? ''
                                      : 's'
                                  } will be evaluated by the LLM at runtime.`
                                : `${goalResult.unresolvedClauses.length} clause${
                                    goalResult.unresolvedClauses.length === 1
                                      ? ''
                                      : 's'
                                  } cannot be verified without an LLM. Rewrite them in pattern form (see "Show patterns") or configure an AI provider.`}
                            </div>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              {goalResult.unresolvedClauses.map((c, i) => (
                                <li key={i}>
                                  • <span className="italic">"{c}"</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Story actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/tests')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSaveStory || storyMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {storyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save story test'
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------ */}
          {/* RECORD TAB — stubbed for 1a, implemented Phase 6+             */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="record" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Radio className="w-5 h-5" /> Record browser actions
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Coming in a later phase — a browser extension that watches
                  real clicks and compiles them to steps.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/40 border border-dashed border-border rounded-md p-12 text-center space-y-3">
                  <Radio className="w-10 h-10 text-muted-foreground mx-auto" />
                  <div className="text-muted-foreground">
                    Not yet available. Use <strong>Story</strong> (prose) or{' '}
                    <strong>Script</strong> (YAML/JSON) for now.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab('story')}
                  >
                    Switch to Story
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------------------------------------ */}
          {/* SCRIPT TAB — existing YAML/JSON authoring, preserved          */}
          {/* ------------------------------------------------------------ */}
          <TabsContent value="script" className="mt-6 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Script
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScript(YAML_EXAMPLE)}
                  >
                    Load YAML example
                  </Button>
                </div>
                <CardDescription className="text-muted-foreground">
                  Power users, or CI/CD test generation. Accepts YAML or JSON.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setScriptMode('yaml')}
                    className={`px-3 py-1 rounded ${
                      scriptMode === 'yaml'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    YAML
                  </button>
                  <button
                    type="button"
                    onClick={() => setScriptMode('natural')}
                    className={`px-3 py-1 rounded ${
                      scriptMode === 'natural'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Natural
                  </button>
                </div>
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder={
                    scriptMode === 'yaml'
                      ? YAML_EXAMPLE
                      : 'Plain-English one step per line.'
                  }
                  className="bg-muted border-border text-foreground font-mono min-h-[250px]"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={parseScript}
                    disabled={!script.trim()}
                  >
                    <Wand2 className="w-4 h-4 mr-2" /> Parse
                  </Button>
                </div>

                {scriptWarnings.length > 0 && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Warnings</span>
                    </div>
                    <ul className="text-sm text-yellow-300 space-y-1">
                      {scriptWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {isMobileNative && (
                  <TouchGestureRecorder
                    steps={mobileSteps}
                    onAddStep={(step) =>
                      setMobileSteps([...mobileSteps, step])
                    }
                    onRemoveStep={(index) =>
                      setMobileSteps(mobileSteps.filter((_, i) => i !== index))
                    }
                  />
                )}

                {scriptSteps.length > 0 && !isMobileNative && (
                  <StepEditor
                    steps={scriptSteps}
                    platform={platform}
                    onChange={(s) => setScriptSteps(s)}
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/tests')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSaveScript || scriptMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {scriptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  'Create test'
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}
