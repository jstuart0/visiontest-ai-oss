'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, Tablet, Monitor, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { devicesApi, type DeviceProfile, type Platform } from '@/lib/api';
import { cn } from '@/lib/utils';

interface DeviceSelectorProps {
  projectId?: string;
  platform?: Platform;
  value?: string; // deviceProfileId
  onChange: (deviceProfileId: string | undefined, profile?: DeviceProfile) => void;
  className?: string;
}

const platformIcons: Record<string, typeof Monitor> = {
  WEB: Monitor,
  IOS: Smartphone,
  ANDROID: Smartphone,
  MOBILE_WEB: Tablet,
};

const platformColors: Record<string, string> = {
  WEB: 'text-blue-400',
  IOS: 'text-muted-foreground',
  ANDROID: 'text-green-400',
  MOBILE_WEB: 'text-purple-400',
};

const platformLabels: Record<string, string> = {
  WEB: 'Web',
  IOS: 'iOS',
  ANDROID: 'Android',
  MOBILE_WEB: 'Mobile Web',
};

export function DeviceSelector({ projectId, platform, value, onChange, className }: DeviceSelectorProps) {
  const { data: devices = [] } = useQuery({
    queryKey: ['devices', projectId, platform],
    queryFn: () =>
      devicesApi.list({
        projectId,
        platform: platform || undefined,
      }),
  });

  const selected = devices.find((d) => d.id === value);

  // Group devices by platform
  const grouped = devices.reduce((acc, device) => {
    const key = device.platform;
    if (!acc[key]) acc[key] = [];
    acc[key].push(device);
    return acc;
  }, {} as Record<string, DeviceProfile[]>);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-between bg-card border-border text-muted-foreground hover:bg-accent',
            className
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {(() => {
                const Icon = platformIcons[selected.platform] || Monitor;
                return <Icon className={cn('w-4 h-4', platformColors[selected.platform])} />;
              })()}
              <span className="truncate">{selected.name}</span>
              <span className="text-muted-foreground text-xs">
                {selected.width}×{selected.height}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select device...</span>
          )}
          <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="bg-card border-border w-72 max-h-80 overflow-y-auto">
        {/* No device option */}
        <DropdownMenuItem
          className="text-muted-foreground focus:bg-accent"
          onClick={() => onChange(undefined)}
        >
          <Monitor className="w-4 h-4 mr-2" />
          Default (no device)
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />

        {Object.entries(grouped).map(([plat, deviceList]) => (
          <div key={plat}>
            <DropdownMenuLabel className="text-muted-foreground text-xs uppercase">
              {platformLabels[plat] || plat}
            </DropdownMenuLabel>
            {deviceList.map((device) => {
              const Icon = platformIcons[device.platform] || Monitor;
              return (
                <DropdownMenuItem
                  key={device.id}
                  className={cn(
                    'text-muted-foreground focus:bg-accent',
                    device.id === value && 'bg-muted'
                  )}
                  onClick={() => onChange(device.id, device)}
                >
                  <Icon className={cn('w-4 h-4 mr-2', platformColors[device.platform])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{device.name}</span>
                      {device.isBuiltIn && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-muted">
                          built-in
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {device.width}×{device.height} @ {device.scaleFactor}x
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}

        {devices.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No device profiles found
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
