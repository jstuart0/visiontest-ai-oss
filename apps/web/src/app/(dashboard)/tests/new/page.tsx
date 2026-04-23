'use client';

// New test — Blueprint / drawing brief.
//
// The page is a drafting brief: you describe the journey (left) and a
// live preview of the compiled part renders on the right. All fields
// read as named dimension callouts — mono-uppercase label, .vt-input
// body.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { useCurrentProject } from '@/hooks/useProject';
import { api, featuresApi, type Platform } from '@/lib/api';
import { DeviceSelector } from '@/components/devices/DeviceSelector';
import { TouchGestureRecorder } from '@/components/devices/TouchGestureRecorder';
import { StepEditor } from '@/components/step-editor';
import { toast } from 'sonner';

// -----------------------------------------------------------------------
// Types — mirror the API response shape. Unchanged.
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

// Slash-command picker — same scaffolds as before.
const SLASH_COMMANDS: Array<{
  key: string;
  label: string;
  template: string;
  description: string;
}> = [
  { key: '/click', label: '/click', template: 'Click the "{target}"', description: 'Click an element by text' },
  { key: '/type', label: '/type', template: 'Type "{value}" in the {target}', description: 'Type into an input' },
  { key: '/wait', label: '/wait', template: 'Wait for the {target}', description: 'Wait for a selector' },
  { key: '/assert', label: '/assert', template: 'Verify "{target}" is visible', description: 'Assert visible' },
  { key: '/missing', label: '/missing', template: 'Verify "{target}" is NOT visible', description: 'Assert hidden' },
  { key: '/goal', label: '/goal', template: 'The URL contains {path}. "{target}" is visible.', description: 'Goal template' },
  {
    key: '/login',
    label: '/login',
    template:
      'Go to {baseUrl}/login\nType "{email}" in the email field\nType "{password}" in the password field\nClick "Sign in"',
    description: 'Login block',
  },
];

type ConfidenceBadge = 'exact' | 'heuristic' | 'AI' | 'unknown';

function confidenceFor(step: TestStep, _i: number, warnings: string[]): ConfidenceBadge {
  if (step.type === 'ai') return 'unknown';
  const w = warnings.find((w) =>
    w.toLowerCase().includes('ai-interpreted') || w.toLowerCase().includes('unrecognized'),
  );
  if (w) return 'heuristic';
  return 'exact';
}

