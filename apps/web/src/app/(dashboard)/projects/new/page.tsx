'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderPlus,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Eye,
  FlaskConical,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { projectsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WizardData {
  name: string;
  description: string;
}

const STEPS = [
  { id: 1, label: 'Project Info', icon: FolderPlus },
  { id: 2, label: 'Create', icon: Rocket },
  { id: 3, label: 'Next Steps', icon: CheckCircle2 },
];

const NEXT_ACTIONS = [
  {
    id: 'test',
    label: 'Create a Test',
    description: 'Build your first visual regression test with Playwright.',
    icon: FlaskConical,
    href: '/tests/new',
  },
  {
    id: 'storybook',
    label: 'Connect Storybook',
    description: 'Auto-discover components and create visual tests from stories.',
    icon: BookOpen,
    href: '/settings/storybook/wizard',
  },
  {
    id: 'ai-diff',
    label: 'Set Up AI Visual Diff',
    description: 'Enable AI-powered diff analysis to filter noise and catch real changes.',
    icon: Eye,
    href: '/settings/ai-diff/wizard',
  },
];

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right max-w-[60%] break-all">
        {value}
      </span>
    </div>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    name: '',
    description: '',
  });
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  function update(fields: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...fields }));
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  }

  function next() {
    if (step < 2 && canAdvance()) setStep(step + 1);
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      projectsApi.create({
        name: data.name,
        description: data.description || undefined,
      }),
    onSuccess: (project: any) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreatedProjectId(project.id);
      toast.success('Project created!');
      setStep(3);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground/80 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-8">Create New Project</h1>

      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;

          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => {
                  if (isCompleted && s.id < 3) setStep(s.id);
                }}
                disabled={!isCompleted || s.id === 3}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                      ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 cursor-pointer'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/70 mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Project Info */}
      {step === 1 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Project Info</CardTitle>
            <CardDescription className="text-muted-foreground">
              Give your project a name and description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Project Name <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g., Marketing Website, Mobile App, Design System"
                value={data.name}
                onChange={(e) => update({ name: e.target.value })}
                className="bg-muted border-border text-foreground"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>
              <Textarea
                placeholder="What does this project test?"
                value={data.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={3}
                className="bg-muted border-border text-foreground"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Create */}
      {step === 2 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Review & Create</CardTitle>
            <CardDescription className="text-muted-foreground">
              Confirm your project details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReviewRow label="Name" value={data.name} />
            {data.description && <ReviewRow label="Description" value={data.description} />}
          </CardContent>
        </Card>
      )}

      {/* Step 3: What Next */}
      {step === 3 && (
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardContent className="text-center py-8">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Project Created</h3>
              <p className="text-muted-foreground mt-1">
                Your project &ldquo;{data.name}&rdquo; is ready. Choose what to set up next.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recommended next steps</h3>
            {NEXT_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.id} href={action.href}>
                  <Card className="bg-card border-border transition-colors hover:border-blue-500/50 cursor-pointer">
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="rounded-lg p-2.5 bg-muted text-muted-foreground shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground">{action.label}</h4>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="text-muted-foreground">
              Skip for now — go to dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step < 3 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={back}
            disabled={step === 1}
            className="flex items-center gap-2 border-border text-muted-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {step} of {STEPS.length}
          </div>

          {step < 2 ? (
            <Button
              onClick={next}
              disabled={!canAdvance()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
