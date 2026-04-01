'use client';

import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

interface WizardSuccessAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline';
}

interface WizardSuccessStateProps {
  title: string;
  description: string;
  actions: WizardSuccessAction[];
  details?: Array<{ label: string; value: string }>;
}

export function WizardSuccessState({ title, description, actions, details }: WizardSuccessStateProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="text-center py-12">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/10 mb-6">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">{description}</p>

        {details && details.length > 0 && (
          <div className="mt-6 mx-auto max-w-sm text-left space-y-1">
            {details.map((d, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium text-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-8">
          {actions.map((action, i) => {
            const btn = (
              <Button
                key={i}
                variant={action.variant || (i === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
                className={i === 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                {action.label}
                {i === 0 && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            );
            return action.href ? <Link key={i} href={action.href}>{btn}</Link> : btn;
          })}
        </div>
      </CardContent>
    </Card>
  );
}
