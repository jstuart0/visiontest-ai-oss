'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Copy,
  Globe,
  Layers,
  Loader2,
  Monitor,
  Plus,
  Settings,
  Smartphone,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WizardShell } from '@/components/wizards/WizardShell';
import type { WizardDefinition, WizardStepProps } from '@/components/wizards/WizardShell';
import { WizardStepLayout } from '@/components/wizards/WizardStepLayout';
import { WizardSuccessState } from '@/components/wizards/WizardSuccessState';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface StorybookWizardState {
  mode: 'cli' | 'connected' | 'hybrid';
  storybookUrl: string;
  viewports: Array<{ name: string; width: number; height: number }>;
  includePatterns: string;
  excludePatterns: string;
  waitAfterLoadMs: number;
  syncMode: 'manual' | 'polling' | 'webhook';
  connectionTested: boolean;
  connectionResult: { connected: boolean; storyCount?: number; error?: string } | null;
}

const DEFAULT_STATE: StorybookWizardState = {
  mode: 'cli',
  storybookUrl: '',
  viewports: [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 375, height: 812 },
  ],
  includePatterns: '',
  excludePatterns: '',
  waitAfterLoadMs: 500,
  syncMode: 'manual',
  connectionTested: false,
  connectionResult: null,
};

// ---------------------------------------------------------------------------
// Mode option definitions
// ---------------------------------------------------------------------------

const MODE_OPTIONS: Array<{
  value: StorybookWizardState['mode'];
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}> = [
  {
    value: 'cli',
    title: 'CLI',
    description: 'Screenshots taken in CI, uploaded to VisionTest',
    icon: Terminal,
    recommended: true,
  },
  {
    value: 'connected',
    title: 'Connected',
    description: 'VisionTest connects to a live Storybook URL',
    icon: Globe,
  },
  {
    value: 'hybrid',
    title: 'Hybrid',
    description: 'Upload static build, VisionTest takes screenshots',
    icon: Layers,
  },
];

// ---------------------------------------------------------------------------
// Step 1: Choose Mode
// ---------------------------------------------------------------------------