const CONFIDENCE_STYLE: Record<ConfidenceBadge, { color: string; border: string; bg: string; label: string }> = {
  exact: { color: 'var(--pass)', border: 'var(--pass)', bg: 'var(--pass-soft)', label: 'EXACT' },
  heuristic: { color: 'var(--warn)', border: 'var(--warn)', bg: 'var(--warn-soft)', label: 'HEURISTIC' },
  AI: { color: 'var(--accent)', border: 'var(--accent)', bg: 'var(--accent-soft)', label: 'AI' },
  unknown: { color: 'var(--ink-2)', border: 'var(--rule)', bg: 'transparent', label: '?' },
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

// -----------------------------------------------------------------------
// Atoms
// -----------------------------------------------------------------------

// A named dimension callout: mono uppercase label, then the input.
function FieldCallout({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: '24px',
            height: '1px',
            background: 'currentColor',
          }}
        />
        {label}
        {required && <span style={{ color: 'var(--accent)' }}>·REQ</span>}
      </span>
      {children}
      {hint && (
        <span
          className="block"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--ink-2)',
            lineHeight: 1.5,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

// A labeled sheet panel with a leader ("FIG. A · …") at the top.
function Plate({
  leader,
  stamp,
  children,
}: {
  leader: string;
  stamp?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 45%, transparent)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{leader}</span>
        {stamp && <span style={{ color: 'var(--accent)' }}>{stamp}</span>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// Simple tab strip, ruled
function TabStrip({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (v: any) => void;
}) {
  return (
    <div
      className="inline-flex"
      style={{ border: '1px solid var(--rule-strong)' }}
    >
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className="px-4 py-2 transition-colors"
            style={{
              borderRight: i < tabs.length - 1 ? '1px solid var(--rule)' : 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: active ? 'var(--bg-0)' : 'var(--ink-1)',
              background: active ? 'var(--accent)' : 'transparent',
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------
export default function NewTestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const templateSlug = searchParams.get('template');
  const presetFeatureId = searchParams.get('featureId');

  const [activeTab, setActiveTab] = useState<'story' | 'record' | 'script'>('story');

  // Shared test metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<Platform>('WEB');
  const [deviceProfileId, setDeviceProfileId] = useState<string | undefined>();

  // Story tab state
  const [story, setStory] = useState('');
  const [goal, setGoal] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [screenshotEveryStep, setScreenshotEveryStep] = useState(true);
  const [videoRecording, setVideoRecording] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSource, setImportSource] = useState<
    'jira' | 'github' | 'slack' | 'markdown'
  >('markdown');
  const [parsedSteps, setParsedSteps] = useState<TestStep[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [goalResult, setGoalResult] = useState<GoalCompileResult | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const storyRef = useRef<HTMLTextAreaElement | null>(null);

  // Script tab state
  const [scriptMode, setScriptMode] = useState<'natural' | 'yaml'>('yaml');
  const [script, setScript] = useState('');
  const [scriptSteps, setScriptSteps] = useState<TestStep[]>([]);
  const [scriptWarnings, setScriptWarnings] = useState<string[]>([]);

  // Mobile gesture state
  const [mobileSteps, setMobileSteps] = useState<TestStep[]>([]);

  // ---------------------------------------------------------------------
  // Queries (unchanged).
  // ---------------------------------------------------------------------
  const { data: patternData } = useQuery<{ patterns: GoalPattern[] }>({
    queryKey: ['goal-patterns'],
    queryFn: async () => api.get('/tests/goal-patterns'),
  });

  const { data: templateData } = useQuery<{ templates: Template[] }>({
    queryKey: ['templates'],
    queryFn: async () => api.get('/templates'),
  });

  const { data: presetFeature } = useQuery({
    queryKey: ['feature', presetFeatureId],
    queryFn: () => featuresApi.get(presetFeatureId!),
    enabled: !!presetFeatureId,
  });

  const templateApplied = useRef(false);
  useEffect(() => {
    if (templateApplied.current) return;
    if (!templateSlug || !templateData?.templates) return;
    const t = templateData.templates.find((x) => x.slug === templateSlug);
    if (!t) return;
    if (story.trim() || goal.trim() || name.trim()) return;
    setStory(t.storyText);
    if (t.goalText) setGoal(t.goalText);
    setName(t.title);
    templateApplied.current = true;
    toast.success(`Template "${t.title}" loaded — edit the tokens and run`);
  }, [templateSlug, templateData, story, goal, name]);

  // Debounced story preview
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
        /* silent */
      }
    }, 450);
    return () => {
      if (storyDebounce.current) clearTimeout(storyDebounce.current);
    };
  }, [story, activeTab, project?.id]);

  // Debounced goal compile
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
        /* silent */
      }
    }, 400);
    return () => {
      if (goalDebounce.current) clearTimeout(goalDebounce.current);
    };
  }, [goal, project?.id]);

  // ---------------------------------------------------------------------
  // Mutations (unchanged).
  // ---------------------------------------------------------------------
  const storyMutation = useMutation({
    mutationFn: async () =>
      api.post('/tests/story', {
        projectId: project!.id,
        name,
        description: description || undefined,
        story,
        goal: goal || undefined,
        baseUrl: baseUrl || undefined,
        featureId: presetFeatureId || undefined,
        screenshotEveryStep,
        videoRecording,
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Part drafted');
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
      toast.success('Part drafted');
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
    return isMobileNative ? mobileSteps.length > 0 : scriptSteps.length > 0;
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
      <EditorialHero
        width="wide"
        sheet="— · NO PROJECT"
        title={
          <>
            pick a <em>project</em> first.
          </>
        }
        lead="A draft part must belong to a commission. Choose a project from the dashboard to begin a new part."
        back={{ href: '/dashboard', label: 'BACK TO DASHBOARD' }}
      />
    );
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <EditorialHero
      width="wide"
      back={{ href: '/tests', label: 'BACK TO PARTS SCHEDULE' }}
      sheet={`02 · ${project.name?.slice(0, 24) || 'PROJECT'}`}
      eyebrow={`§ ${isoDate} · DRAFTING BRIEF`}
      revision="REV · 00 · NEW"
      title={
        <>
          describe the <em>journey</em>.<br />
          we&apos;ll draft the part.
        </>
      }
      lead={
        <>
          Prose on the left, a live compile on the right, a success goal
          below. Every sentence is badged for confidence before a single
          pixel is captured.
        </>
      }
    >
      {presetFeature && (
        <div
          className="inline-flex items-center gap-3 px-3 py-2"
          style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: 'var(--ink-2)' }}>binding to feature</span>
          <span
            style={{
              color: 'var(--ink-0)',
              fontFamily: 'var(--font-display)',
              textTransform: 'lowercase',
              letterSpacing: '0.02em',
              fontSize: '14px',
            }}
          >
            {presetFeature.name}
          </span>
          <button
            type="button"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('featureId');
              router.replace(url.pathname + url.search);
            }}
            style={{ color: 'var(--ink-2)', cursor: 'pointer' }}
            title="Remove feature link"
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ========== PART IDENTITY ========== */}
        <Plate leader="FIG. A · PART IDENTITY" stamp="REQUIRED">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldCallout label="PART NAME" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="login · happy path"
                className="vt-input"
              />
            </FieldCallout>
            <FieldCallout label="GOAL / DESCRIPTION">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="one-line summary · optional"
                className="vt-input"
              />
            </FieldCallout>
          </div>

          {activeTab !== 'story' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <FieldCallout label="ENVIRONMENT">
                <select
                  value={platform}
                  onChange={(e) => {
                    setPlatform(e.target.value as Platform);
                    setDeviceProfileId(undefined);
                    setScriptSteps([]);
                    setMobileSteps([]);
                    setScript('');
                  }}
                  className="vt-input"
                >
                  <option value="WEB">WEB · PLAYWRIGHT</option>
                  <option value="MOBILE_WEB">MOBILE WEB · EMULATED</option>
                  <option value="IOS">IOS · APPIUM</option>
                  <option value="ANDROID">ANDROID · APPIUM</option>
                </select>
              </FieldCallout>
              <FieldCallout label="DEVICE PROFILE">
                <DeviceSelector
                  projectId={project?.id}
                  platform={platform}
                  value={deviceProfileId}
                  onChange={(id) => setDeviceProfileId(id)}
                  className="w-full"
                />
              </FieldCallout>
            </div>
          )}
        </Plate>

        {/* ========== TAB STRIP ========== */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            AUTHORING MODE
          </span>
          <TabStrip
            tabs={[
              { value: 'story', label: 'STORY' },
              { value: 'record', label: 'RECORD' },
              { value: 'script', label: 'SCRIPT' },
            ]}
            value={activeTab}
            onChange={(v) => setActiveTab(v)}
          />
        </div>

        {/* ========== STORY TAB ========== */}
        {activeTab === 'story' && (
          <>
            {/* Templates strip (only on empty) */}
            {story.trim().length === 0 && (
              <Plate leader="FIG. B · REFERENCE DRAWINGS" stamp="OPTIONAL">
                <div className="space-y-4">
                  {/* Import from bug report */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowImport(!showImport)}
                        className="vt-btn"
                      >
                        {showImport ? 'HIDE IMPORT' : 'IMPORT BUG REPORT'}
                      </button>
                      {showImport && (
                        <select
                          value={importSource}
                          onChange={(e) => setImportSource(e.target.value as any)}
                          className="vt-input"
                          style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
                        >
                          <option value="markdown">MARKDOWN</option>
                          <option value="github">GITHUB ISSUE</option>
                          <option value="jira">JIRA TICKET</option>
                          <option value="slack">SLACK MESSAGE</option>
                        </select>
                      )}
                    </div>
                    {showImport && (
                      <div className="space-y-2">
                        <textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder={`Paste a bug report. We extract steps-to-reproduce as the story, expected as the goal, and actual as NOT-visible assertions.`}
                          className="vt-input"
                          style={{ minHeight: '160px', fontFamily: 'var(--font-mono)' }}
                        />
                        <button
                          type="button"
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
                              if (result.title && !name) setName(result.title);
                              setShowImport(false);
                              setImportText('');
                              toast.success('Bug report imported');
                            } catch (error: any) {
                              toast.error(error.message || 'Import failed');
                            }
                          }}
                          className="vt-btn vt-btn--primary"
                        >
                          EXTRACT
                        </button>
                      </div>
                    )}
                  </div>

                  {templateData?.templates && templateData.templates.length > 0 && (
                    <div className="space-y-3">
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          color: 'var(--accent)',
                        }}
                      >
                        — TEMPLATES —
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
                                .post(`/templates/${t.slug}/pick`, { projectId: project?.id })
                                .catch(() => {});
                            }}
                            className="vt-btn"
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
                          className="vt-btn vt-btn--ghost"
                          style={{ borderStyle: 'dashed', borderColor: 'var(--rule)' }}
                        >
                          BLANK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Plate>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT — the journey */}
              <Plate leader="FIG. C · JOURNEY (PROSE)" stamp="ONE LINE · ONE ACTION">
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      ref={storyRef}
                      value={story}
                      onChange={(e) => {
                        setStory(e.target.value);
                        const textarea = e.target;
                        const cursor = textarea.selectionStart;
                        const before = textarea.value.slice(0, cursor);
                        const lineStart = before.lastIndexOf('\n') + 1;
                        const line = before.slice(lineStart);
                        setSlashOpen(/^\/[a-z]*$/i.test(line));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setSlashOpen(false);
                      }}
                      placeholder={STORY_PLACEHOLDER}
                      className="vt-input"
                      style={{
                        minHeight: '300px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        lineHeight: 1.55,
                      }}
                    />
                    {slashOpen && (
                      <div
                        className="absolute left-0 right-0 top-0 -translate-y-full max-h-64 overflow-y-auto"
                        style={{
                          border: '1px solid var(--rule-strong)',
                          background: 'var(--bg-1)',
                          marginBottom: '4px',
                        }}
                      >
                        {SLASH_COMMANDS.filter((c) => {
                          const textarea = storyRef.current;
                          if (!textarea) return true;
                          const cursor = textarea.selectionStart;
                          const before = textarea.value.slice(0, cursor);
                          const lineStart = before.lastIndexOf('\n') + 1;
                          const line = before.slice(lineStart);
                          return c.key.startsWith(line.toLowerCase());
                        }).map((cmd) => (
                          <button
                            type="button"
                            key={cmd.key}
                            className="w-full text-left px-3 py-2 transition-colors"
                            style={{
                              borderBottom: '1px solid var(--rule-soft)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: 'var(--ink-1)',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = 'var(--bg-2)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = 'transparent')
                            }
                            onClick={() => {
                              const textarea = storyRef.current;
                              if (!textarea) return;
                              const cursor = textarea.selectionStart;
                              const before = textarea.value.slice(0, cursor);
                              const after = textarea.value.slice(cursor);
                              const lineStart = before.lastIndexOf('\n') + 1;
                              const newVal =
                                before.slice(0, lineStart) + cmd.template + after;
                              setStory(newVal);
                              setSlashOpen(false);
                              requestAnimationFrame(() => {
                                textarea.focus();
                                const pos = lineStart + cmd.template.length;
                                textarea.setSelectionRange(pos, pos);
                              });
                            }}
                          >
                            <div className="flex items-baseline gap-2">
                              <span style={{ color: 'var(--accent)' }}>{cmd.label}</span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  letterSpacing: '0.14em',
                                  textTransform: 'uppercase',
                                  color: 'var(--ink-2)',
                                }}
                              >
                                {cmd.description}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--ink-2)',
                                marginTop: '2px',
                              }}
                            >
                              {cmd.template.split('\n')[0]}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <FieldCallout
                    label="BASE URL (OPTIONAL)"
                    hint={`Prepended to relative paths ("/orders" → "${
                      baseUrl || 'https://…'
                    }/orders").`}
                  >
                    <input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://app.example.com"
                      className="vt-input"
                    />
                  </FieldCallout>

                  {/* Capture toggles */}
                  <div
                    className="pt-4 space-y-3"
                    style={{ borderTop: '1px solid var(--rule)' }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      CAPTURE SPEC
                    </div>
                    <label
                      className="flex items-start gap-3 cursor-pointer"
                      style={{ fontSize: '13px', color: 'var(--ink-1)' }}
                    >
                      <input
                        type="checkbox"
                        checked={screenshotEveryStep}
                        onChange={(e) => setScreenshotEveryStep(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <span style={{ color: 'var(--ink-0)' }}>
                          Screenshot every step.
                        </span>
                        <br />
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--ink-2)',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.08em',
                          }}
                        >
                          Required for film-strip and Set-as-baseline.
                        </span>
                      </span>
                    </label>
                    <label
                      className="flex items-start gap-3 cursor-pointer"
                      style={{ fontSize: '13px', color: 'var(--ink-1)' }}
                    >
                      <input
                        type="checkbox"
                        checked={videoRecording}
                        onChange={(e) => setVideoRecording(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <span style={{ color: 'var(--ink-0)' }}>Record video.</span>
                        <br />
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--ink-2)',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.08em',
                          }}
                        >
                          Heavier; useful for flakiness forensics.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </Plate>

              {/* RIGHT — compiled preview */}
              <Plate
                leader="FIG. D · COMPILE PREVIEW"
                stamp={
                  parsedSteps.length > 0
                    ? `${String(parsedSteps.length).padStart(2, '0')} STEPS`
                    : 'AWAITING INPUT'
                }
              >
                {parsedSteps.length === 0 ? (
                  <div
                    className="py-16 text-center"
                    style={{
                      border: '1px dashed var(--rule)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-2)',
                      lineHeight: 1.8,
                    }}
                  >
                    — preview will render —<br />
                    — once you begin the journey —
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {parsedSteps.map((step, i) => {
                      const badge = confidenceFor(step, i, parseWarnings);
                      const s = CONFIDENCE_STYLE[badge];
                      return (
                        <div
                          key={i}
                          className="grid items-start gap-3 py-1.5 px-2"
                          style={{
                            gridTemplateColumns: '32px 78px 1fr',
                            borderBottom:
                              i < parsedSteps.length - 1
                                ? '1px dashed var(--rule-soft)'
                                : 'none',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--accent)',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              letterSpacing: '0.12em',
                            }}
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span
                            className="text-center"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '9px',
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              color: s.color,
                              border: `1px solid ${s.border}`,
                              background: s.bg,
                              padding: '3px 6px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                            title={badge === 'unknown' ? 'DOM analysis at runtime' : badge}
                          >
                            {s.label}
                          </span>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: 'var(--ink-1)',
                            }}
                          >
                            <span style={{ color: 'var(--ink-0)' }}>{step.type}</span>
                            <span style={{ color: 'var(--ink-2)' }}>
                              {' '}
                              · {step.url || step.selector || step.value || '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {parseWarnings.length > 0 && (
                      <div
                        className="mt-3 pt-3 space-y-1"
                        style={{
                          borderTop: '1px solid var(--rule)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10.5px',
                          letterSpacing: '0.08em',
                          color: 'var(--warn)',
                        }}
                      >
                        {parseWarnings.slice(0, 3).map((w, i) => (
                          <div key={i}>⚠ {w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Plate>
            </div>

            {/* Goal block */}
            <Plate
              leader="FIG. E · SUCCESS GOAL"
              stamp={
                goalResult
                  ? goalResult.canSave
                    ? 'COMPILES'
                    : 'BLOCKED'
                  : 'OPTIONAL'
              }
            >
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--ink-1)',
                    maxWidth: '62ch',
                    lineHeight: 1.5,
                  }}
                >
                  What must be true when this part passes? Leave blank for
                  plain step-based pass/fail.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPatternHelp(!showPatternHelp)}
                  className="vt-btn"
                >
                  {showPatternHelp ? 'HIDE PATTERNS' : 'SHOW PATTERNS'}
                </button>
              </div>

              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={GOAL_PLACEHOLDER}
                className="vt-input"
                style={{ minHeight: '120px', fontFamily: 'var(--font-mono)' }}
              />

              {showPatternHelp && patternData?.patterns && (
                <div
                  className="mt-4 p-4"
                  style={{ border: '1px dashed var(--rule)' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                      marginBottom: '10px',
                    }}
                  >
                    LAYER-1 PATTERN VOCABULARY · NO AI REQUIRED
                  </div>
                  <div className="grid gap-2">
                    {patternData.patterns.map((p) => (
                      <div key={p.pattern}>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: 'var(--ink-0)',
                          }}
                        >
                          {p.pattern}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-hand)',
                            fontSize: '14px',
                            color: 'var(--accent)',
                          }}
                        >
                          e.g. {p.example}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {goalResult && (
                <div className="mt-4 space-y-2">
                  {goalResult.checks.length > 0 && (
                    <div
                      className="flex items-start gap-2 p-3"
                      style={{
                        border: '1px solid var(--pass)',
                        background: 'var(--pass-soft)',
                        color: 'var(--pass)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                      <div>
                        {goalResult.checks.length} VERIFIABLE CHECK
                        {goalResult.checks.length === 1 ? '' : 'S'} WILL RUN.
                      </div>
                    </div>
                  )}
                  {goalResult.unresolvedClauses.length > 0 && (
                    <div
                      className="p-3"
                      style={{
                        border: `1px solid ${
                          goalResult.canSave ? 'var(--accent)' : 'var(--fail)'
                        }`,
                        background: goalResult.canSave
                          ? 'var(--accent-soft)'
                          : 'var(--fail-soft)',
                      }}
                    >
                      <div
                        className="flex items-start gap-2"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: goalResult.canSave ? 'var(--accent)' : 'var(--fail)',
                        }}
                      >
                        {goalResult.canSave ? (
                          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        ) : (
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        )}
                        <div className="space-y-1">
                          <div>
                            {goalResult.canSave
                              ? `${goalResult.unresolvedClauses.length} CLAUSE${
                                  goalResult.unresolvedClauses.length === 1 ? '' : 'S'
                                } WILL RUN VIA LLM AT RUNTIME.`
                              : `${goalResult.unresolvedClauses.length} CLAUSE${
                                  goalResult.unresolvedClauses.length === 1 ? '' : 'S'
                                } CANNOT VERIFY WITHOUT AN LLM.`}
                          </div>
                          <ul
                            style={{
                              fontFamily: 'var(--font-hand)',
                              fontSize: '15px',
                              color: 'var(--ink-1)',
                              fontStyle: 'italic',
                            }}
                          >
                            {goalResult.unresolvedClauses.map((c, i) => (
                              <li key={i}>· &ldquo;{c}&rdquo;</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Plate>

            {/* Actions */}
            <div
              className="flex items-center justify-end gap-3 pt-4"
              style={{ borderTop: '1px solid var(--rule)' }}
            >
              <button
                type="button"
                onClick={() => router.push('/tests')}
                className="vt-btn vt-btn--ghost"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={!canSaveStory || storyMutation.isPending}
                className="vt-btn vt-btn--primary"
                style={{ opacity: !canSaveStory || storyMutation.isPending ? 0.5 : 1 }}
              >
                {storyMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> DRAFTING…
                  </>
                ) : (
                  'DRAFT PART'
                )}
              </button>
            </div>
          </>
        )}

        {/* ========== RECORD TAB ========== */}
        {activeTab === 'record' && (
          <Plate leader="FIG. B · RECORDING" stamp="NOT YET WIRED">
            <div
              className="py-16 text-center space-y-4"
              style={{ border: '1px dashed var(--rule)' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                · · · RECORD MODE · · ·
              </div>
              <div
                className="vt-display"
                style={{ fontSize: '28px', color: 'var(--ink-1)' }}
              >
                coming in a later <em>revision</em>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink-2)',
                  maxWidth: '54ch',
                  margin: '0 auto',
                }}
              >
                A browser extension watches real clicks and compiles them to
                steps. For now, use STORY (prose) or SCRIPT (YAML / JSON).
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('story')}
                className="vt-btn"
              >
                SWITCH TO STORY
              </button>
            </div>
          </Plate>
        )}

        {/* ========== SCRIPT TAB ========== */}
        {activeTab === 'script' && (
          <>
            <Plate
              leader="FIG. B · SCRIPT SOURCE"
              stamp={scriptMode === 'yaml' ? 'YAML' : 'NATURAL'}
            >
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <TabStrip
                  tabs={[
                    { value: 'yaml', label: 'YAML' },
                    { value: 'natural', label: 'NATURAL' },
                  ]}
                  value={scriptMode}
                  onChange={(v) => setScriptMode(v)}
                />
                <button
                  type="button"
                  onClick={() => setScript(YAML_EXAMPLE)}
                  className="vt-btn vt-btn--ghost"
                >
                  LOAD YAML EXAMPLE
                </button>
              </div>

              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={
                  scriptMode === 'yaml'
                    ? YAML_EXAMPLE
                    : 'Plain-English · one step per line.'
                }
                className="vt-input"
                style={{
                  minHeight: '260px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                }}
              />
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={parseScript}
                  disabled={!script.trim()}
                  className="vt-btn"
                  style={{ opacity: !script.trim() ? 0.4 : 1 }}
                >
                  <Wand2 className="w-3.5 h-3.5" strokeWidth={1.5} /> PARSE
                </button>
              </div>

              {scriptWarnings.length > 0 && (
                <div
                  className="mt-4 p-3"
                  style={{ border: '1px solid var(--warn)', background: 'var(--warn-soft)' }}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--warn)',
                      marginBottom: '8px',
                    }}
                  >
                    <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
                    WARNINGS
                  </div>
                  <ul
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--ink-1)',
                    }}
                  >
                    {scriptWarnings.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Plate>

            {isMobileNative && (
              <Plate leader="FIG. C · TOUCH GESTURES" stamp="NATIVE">
                <TouchGestureRecorder
                  steps={mobileSteps}
                  onAddStep={(step) => setMobileSteps([...mobileSteps, step])}
                  onRemoveStep={(index) =>
                    setMobileSteps(mobileSteps.filter((_, i) => i !== index))
                  }
                />
              </Plate>
            )}

            {scriptSteps.length > 0 && !isMobileNative && (
              <Plate
                leader="FIG. C · COMPILED STEPS"
                stamp={`${String(scriptSteps.length).padStart(2, '0')} STEPS`}
              >
                <StepEditor
                  steps={scriptSteps}
                  platform={platform}
                  onChange={(s) => setScriptSteps(s)}
                />
              </Plate>
            )}

            <div
              className="flex items-center justify-end gap-3 pt-4"
              style={{ borderTop: '1px solid var(--rule)' }}
            >
              <button
                type="button"
                onClick={() => router.push('/tests')}
                className="vt-btn vt-btn--ghost"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={!canSaveScript || scriptMutation.isPending}
                className="vt-btn vt-btn--primary"
                style={{ opacity: !canSaveScript || scriptMutation.isPending ? 0.5 : 1 }}
              >
                {scriptMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> DRAFTING…
                  </>
                ) : (
                  'DRAFT PART'
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </EditorialHero>
  );
}
