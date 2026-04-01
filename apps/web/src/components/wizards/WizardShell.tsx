'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WizardProgress } from './WizardProgress';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface WizardStep<TState> {
  id: string;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  validate?: (state: TState) => Promise<ValidationResult> | ValidationResult;
  skip?: (state: TState) => boolean;
  onEnter?: (state: TState) => void;
  onLeave?: (state: TState) => void;
  render: React.ComponentType<WizardStepProps<TState>>;
}

export interface WizardStepProps<TState> {
  state: TState;
  updateState: (partial: Partial<TState>) => void;
  validationError?: string;
}

export interface WizardDefinition<TState> {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  initialState: TState;
  steps: WizardStep<TState>[];
  onComplete: (state: TState) => Promise<void> | void;
  onCancel?: () => void;
  successRoute?: string;
}

interface WizardShellProps<TState> {
  definition: WizardDefinition<TState>;
  className?: string;
}

export function WizardShell<TState extends Record<string, any>>({ definition, className }: WizardShellProps<TState>) {
  const { id, steps, initialState, onComplete, onCancel } = definition;

  // Filter out skipped steps
  const getActiveSteps = useCallback((state: TState) => {
    return steps.filter(s => !s.skip || !s.skip(state));
  }, [steps]);

  // Try to resume from sessionStorage
  const getInitialData = (): { state: TState; stepIndex: number } => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`wizard-${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { state: parsed.state, stepIndex: parsed.stepIndex || 0 };
        }
      } catch {}
    }
    return { state: initialState, stepIndex: 0 };
  };

  const initial = getInitialData();
  const [state, setState] = useState<TState>(initial.state);
  const [stepIndex, setStepIndex] = useState(initial.stepIndex);
  const [validationError, setValidationError] = useState<string>();
  const [isValidating, setIsValidating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const enteredRef = useRef(false);

  const activeSteps = getActiveSteps(state);
  const currentStep = activeSteps[stepIndex];
  const isLastStep = stepIndex === activeSteps.length - 1;

  // Persist to sessionStorage on state/step change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`wizard-${id}`, JSON.stringify({ state, stepIndex }));
    }
  }, [state, stepIndex, id]);

  // Call onEnter when step changes
  useEffect(() => {
    if (currentStep?.onEnter && !enteredRef.current) {
      currentStep.onEnter(state);
      enteredRef.current = true;
    }
  }, [stepIndex]);

  const updateState = useCallback((partial: Partial<TState>) => {
    setState(prev => ({ ...prev, ...partial }));
    setValidationError(undefined);
  }, []);

  const handleNext = useCallback(async () => {
    if (!currentStep) return;

    // Validate current step
    if (currentStep.validate) {
      setIsValidating(true);
      try {
        const result = await currentStep.validate(state);
        if (!result.valid) {
          setValidationError(result.message || 'Please complete this step before continuing.');
          setIsValidating(false);
          return;
        }
      } catch (err: any) {
        setValidationError(err.message || 'Validation failed');
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    // Call onLeave
    currentStep.onLeave?.(state);
    enteredRef.current = false;

    if (isLastStep) {
      setIsCompleting(true);
      try {
        await onComplete(state);
        // Clean up sessionStorage on successful completion
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`wizard-${id}`);
        }
      } catch (err: any) {
        setValidationError(err.message || 'Failed to complete wizard');
      } finally {
        setIsCompleting(false);
      }
    } else {
      setValidationError(undefined);
      setStepIndex(prev => prev + 1);
    }
  }, [currentStep, state, isLastStep, onComplete, id]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      currentStep?.onLeave?.(state);
      enteredRef.current = false;
      setValidationError(undefined);
      setStepIndex(prev => prev - 1);
    }
  }, [stepIndex, currentStep, state]);

  const handleCancel = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`wizard-${id}`);
    }
    onCancel?.();
  }, [id, onCancel]);

  const handleStepClick = useCallback((targetIndex: number) => {
    if (targetIndex < stepIndex) {
      currentStep?.onLeave?.(state);
      enteredRef.current = false;
      setValidationError(undefined);
      setStepIndex(targetIndex);
    }
  }, [stepIndex, currentStep, state]);

  if (!currentStep) return null;

  const StepComponent = currentStep.render;

  return (
    <div className={cn('space-y-6', className)}>
      <WizardProgress
        steps={activeSteps}
        currentIndex={stepIndex}
        onStepClick={handleStepClick}
      />

      {/* Step content */}
      <div className="animate-fade-in" key={currentStep.id}>
        <StepComponent
          state={state}
          updateState={updateState}
          validationError={validationError}
        />
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {validationError}
        </div>
      )}

      {/* Navigation footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {stepIndex > 0 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isValidating || isCompleting}
              aria-label="Go to previous step"
              className="border-border text-muted-foreground hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          ) : onCancel ? (
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={isCompleting}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          ) : <div />}
        </div>

        <span className="text-sm text-muted-foreground" aria-live="polite">
          Step {stepIndex + 1} of {activeSteps.length}
        </span>

        <Button
          onClick={handleNext}
          disabled={isValidating || isCompleting}
          aria-label={isLastStep ? 'Complete wizard' : 'Go to next step'}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isValidating || isCompleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isCompleting ? 'Saving...' : 'Checking...'}
            </>
          ) : (
            <>
              {isLastStep ? 'Complete Setup' : 'Continue'}
              {!isLastStep && <ArrowRight className="h-4 w-4 ml-2" />}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
