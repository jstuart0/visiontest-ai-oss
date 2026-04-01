'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Play, Loader2 } from 'lucide-react';

const statusConfig = {
  passed: { icon: CheckCircle2, label: 'Passed', className: 'text-success bg-success/10' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-destructive bg-destructive/10' },
  flaky: { icon: AlertTriangle, label: 'Flaky', className: 'text-warning bg-warning/10' },
  running: { icon: Loader2, label: 'Running', className: 'text-primary bg-primary/10 [&>svg]:animate-spin' },
  pending: { icon: Clock, label: 'Pending', className: 'text-muted-foreground bg-muted' },
  error: { icon: XCircle, label: 'Error', className: 'text-destructive bg-destructive/10' },
};

type Status = keyof typeof statusConfig;

export function StatusBadge({ status, size = 'sm' }: { status: Status | string; size?: 'xs' | 'sm' | 'md' }) {
  const config = statusConfig[status as Status] || statusConfig.pending;
  const Icon = config.icon;
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5 gap-1' : size === 'md' ? 'text-sm px-3 py-1.5 gap-2' : 'text-xs px-2 py-1 gap-1.5';
  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span className={cn('inline-flex items-center font-medium rounded-full', sizeClass, config.className)}>
      <Icon className={iconSize} />
      {config.label}
    </span>
  );
}
