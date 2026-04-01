'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Scale,
  Brain,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Layers,
  Plug,
  ToggleRight,
  ClipboardCheck,
  Gauge,
  Shield,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { WizardShell, type WizardDefinition, type WizardStepProps } from '@/components/wizards/WizardShell';
import { WizardStepLayout } from '@/components/wizards/WizardStepLayout';
import { WizardSuccessState } from '@/components/wizards/WizardSuccessState';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AiDiffWizardState {
  maxStage: 1 | 2 | 3;
  sidecarUrl: string;
  autoApproveNoise: boolean;
  autoApproveMinor: boolean;
  escalateBreaking: boolean;
  sidecarTested: boolean;
  sidecarResult: {
    connected: boolean;
    latencyMs?: number;
    gpuAvailable?: boolean;
    modelsLoaded?: string[];
    error?: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Step 1 -- Choose Analysis Depth
// ---------------------------------------------------------------------------

interface TierOption {
  stage: 1 | 2 | 3;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  detail: string;
  speed: string;
  accuracy: string;
  cost: string;
  recommended?: boolean;
}

const TIERS: TierOption[] = [
  {
    stage: 1,
    label: 'Fast',
    sublabel: 'Stage 1',
    icon: Zap,
    description: 'SSIM + LPIPS only',
    detail: 'Best for high-volume pipelines with low noise tolerance',
    speed: '~50ms',
    accuracy: 'Good',
    cost: 'Free',
  },
  {
    stage: 2,
    label: 'Balanced',
    sublabel: 'Stage 2',
    icon: Scale,
    description: 'Adds DINOv2 embeddings',
    detail: 'Recommended for most teams -- catches real changes, filters noise',
    speed: '~200ms',
    accuracy: 'Great',
    cost: 'Low',
    recommended: true,
  },
  {
    stage: 3,
    label: 'Deep',
    sublabel: 'Stage 3',
    icon: Brain,
    description: 'Full VLM analysis',
    detail: 'Maximum accuracy with AI-powered semantic analysis',
    speed: '~5s',
    accuracy: 'Best',
    cost: 'Moderate',
  },
];

function ChooseDepthStep({ state, updateState }: WizardStepProps<AiDiffWizardState>) {
  return (
    <WizardStepLayout
      title="Choose Analysis Depth"
      description="Select how deeply the AI pipeline should analyze visual diffs. You can change this later in settings."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const Icon = tier.icon;
          const selected = state.maxStage === tier.stage;
          return (
            <button
              key={tier.stage}
              type="button"
              onClick={() => updateState({ maxStage: tier.stage, sidecarTested: false, sidecarResult: null })}
              className={cn(
                'relative rounded-lg p-5 text-left transition-all',
                selected
                  ? 'border-2 border-blue-500 bg-blue-500/5'
                  : 'border-2 border-border hover:border-border/80',
              )}
            >
              {tier.recommended && (
                <Badge className="absolute -top-2.5 right-3 bg-blue-600 hover:bg-blue-600 text-white text-[10px]">
                  Recommended
                </Badge>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center',
                    selected ? 'bg-blue-500/15 text-blue-500' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{tier.label}</div>
                  <div className="text-[11px] text-muted-foreground">{tier.sublabel}</div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{tier.description}</p>
              <p className="text-xs text-muted-foreground/80 mb-4">{tier.detail}</p>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Gauge className="h-3 w-3" />
                  {tier.speed}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Shield className="h-3 w-3" />
                  {tier.accuracy}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Sparkles className="h-3 w-3" />
                  {tier.cost}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 2 -- Connect Sidecar
// ---------------------------------------------------------------------------

function ConnectSidecarStep({ state, updateState, validationError }: WizardStepProps<AiDiffWizardState>) {
  const { project } = useCurrentProject();
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    if (!project?.id) return;
    setTesting(true);
    try {
      const result = await api.post<{
        connected: boolean;
        latencyMs?: number;
        gpuAvailable?: boolean;
        modelsLoaded?: string[];
        error?: string;
      }>('/ai-diff/test-sidecar', { projectId: project.id });
      updateState({ sidecarTested: true, sidecarResult: result });
      if (result.connected) {
        toast.success('Sidecar connected successfully');
      } else {
        toast.error(result.error || 'Could not connect to sidecar');
      }
    } catch (err: any) {
      updateState({
        sidecarTested: true,
        sidecarResult: { connected: false, error: err.message || 'Connection failed' },
      });
      toast.error(err.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <WizardStepLayout
      title="Connect Embeddings Sidecar"
      description="The sidecar runs DINOv2 and VLM models. Enter its URL and test the connection."
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="sidecar-url">Sidecar URL</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Input
              id="sidecar-url"
              value={state.sidecarUrl}
              onChange={(e) => updateState({ sidecarUrl: e.target.value, sidecarTested: false, sidecarResult: null })}
              placeholder="http://visiontest-embeddings:8100"
              className="bg-muted border-border text-foreground"
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !state.sidecarUrl.trim()}
              className="shrink-0"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              <span className="ml-2">{testing ? 'Testing...' : 'Test'}</span>
            </Button>
          </div>
        </div>

        {state.sidecarResult && (
          <div
            className={cn(
              'rounded-lg border p-4 space-y-2',
              state.sidecarResult.connected
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5',
            )}
          >
            <div className="flex items-center gap-2">
              {state.sidecarResult.connected ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span
                className={cn(
                  'font-medium text-sm',
                  state.sidecarResult.connected ? 'text-green-500' : 'text-red-500',
                )}
              >
                {state.sidecarResult.connected ? 'Connected' : 'Connection Failed'}
              </span>
            </div>

            {state.sidecarResult.connected && (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Latency</span>
                  <p className="font-medium text-foreground">{state.sidecarResult.latencyMs}ms</p>
                </div>
                <div>
                  <span className="text-muted-foreground">GPU</span>
                  <p className="font-medium text-foreground">
                    {state.sidecarResult.gpuAvailable ? 'Available' : 'CPU only'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Models</span>
                  <p className="font-medium text-foreground">
                    {state.sidecarResult.modelsLoaded?.length || 0} loaded
                  </p>
                </div>
              </div>
            )}

            {state.sidecarResult.error && (
              <p className="text-sm text-red-400">{state.sidecarResult.error}</p>
            )}
          </div>
        )}

        {validationError && (
          <p className="text-sm text-red-500">{validationError}</p>
        )}
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 3 -- Automation Defaults
// ---------------------------------------------------------------------------

const AUTOMATION_OPTIONS = [
  {
    key: 'autoApproveNoise' as const,
    label: 'Auto-approve NOISE diffs',
    description: 'Automatically approve diffs classified as rendering noise',
  },
  {
    key: 'autoApproveMinor' as const,
    label: 'Auto-approve MINOR diffs',
    description: 'Automatically approve minor visual changes',
  },
  {
    key: 'escalateBreaking' as const,
    label: 'Auto-escalate BREAKING diffs',
    description: 'Automatically flag breaking changes for review',
  },
] as const;

function AutomationStep({ state, updateState }: WizardStepProps<AiDiffWizardState>) {
  return (
    <WizardStepLayout
      title="Automation Defaults"
      description="Choose how the system should respond to each classification. You can fine-tune these later."
    >
      <div className="space-y-4">
        {AUTOMATION_OPTIONS.map((opt) => (
          <div key={opt.key} className="flex items-center justify-between">
            <div>
              <Label>{opt.label}</Label>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
            <Switch
              checked={state[opt.key]}
              onCheckedChange={(v) => updateState({ [opt.key]: v } as Partial<AiDiffWizardState>)}
            />
          </div>
        ))}
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Step 4 -- Review & Enable
// ---------------------------------------------------------------------------

function ReviewStep({ state }: WizardStepProps<AiDiffWizardState>) {
  const tierInfo = TIERS.find((t) => t.stage === state.maxStage)!;
  const TierIcon = tierInfo.icon;

  return (
    <WizardStepLayout
      title="Review & Enable"
      description="Confirm your configuration. Clicking Complete Setup will save and enable AI Visual Diff."
    >
      <div className="space-y-5">
        {/* Depth tier */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <TierIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Analysis Depth</p>
              <p className="text-xs text-muted-foreground">
                {tierInfo.label} ({tierInfo.sublabel}) -- {tierInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* Sidecar */}
        {state.maxStage > 1 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground mb-1">Embeddings Sidecar</p>
            <p className="text-xs text-muted-foreground font-mono">{state.sidecarUrl}</p>
            {state.sidecarResult?.connected && (
              <div className="flex items-center gap-1 mt-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-green-500">
                  Connected ({state.sidecarResult.latencyMs}ms)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Automation */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-sm font-medium text-foreground mb-2">Automation</p>
          {AUTOMATION_OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{opt.label}</span>
              <Badge variant={state[opt.key] ? 'default' : 'outline'} className="text-[11px]">
                {state[opt.key] ? 'On' : 'Off'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </WizardStepLayout>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AiDiffWizardPage() {
  const { project } = useCurrentProject();
  const router = useRouter();
  const [completed, setCompleted] = useState(false);
  const [savedState, setSavedState] = useState<AiDiffWizardState | null>(null);

  const definition: WizardDefinition<AiDiffWizardState> = {
    id: 'ai-diff-setup',
    title: 'Set Up AI Visual Diff',
    description: 'Configure AI-powered visual difference analysis for your project.',
    estimatedMinutes: 3,
    initialState: {
      maxStage: 2,
      sidecarUrl: 'http://visiontest-embeddings:8100',
      autoApproveNoise: false,
      autoApproveMinor: false,
      escalateBreaking: true,
      sidecarTested: false,
      sidecarResult: null,
    },
    steps: [
      {
        id: 'depth',
        title: 'Analysis Depth',
        description: 'Choose how deeply the AI pipeline analyzes visual diffs.',
        icon: Layers,
        render: ChooseDepthStep,
      },
      {
        id: 'sidecar',
        title: 'Connect Sidecar',
        description: 'Connect the embeddings sidecar for DINOv2 and VLM analysis.',
        icon: Plug,
        skip: (state) => state.maxStage === 1,
        validate: (state) => {
          if (!state.sidecarUrl.trim()) {
            return { valid: false, message: 'Please enter a sidecar URL.' };
          }
          return { valid: true };
        },
        render: ConnectSidecarStep,
      },
      {
        id: 'automation',
        title: 'Automation',
        description: 'Configure automatic actions for diff classifications.',
        icon: ToggleRight,
        render: AutomationStep,
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Review and enable your AI visual diff configuration.',
        icon: ClipboardCheck,
        render: ReviewStep,
      },
    ],
    onComplete: async (state) => {
      if (!project?.id) {
        throw new Error('No project selected');
      }
      await api.put('/ai-diff/config', {
        projectId: project.id,
        enabled: true,
        maxStage: state.maxStage,
        sidecarUrl: state.sidecarUrl,
        autoApproveNoise: state.autoApproveNoise,
        autoApproveMinor: state.autoApproveMinor,
        escalateBreaking: state.escalateBreaking,
      });
      toast.success('AI Visual Diff enabled');
      setSavedState(state);
      setCompleted(true);
    },
    onCancel: () => {
      router.push('/settings/ai-diff');
    },
  };

  const tierLabel = savedState
    ? TIERS.find((t) => t.stage === savedState.maxStage)?.label ?? ''
    : '';

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/settings/ai-diff"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Diff Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Set Up AI Visual Diff</h1>
        <p className="text-muted-foreground mt-1">
          Configure AI-powered visual difference analysis for your project.
        </p>
      </div>

      {completed && savedState ? (
        <WizardSuccessState
          title="AI Visual Diff Enabled"
          description="Your project is now configured for AI-powered visual diff analysis. Comparisons will be automatically classified and triaged."
          details={[
            { label: 'Analysis Depth', value: `${tierLabel} (Stage ${savedState.maxStage})` },
            ...(savedState.maxStage > 1
              ? [{ label: 'Sidecar URL', value: savedState.sidecarUrl }]
              : []),
            { label: 'Auto-approve Noise', value: savedState.autoApproveNoise ? 'Yes' : 'No' },
            { label: 'Auto-approve Minor', value: savedState.autoApproveMinor ? 'Yes' : 'No' },
            { label: 'Escalate Breaking', value: savedState.escalateBreaking ? 'Yes' : 'No' },
          ]}
          actions={[
            { label: 'View Comparisons', href: '/comparisons' },
            { label: 'Open Settings', href: '/settings/ai-diff', variant: 'outline' },
          ]}
        />
      ) : (
        <WizardShell definition={definition} />
      )}
    </div>
  );
}
