'use client';

import { useState } from 'react';
import {
  Hand,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Smartphone,
  Type,
  Keyboard,
  Home,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Link2,
  Bell,
  Vibrate,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MobileStep {
  type: string;
  selector?: string;
  value?: string;
  direction?: string;
  coordinates?: { x: number; y: number };
  endCoordinates?: { x: number; y: number };
  duration?: number;
  orientation?: string;
  bundleId?: string;
  deepLink?: string;
}

interface TouchGestureRecorderProps {
  steps: MobileStep[];
  onAddStep: (step: MobileStep) => void;
  onRemoveStep: (index: number) => void;
  className?: string;
}

const GESTURE_TYPES = [
  { type: 'tap', label: 'Tap', icon: Hand, color: 'text-blue-400' },
  { type: 'doubleTap', label: 'Double Tap', icon: Hand, color: 'text-blue-400' },
  { type: 'longPress', label: 'Long Press', icon: Hand, color: 'text-orange-400' },
  { type: 'swipe', label: 'Swipe', icon: ArrowUp, color: 'text-purple-400' },
  { type: 'scroll', label: 'Scroll', icon: ArrowDown, color: 'text-green-400' },
  { type: 'pinch', label: 'Pinch', icon: ZoomIn, color: 'text-cyan-400' },
  { type: 'typeText', label: 'Type Text', icon: Type, color: 'text-yellow-400' },
  { type: 'hideKeyboard', label: 'Hide Keyboard', icon: Keyboard, color: 'text-muted-foreground' },
  { type: 'rotate', label: 'Rotate', icon: RotateCcw, color: 'text-pink-400' },
  { type: 'shake', label: 'Shake', icon: Vibrate, color: 'text-red-400' },
  { type: 'launchApp', label: 'Launch App', icon: Smartphone, color: 'text-green-400' },
  { type: 'deepLink', label: 'Deep Link', icon: Link2, color: 'text-blue-400' },
  { type: 'notification', label: 'Notification', icon: Bell, color: 'text-yellow-400' },
  { type: 'backButton', label: 'Back', icon: ChevronLeft, color: 'text-muted-foreground' },
  { type: 'homeButton', label: 'Home', icon: Home, color: 'text-muted-foreground' },
  { type: 'screenshot', label: 'Screenshot', icon: Smartphone, color: 'text-green-400' },
  { type: 'waitFor', label: 'Wait For', icon: Smartphone, color: 'text-muted-foreground' },
  { type: 'assert', label: 'Assert', icon: Smartphone, color: 'text-green-400' },
];

export function TouchGestureRecorder({ steps, onAddStep, onRemoveStep, className }: TouchGestureRecorderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('tap');
  const [stepConfig, setStepConfig] = useState<MobileStep>({ type: 'tap' });

  const handleAddStep = () => {
    onAddStep({ ...stepConfig, type: selectedType });
    setDialogOpen(false);
    setStepConfig({ type: 'tap' });
    setSelectedType('tap');
  };

  const getStepLabel = (step: MobileStep): string => {
    const gesture = GESTURE_TYPES.find(g => g.type === step.type);
    let label = gesture?.label || step.type;

    if (step.selector) label += ` → ${step.selector}`;
    if (step.value) label += ` "${step.value}"`;
    if (step.direction) label += ` ${step.direction}`;
    if (step.deepLink) label += ` ${step.deepLink}`;

    return label;
  };

  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Hand className="w-4 h-4" />
            Mobile Steps
            <Badge variant="secondary" className="ml-1">{steps.length}</Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="bg-muted border-border text-muted-foreground hover:bg-muted"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Step
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No steps yet. Add mobile gestures and actions.
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => {
              const gesture = GESTURE_TYPES.find(g => g.type === step.type);
              const Icon = gesture?.icon || Hand;

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 bg-muted rounded-lg group"
                >
                  <span className="text-muted-foreground font-mono text-xs w-5">{index + 1}</span>
                  <Icon className={cn('w-4 h-4 shrink-0', gesture?.color || 'text-muted-foreground')} />
                  <span className="text-muted-foreground text-sm flex-1 truncate">
                    {getStepLabel(step)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                    onClick={() => onRemoveStep(index)}
                  >
                    ×
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add Step Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Mobile Step</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step Type */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Action Type</label>
              <Select value={selectedType} onValueChange={(v) => {
                setSelectedType(v);
                setStepConfig({ type: v });
              }}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {GESTURE_TYPES.map((gesture) => (
                    <SelectItem
                      key={gesture.type}
                      value={gesture.type}
                      className="text-muted-foreground focus:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <gesture.icon className={cn('w-4 h-4', gesture.color)} />
                        {gesture.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector (for tap, type, assert, etc.) */}
            {['tap', 'doubleTap', 'longPress', 'typeText', 'waitFor', 'assert'].includes(selectedType) && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Element Selector (accessibility ID)</label>
                <Input
                  value={stepConfig.selector || ''}
                  onChange={(e) => setStepConfig({ ...stepConfig, selector: e.target.value })}
                  placeholder="e.g., login-button"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            )}

            {/* Value (for typeText, assert) */}
            {['typeText', 'assert'].includes(selectedType) && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Value / Text</label>
                <Input
                  value={stepConfig.value || ''}
                  onChange={(e) => setStepConfig({ ...stepConfig, value: e.target.value })}
                  placeholder="Text to type or assert"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            )}

            {/* Direction (for swipe, scroll) */}
            {['swipe', 'scroll'].includes(selectedType) && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Direction</label>
                <Select
                  value={stepConfig.direction || 'down'}
                  onValueChange={(v) => setStepConfig({ ...stepConfig, direction: v })}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="up" className="text-muted-foreground">Up</SelectItem>
                    <SelectItem value="down" className="text-muted-foreground">Down</SelectItem>
                    <SelectItem value="left" className="text-muted-foreground">Left</SelectItem>
                    <SelectItem value="right" className="text-muted-foreground">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Orientation (for rotate) */}
            {selectedType === 'rotate' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Orientation</label>
                <Select
                  value={stepConfig.orientation || 'landscape'}
                  onValueChange={(v) => setStepConfig({ ...stepConfig, orientation: v })}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="portrait" className="text-muted-foreground">Portrait</SelectItem>
                    <SelectItem value="landscape" className="text-muted-foreground">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Deep Link URL */}
            {selectedType === 'deepLink' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Deep Link URL</label>
                <Input
                  value={stepConfig.deepLink || ''}
                  onChange={(e) => setStepConfig({ ...stepConfig, deepLink: e.target.value })}
                  placeholder="myapp://screen/detail"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            )}

            {/* Bundle ID (for launchApp) */}
            {selectedType === 'launchApp' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Bundle ID</label>
                <Input
                  value={stepConfig.bundleId || ''}
                  onChange={(e) => setStepConfig({ ...stepConfig, bundleId: e.target.value })}
                  placeholder="com.example.myapp"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            )}

            {/* Duration (for longPress) */}
            {selectedType === 'longPress' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Duration (ms)</label>
                <Input
                  type="number"
                  value={stepConfig.duration || 2000}
                  onChange={(e) => setStepConfig({ ...stepConfig, duration: parseInt(e.target.value) })}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            )}

            {/* Screenshot name */}
            {selectedType === 'screenshot' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Screenshot Name</label>
                <Input
                  value={stepConfig.value || ''}
                  onChange={(e) => setStepConfig({ ...stepConfig, value: e.target.value })}
                  placeholder="e.g., home-screen"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddStep}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Add Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
