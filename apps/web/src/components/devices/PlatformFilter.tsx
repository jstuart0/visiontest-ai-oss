'use client';

import { Smartphone, Monitor, Tablet, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Platform } from '@/lib/api';

interface PlatformFilterProps {
  value: Platform | null;
  onChange: (platform: Platform | null) => void;
  className?: string;
}

const platforms: {
  value: Platform | null;
  label: string;
  icon: typeof Monitor;
  color: string;
}[] = [
  { value: null, label: 'All', icon: Globe, color: 'text-muted-foreground' },
  { value: 'WEB', label: 'Web', icon: Monitor, color: 'text-blue-400' },
  { value: 'MOBILE_WEB', label: 'Mobile Web', icon: Tablet, color: 'text-purple-400' },
  { value: 'IOS', label: 'iOS', icon: Smartphone, color: 'text-muted-foreground' },
  { value: 'ANDROID', label: 'Android', icon: Smartphone, color: 'text-green-400' },
];

export function PlatformFilter({ value, onChange, className }: PlatformFilterProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-card rounded-lg border border-border', className)}>
      {platforms.map((platform) => {
        const isActive = value === platform.value;
        const Icon = platform.icon;

        return (
          <Button
            key={platform.label}
            variant="ghost"
            size="sm"
            onClick={() => onChange(platform.value)}
            className={cn(
              'h-8 px-3 gap-1.5 text-xs font-medium transition-all',
              isActive
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground/80 hover:bg-accent/50'
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', isActive && platform.color)} />
            {platform.label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Simple platform badge for displaying in tables/lists
 */
export function PlatformBadge({ platform }: { platform?: Platform | string }) {
  if (!platform || platform === 'WEB') return null;

  const config: Record<string, { label: string; color: string; bg: string }> = {
    IOS: { label: 'iOS', color: 'text-muted-foreground', bg: 'bg-muted/50' },
    ANDROID: { label: 'Android', color: 'text-green-400', bg: 'bg-green-500/10' },
    MOBILE_WEB: { label: 'Mobile', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  };

  const c = config[platform];
  if (!c) return null;

  return (
    <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', c.bg, c.color)}>
      {c.label}
    </Badge>
  );
}
