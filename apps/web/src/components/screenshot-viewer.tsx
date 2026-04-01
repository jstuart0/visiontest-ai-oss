'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Image as ImageIcon,
  GitCompare,
  Camera,
  Columns,
  Layers,
  Maximize2,
} from 'lucide-react';

interface ScreenshotViewerProps {
  baseline: string | null;
  newScreenshot: string;
  diffImage: string | null;
  onSetBaseline?: () => void;
}

type ViewMode = 'side-by-side' | 'overlay' | 'diff';

export function ScreenshotViewer({
  baseline,
  newScreenshot,
  diffImage,
  onSetBaseline,
}: ScreenshotViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  return (
    <div className="space-y-4">
      {/* View Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('side-by-side')}
            className="gap-2"
          >
            <Columns className="h-4 w-4" />
            Side by Side
          </Button>
          {baseline && (
            <Button
              variant={viewMode === 'overlay' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('overlay')}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              Overlay
            </Button>
          )}
          {diffImage && (
            <Button
              variant={viewMode === 'diff' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('diff')}
              className="gap-2"
            >
              <GitCompare className="h-4 w-4" />
              Diff Only
            </Button>
          )}
        </div>
        {onSetBaseline && (
          <Button variant="outline" size="sm" onClick={onSetBaseline}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Set as Baseline
          </Button>
        )}
      </div>

      {/* Overlay Opacity Slider */}
      {viewMode === 'overlay' && baseline && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Opacity:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="text-sm text-muted-foreground">
            {Math.round(overlayOpacity * 100)}%
          </span>
        </div>
      )}

      {/* Screenshots Display */}
      <div className="animate-fade-in">
        {viewMode === 'side-by-side' && (
          <div className="grid gap-4 md:grid-cols-3">
            <ScreenshotCard label="Baseline" icon={ImageIcon} imageUrl={baseline} color="emerald" />
            <ScreenshotCard label="New Screenshot" icon={Camera} imageUrl={newScreenshot} color="blue" />
            <ScreenshotCard label="Diff" icon={GitCompare} imageUrl={diffImage} color="red" />
          </div>
        )}

        {viewMode === 'overlay' && baseline && (
          <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
            <img src={baseline} alt="Baseline" className="w-full" />
            <img
              src={newScreenshot}
              alt="New"
              className="absolute inset-0 w-full"
              style={{ opacity: overlayOpacity }}
            />
          </div>
        )}

        {viewMode === 'diff' && diffImage && (
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            <img src={diffImage} alt="Diff" className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenshotCard({
  label,
  icon: Icon,
  imageUrl,
  color,
}: {
  label: string;
  icon: React.ElementType;
  imageUrl: string | null;
  color: 'emerald' | 'blue' | 'red';
}) {
  const colorClasses = {
    emerald: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    red: 'text-red-500 bg-red-500/10',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`rounded p-1 ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        {imageUrl ? (
          <Dialog>
            <DialogTrigger asChild>
              <button className="group relative w-full">
                <img src={imageUrl} alt={label} className="w-full" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                  <Maximize2 className="h-8 w-8 text-white" />
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 overflow-hidden">
              <img src={imageUrl} alt={label} className="w-full" />
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <span className="text-sm text-muted-foreground">No image</span>
          </div>
        )}
      </div>
    </div>
  );
}
