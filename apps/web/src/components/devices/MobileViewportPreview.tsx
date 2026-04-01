'use client';

import { cn } from '@/lib/utils';
import type { Platform } from '@/lib/api';

interface MobileViewportPreviewProps {
  platform: Platform;
  width: number;
  height: number;
  deviceName?: string;
  screenshotUrl?: string;
  className?: string;
  maxHeight?: number;
}

/**
 * Renders a device frame around a screenshot or content area
 * to give context for mobile screenshots.
 */
export function MobileViewportPreview({
  platform,
  width,
  height,
  deviceName,
  screenshotUrl,
  className,
  maxHeight = 500,
}: MobileViewportPreviewProps) {
  const aspectRatio = width / height;
  const displayHeight = Math.min(maxHeight, 500);
  const displayWidth = displayHeight * aspectRatio;

  const isIOS = platform === 'IOS' || (platform === 'MOBILE_WEB' && deviceName?.toLowerCase().includes('iphone'));
  const isIPad = deviceName?.toLowerCase().includes('ipad');
  const isAndroid = platform === 'ANDROID' || (platform === 'MOBILE_WEB' && !isIOS);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Device frame */}
      <div
        className={cn(
          'relative bg-background shadow-2xl',
          isIOS && !isIPad && 'rounded-[2.5rem] p-3 pt-8 pb-8',
          isIOS && isIPad && 'rounded-[1.5rem] p-3 pt-5 pb-5',
          isAndroid && 'rounded-[1.5rem] p-2 pt-6 pb-4',
          !isIOS && !isAndroid && 'rounded-lg p-2'
        )}
        style={{
          border: '2px solid #333',
        }}
      >
        {/* Dynamic Island / Notch (iOS) */}
        {isIOS && !isIPad && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-full z-10" />
        )}

        {/* Status bar indicator */}
        {(isIOS || isAndroid) && (
          <div className="absolute top-1 right-4 flex items-center gap-1">
            <div className="w-4 h-2 bg-muted rounded-sm" />
            <div className="w-3 h-2 bg-muted rounded-sm" />
            <div className="w-3 h-2 bg-muted rounded-sm" />
          </div>
        )}

        {/* Screen area */}
        <div
          className={cn(
            'bg-card overflow-hidden relative',
            isIOS && !isIPad && 'rounded-[2rem]',
            isIOS && isIPad && 'rounded-[1rem]',
            isAndroid && 'rounded-[1rem]',
            !isIOS && !isAndroid && 'rounded-md'
          )}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
          }}
        >
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt={`${deviceName || 'Device'} screenshot`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/70 text-sm">
              <div className="text-center">
                <div className="text-lg mb-1">📱</div>
                <div>{width} × {height}</div>
                {deviceName && <div className="text-xs mt-1">{deviceName}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Home indicator (iOS) */}
        {isIOS && !isIPad && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-muted-foreground/70 rounded-full" />
        )}

        {/* Android navigation buttons */}
        {isAndroid && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <div className="w-3 h-3 border border-muted-foreground/70 rounded-sm" />
            <div className="w-3 h-3 border border-muted-foreground/70 rounded-full" />
            <div className="w-3 h-3 border-l-2 border-muted-foreground/70 rotate-180" />
          </div>
        )}
      </div>

      {/* Device info */}
      <div className="mt-3 text-center">
        {deviceName && (
          <div className="text-sm font-medium text-muted-foreground">{deviceName}</div>
        )}
        <div className="text-xs text-muted-foreground">
          {width} × {height} • {platform}
        </div>
      </div>
    </div>
  );
}
