'use client';

import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface WizardLaunchCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  estimatedMinutes?: number;
  variant?: 'default' | 'prominent';
  className?: string;
}

export function WizardLaunchCard({
  icon: Icon,
  title,
  description,
  href,
  estimatedMinutes,
  variant = 'default',
  className,
}: WizardLaunchCardProps) {
  return (
    <Card className={cn(
      'bg-card border-border transition-colors hover:border-blue-500/50',
      variant === 'prominent' && 'border-blue-500/30 bg-blue-500/5',
      className,
    )}>
      <CardContent className="flex items-start gap-4 py-5">
        <div className={cn(
          'rounded-lg p-2.5 shrink-0',
          variant === 'prominent' ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground',
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          {estimatedMinutes && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              ~{estimatedMinutes} min
            </div>
          )}
        </div>
        <Link href={href}>
          <Button variant="outline" size="sm" className="shrink-0">
            Start <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
