'use client';

import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardProgressProps {
  steps: Array<{
    id: string;
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  currentIndex: number;
  onStepClick?: (index: number) => void;
}

export function WizardProgress({ steps, currentIndex, onStepClick }: WizardProgressProps) {
  return (
    <nav aria-label="Wizard progress" className="flex items-center justify-between mb-2 px-2">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => isCompleted && onStepClick?.(i)}
              disabled={!isCompleted}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${step.title}${isCompleted ? ' (completed)' : isActive ? ' (current)' : ''}`}
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
              ) : Icon ? (
                <Icon className="h-4 w-4" />
              ) : (
                <span className="h-4 w-4 flex items-center justify-center text-xs">{i + 1}</span>
              )}
              <span className="hidden sm:inline">{step.title}</span>
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/70 mx-1" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
