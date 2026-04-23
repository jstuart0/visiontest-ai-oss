// FilmStrip — horizontal timeline of screenshots for a test execution.
// Hovering any frame highlights the matching step in the list below.
// Keyboard shortcuts `[` and `]` move between frames.

'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface Frame {
  stepIndex: number;
  screenshotUrl?: string | null;
  status: 'passed' | 'failed' | 'pending' | 'running';
  confidence?: 'exact' | 'heuristic' | 'AI' | 'unknown';
}

interface FilmStripProps {
  frames: Frame[];
  selectedStep: number;
  onSelect: (stepIndex: number) => void;
}

const STATUS_ICONS = {
  passed: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  failed: <XCircle className="w-3 h-3 text-red-400" />,
  pending: <AlertCircle className="w-3 h-3 text-muted-foreground" />,
  running: <HelpCircle className="w-3 h-3 text-blue-400 animate-pulse" />,
};

export function FilmStrip({ frames, selectedStep, onSelect }: FilmStripProps) {
  // `[` and `]` jump between steps. Standard navigation shortcut in
  // timeline-style UIs (Loom, Final Cut). No modifier required.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === ']') {
        onSelect(Math.min(frames.length - 1, selectedStep + 1));
        e.preventDefault();
      } else if (e.key === '[') {
        onSelect(Math.max(0, selectedStep - 1));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [frames.length, selectedStep, onSelect]);

  if (frames.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
        No frames yet. They appear here as the test runs.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Timeline — {frames.length} frame{frames.length === 1 ? '' : 's'}
        </div>
        <div className="text-xs text-muted-foreground">
          <kbd className="px-1 rounded bg-muted-foreground/20">[</kbd>{' '}
          <kbd className="px-1 rounded bg-muted-foreground/20">]</kbd> to
          step
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 p-3 min-w-max">
          {frames.map((frame) => {
            const selected = frame.stepIndex === selectedStep;
            return (
              <button
                key={frame.stepIndex}
                type="button"
                onClick={() => onSelect(frame.stepIndex)}
                className={`relative w-32 flex-shrink-0 border rounded-md overflow-hidden transition-all ${
                  selected
                    ? 'border-blue-500 ring-2 ring-blue-500/30'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="aspect-video bg-muted overflow-hidden">
                  {frame.screenshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frame.screenshotUrl}
                      alt={`Step ${frame.stepIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      no frame
                    </div>
                  )}
                </div>
                <div className="absolute top-1 left-1 bg-background/80 rounded px-1 text-[10px] flex items-center gap-1">
                  {STATUS_ICONS[frame.status]}
                  <span className="font-mono">{frame.stepIndex + 1}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FilmStrip;