function ChooseModeStep({ state, updateState }: WizardStepProps<StorybookWizardState>) {
  return (
    <WizardStepLayout
      title="Choose Integration Mode"
      description="How should VisionTest capture Storybook screenshots?"
    >
      <div className="grid gap-3">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = state.mode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                updateState({
                  mode: option.value,
                  // Reset connection state when switching modes
                  connectionTested: false,
                  connectionResult: null,
                })
              }
              className={cn(
                'flex items-start gap-4 rounded-lg p-4 text-left transition-colors',
                isSelected
                  ? 'border-2 border-blue-500 bg-blue-500/5'
                  : 'border-2 border-border hover:border-border/80'
              )}
            >
              {/* Radio dot */}
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40">
                {isSelected && (
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                )}
              </div>

              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{option.title}</span>
                    {option.recommended && (
                      <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Source Details
// ---------------------------------------------------------------------------

const CLI_SNIPPET = `npx visiontest storybook capture \\
  --static-dir ./storybook-static \\
  --upload --fail-on-breaking`;

function SourceDetailsStep({ state, updateState, validationError }: WizardStepProps<StorybookWizardState>) {
  const { project } = useCurrentProject();
  const [testingConnection, setTestingConnection] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(CLI_SNIPPET);
    toast.success('Copied to clipboard');
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (!state.storybookUrl || !project?.id) return;
    setTestingConnection(true);
    try {
      const result = await api.post<{ connected: boolean; storyCount?: number; error?: string }>(
        '/storybook/test-connection',
        { projectId: project.id, storybookUrl: state.storybookUrl }
      );
      updateState({
        connectionTested: true,
        connectionResult: result,
      });
      if (result.connected) {
        toast.success(`Connected - ${result.storyCount} stories found`);
      }
    } catch (err: any) {
      updateState({
        connectionTested: true,
        connectionResult: { connected: false, error: err.message || 'Connection failed' },
      });
    } finally {
      setTestingConnection(false);
    }
  }, [state.storybookUrl, project?.id, updateState]);

  if (state.mode === 'cli') {
    return (
      <WizardStepLayout
        title="CLI Setup"
        description="Add this command to your CI pipeline to capture and upload Storybook screenshots."
      >
        <div className="space-y-4">
          <div className="relative">
            <pre className="text-sm bg-muted p-4 rounded-lg font-mono overflow-x-auto text-foreground">
              {CLI_SNIPPET}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            You can skip this step and run the CLI command later. The integration will be
            configured when you complete the wizard.
          </p>
        </div>
      </WizardStepLayout>
    );
  }

  // Connected or Hybrid mode
  return (
    <WizardStepLayout
      title={state.mode === 'connected' ? 'Storybook URL' : 'Static Build URL'}
      description={
        state.mode === 'connected'
          ? 'Enter the URL of your running Storybook instance.'
          : 'Enter the URL where your static Storybook build is hosted.'
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="storybook-url">Storybook URL</Label>
          <div className="flex items-center gap-2">
            <Input
              id="storybook-url"
              value={state.storybookUrl}
              onChange={(e) =>
                updateState({
                  storybookUrl: e.target.value,
                  connectionTested: false,
                  connectionResult: null,
                })
              }
              placeholder="https://storybook.staging.myapp.com"
              className="bg-muted border-border text-foreground"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection || !state.storybookUrl.trim()}
              className="shrink-0"
            >
              {testingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              <span className="ml-1.5">Test</span>
            </Button>
          </div>
        </div>

        {/* Connection result */}
        {state.connectionResult && (
          <div
            className={cn(
              'flex items-start gap-2 text-sm rounded-lg px-4 py-3',
              state.connectionResult.connected
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            )}
          >
            {state.connectionResult.connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Connected successfully — {state.connectionResult.storyCount} stories found
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{state.connectionResult.error || 'Could not connect to Storybook'}</span>
              </>
            )}
          </div>
        )}

        {validationError && !state.connectionResult && (
          <p className="text-sm text-red-500">{validationError}</p>
        )}
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Configure Options
// ---------------------------------------------------------------------------

function ConfigureOptionsStep({ state, updateState }: WizardStepProps<StorybookWizardState>) {
  const addViewport = () => {
    updateState({
      viewports: [...state.viewports, { name: 'Tablet', width: 768, height: 1024 }],
    });
  };

  const removeViewport = (index: number) => {
    updateState({
      viewports: state.viewports.filter((_, i) => i !== index),
    });
  };

  const updateViewport = (index: number, field: keyof (typeof state.viewports)[0], value: string | number) => {
    const updated = [...state.viewports];
    updated[index] = { ...updated[index], [field]: value };
    updateState({ viewports: updated });
  };

  return (
    <WizardStepLayout
      title="Configure Options"
      description="Set viewport sizes, story filters, and timing options."
    >
      <div className="space-y-6">
        {/* Viewports */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Viewport Sizes</Label>
            <Button variant="outline" size="sm" onClick={addViewport}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Each story is captured at every viewport size.
          </p>
          <div className="space-y-2">
            {state.viewports.map((vp, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={vp.name}
                  onChange={(e) => updateViewport(i, 'name', e.target.value)}
                  className="w-32 bg-muted border-border text-foreground"
                  placeholder="Name"
                />
                <Input
                  type="number"
                  value={vp.width}
                  onChange={(e) => updateViewport(i, 'width', parseInt(e.target.value) || 0)}
                  className="w-24 bg-muted border-border text-foreground"
                  placeholder="Width"
                />
                <span className="text-muted-foreground text-sm">x</span>
                <Input
                  type="number"
                  value={vp.height}
                  onChange={(e) => updateViewport(i, 'height', parseInt(e.target.value) || 0)}
                  className="w-24 bg-muted border-border text-foreground"
                  placeholder="Height"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onClick={() => removeViewport(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {state.viewports.length === 0 && (
              <p className="text-sm text-muted-foreground italic py-2">
                No viewports configured. Add at least one.
              </p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="include-patterns">Include patterns (glob, comma-separated)</Label>
            <Input
              id="include-patterns"
              value={state.includePatterns}
              onChange={(e) => updateState({ includePatterns: e.target.value })}
              placeholder="Leave empty to include all stories"
              className="bg-muted border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exclude-patterns">Exclude patterns (glob, comma-separated)</Label>
            <Input
              id="exclude-patterns"
              value={state.excludePatterns}
              onChange={(e) => updateState({ excludePatterns: e.target.value })}
              placeholder="*--docs"
              className="bg-muted border-border text-foreground"
            />
          </div>
        </div>

        {/* Wait time */}
        <div className="space-y-2">
          <Label htmlFor="wait-time">Wait after page load (ms)</Label>
          <Input
            id="wait-time"
            type="number"
            value={state.waitAfterLoadMs}
            onChange={(e) => updateState({ waitAfterLoadMs: parseInt(e.target.value) || 0 })}
            className="w-32 bg-muted border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Time to wait after each story loads before taking a screenshot. Increase if stories
            have animations or async content.
          </p>
        </div>
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review & Connect
// ---------------------------------------------------------------------------

function ReviewStep({ state }: WizardStepProps<StorybookWizardState>) {
  const modeLabel = MODE_OPTIONS.find((m) => m.value === state.mode)?.title ?? state.mode;

  return (
    <WizardStepLayout
      title="Review & Connect"
      description="Review your configuration before saving."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border divide-y divide-border">
          <SummaryRow label="Integration Mode" value={modeLabel} />
          {state.mode !== 'cli' && (
            <SummaryRow label="Storybook URL" value={state.storybookUrl || '-'} />
          )}
          <SummaryRow
            label="Viewports"
            value={
              state.viewports.length > 0
                ? state.viewports.map((v) => `${v.name} (${v.width}x${v.height})`).join(', ')
                : 'None'
            }
          />
          {state.includePatterns && (
            <SummaryRow label="Include" value={state.includePatterns} />
          )}
          {state.excludePatterns && (
            <SummaryRow label="Exclude" value={state.excludePatterns} />
          )}
          <SummaryRow label="Wait after load" value={`${state.waitAfterLoadMs}ms`} />
        </div>

        {state.mode !== 'cli' && (
          <p className="text-sm text-muted-foreground">
            After saving, VisionTest will sync stories from your Storybook instance.
          </p>
        )}
      </div>
    </WizardStepLayout>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StorybookWizardPage() {
  const router = useRouter();
  const { project } = useCurrentProject();
  const [completed, setCompleted] = useState(false);
  const [completedState, setCompletedState] = useState<StorybookWizardState | null>(null);

  const definition: WizardDefinition<StorybookWizardState> = {
    id: 'storybook-connect',
    title: 'Connect Storybook',
    description: 'Set up Storybook integration for visual regression testing.',
    estimatedMinutes: 3,
    initialState: DEFAULT_STATE,
    steps: [
      {
        id: 'mode',
        title: 'Choose Mode',
        description: 'Select how to integrate Storybook',
        icon: BookOpen,
        render: ChooseModeStep,
      },
      {
        id: 'source',
        title: 'Source Details',
        description: 'Configure the Storybook source',
        icon: Globe,
        validate: (state) => {
          if (state.mode !== 'cli' && !state.storybookUrl.trim()) {
            return { valid: false, message: 'Please enter a Storybook URL.' };
          }
          return { valid: true };
        },
        render: SourceDetailsStep,
      },
      {
        id: 'options',
        title: 'Options',
        description: 'Configure viewports, filters, and timing',
        icon: Settings,
        render: ConfigureOptionsStep,
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Review and save your configuration',
        icon: CheckCircle2,
        render: ReviewStep,
      },
    ],
    onComplete: async (state) => {
      if (!project?.id) {
        throw new Error('No project selected. Please select a project first.');
      }

      // Save configuration
      await api.put('/storybook/config', {
        projectId: project.id,
        enabled: true,
        mode: state.mode,
        storybookUrl: state.storybookUrl || undefined,
        viewports: state.viewports,
        includePatterns: state.includePatterns
          ? state.includePatterns.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        excludePatterns: state.excludePatterns
          ? state.excludePatterns.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        waitAfterLoadMs: state.waitAfterLoadMs,
        syncMode: state.syncMode,
      });

      // For connected/hybrid modes, trigger an initial sync
      if (state.mode !== 'cli') {
        try {
          await api.post('/storybook/sync', { projectId: project.id });
          toast.success('Storybook synced successfully');
        } catch {
          toast.info('Configuration saved. Story sync can be triggered from settings.');
        }
      } else {
        toast.success('Storybook integration configured');
      }

      setCompletedState(state);
      setCompleted(true);
    },
    onCancel: () => {
      router.push('/settings/storybook');
    },
  };

  // -------------------------------------------------------------------------
  // Success view
  // -------------------------------------------------------------------------

  if (completed && completedState) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/settings/storybook"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Storybook Settings
        </Link>

        <WizardSuccessState
          title="Storybook Connected"
          description={
            completedState.mode === 'cli'
              ? 'Your Storybook integration is configured. Run the CLI command in your CI pipeline to start capturing screenshots.'
              : `Your Storybook integration is configured and stories have been synced.`
          }
          actions={[
            {
              label: 'View Stories',
              href: '/storybook',
            },
            {
              label: 'Open Settings',
              href: '/settings/storybook',
              variant: 'outline',
            },
          ]}
          details={[
            {
              label: 'Mode',
              value: MODE_OPTIONS.find((m) => m.value === completedState.mode)?.title ?? completedState.mode,
            },
            ...(completedState.mode !== 'cli'
              ? [{ label: 'URL', value: completedState.storybookUrl }]
              : []),
            {
              label: 'Viewports',
              value: `${completedState.viewports.length} configured`,
            },
          ]}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Wizard view
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <Link
          href="/settings/storybook"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Storybook Settings
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Connect Storybook</h1>
      </div>

      <WizardShell definition={definition} />
    </div>
  );
}
