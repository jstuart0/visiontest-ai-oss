'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface GalleryScreenshot {
  stepIndex: number;
  url: string;
  timestamp?: number;
}

export interface GalleryStep {
  index: number;
  action: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
}

interface ScreenshotGalleryProps {
  screenshots: GalleryScreenshot[];
  steps: GalleryStep[];
  selectedStep?: number;
  onSelectStep?: (stepIndex: number) => void;
}

const statusIcons = {
  pending: Clock,
  running: Clock,
  passed: CheckCircle2,
  failed: XCircle,
};

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500 text-white',
  passed: 'bg-green-500 text-white',
  failed: 'bg-red-500 text-white',
};

export function ScreenshotGallery({
  screenshots,
  steps,
  selectedStep,
  onSelectStep,
}: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const selected = screenshots[selectedIndex];

  // Sync selection with external selectedStep prop
  useEffect(() => {
    if (selectedStep !== undefined) {
      const idx = screenshots.findIndex((s) => s.stepIndex === selectedStep);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [selectedStep, screenshots]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (stripRef.current) {
      const thumb = stripRef.current.children[selectedIndex] as HTMLElement;
      if (thumb) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const screenshot = screenshots[index];
      if (screenshot && onSelectStep) {
        onSelectStep(screenshot.stepIndex);
      }
    },
    [screenshots, onSelectStep]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedIndex > 0) {
        handleSelect(selectedIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedIndex < screenshots.length - 1) {
        handleSelect(selectedIndex + 1);
      }
    },
    [selectedIndex, screenshots.length, handleSelect]
  );

  if (screenshots.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No screenshots available</p>
      </div>
    );
  }

  const getStepForScreenshot = (screenshot: GalleryScreenshot) => {
    return steps.find((s) => s.index === screenshot.stepIndex);
  };

  return (
    <div className="space-y-3" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Thumbnail filmstrip */}
      <div className="relative">
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20"
        >
          {screenshots.map((screenshot, index) => {
            const step = getStepForScreenshot(screenshot);
            const StatusIcon = step ? statusIcons[step.status] : Clock;
            return (
              <button
                key={`${screenshot.stepIndex}-${index}`}
                onClick={() => handleSelect(index)}
                className={cn(
                  'relative flex-shrink-0 w-24 h-16 rounded-md overflow-hidden border-2 transition-all',
                  index === selectedIndex
                    ? 'border-blue-500 ring-2 ring-blue-500/30'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <img
                  src={screenshot.url}
                  alt={`Step ${screenshot.stepIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Step number badge */}
                <span className="absolute top-0.5 left-0.5 bg-black/70 text-white text-[10px] px-1 rounded">
                  {screenshot.stepIndex + 1}
                </span>
                {/* Status icon */}
                {step && (
                  <span
                    className={cn(
                      'absolute top-0.5 right-0.5 rounded-full p-0.5',
                      statusColors[step.status]
                    )}
                  >
                    <StatusIcon className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main image */}
      {selected && (
        <div className="relative group">
          <img
            src={selected.url}
            alt={`Step ${selected.stepIndex + 1} screenshot`}
            className="w-full rounded-lg border cursor-pointer"
            onClick={() => setFullscreen(true)}
          />
          {/* Navigation arrows */}
          {selectedIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); handleSelect(selectedIndex - 1); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {selectedIndex < screenshots.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); handleSelect(selectedIndex + 1); }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
          {/* Fullscreen button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          {/* Step info bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-1.5 rounded-b-lg flex items-center justify-between pointer-events-none">
            <span>
              Step {selected.stepIndex + 1}
              {getStepForScreenshot(selected)?.action &&
                ` - ${getStepForScreenshot(selected)!.action}`}
            </span>
            <span>
              {selectedIndex + 1} / {screenshots.length}
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] p-0 bg-black border-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' && selectedIndex > 0) {
              e.preventDefault();
              handleSelect(selectedIndex - 1);
            } else if (e.key === 'ArrowRight' && selectedIndex < screenshots.length - 1) {
              e.preventDefault();
              handleSelect(selectedIndex + 1);
            } else if (e.key === 'Escape') {
              setFullscreen(false);
            }
          }}
        >
          <div className="relative flex items-center justify-center w-full h-full">
            {selected && (
              <img
                src={selected.url}
                alt={`Step ${selected.stepIndex + 1} screenshot (fullscreen)`}
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
            {/* Close & Download buttons */}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              {selected && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = selected.url;
                    a.download = `screenshot-step-${selected.stepIndex + 1}.png`;
                    a.click();
                  }}
                >
                  <Download className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setFullscreen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {/* Large clickable left zone */}
            {selectedIndex > 0 && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer flex items-center justify-start pl-4 group/nav"
                onClick={() => handleSelect(selectedIndex - 1)}
              >
                <div className="bg-black/40 group-hover/nav:bg-black/60 rounded-full p-2 transition-all opacity-60 group-hover/nav:opacity-100">
                  <ChevronLeft className="h-8 w-8 text-white" />
                </div>
              </div>
            )}
            {/* Large clickable right zone */}
            {selectedIndex < screenshots.length - 1 && (
              <div
                className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer flex items-center justify-end pr-4 group/nav"
                onClick={() => handleSelect(selectedIndex + 1)}
              >
                <div className="bg-black/40 group-hover/nav:bg-black/60 rounded-full p-2 transition-all opacity-60 group-hover/nav:opacity-100">
                  <ChevronRight className="h-8 w-8 text-white" />
                </div>
              </div>
            )}
            {/* Bottom info bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full">
              Step {selected?.stepIndex !== undefined ? selected.stepIndex + 1 : '-'} — {selectedIndex + 1}/{screenshots.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
