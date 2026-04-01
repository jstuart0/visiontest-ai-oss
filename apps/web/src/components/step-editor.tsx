'use client';

import { useState, useCallback } from 'react';
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Code,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface TestStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  name?: string;
  assertion?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

interface StepEditorProps {
  steps: TestStep[];
  platform?: string;
  onChange: (steps: TestStep[]) => void;
  readonly?: boolean;
}

const STEP_TYPES = [
  { value: 'navigate', label: 'Navigate', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'click', label: 'Click', color: 'bg-green-500/20 text-green-400' },
  { value: 'type', label: 'Type', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'waitFor', label: 'Wait For', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'assert', label: 'Assert', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'screenshot', label: 'Screenshot', color: 'bg-pink-500/20 text-pink-400' },
  { value: 'hover', label: 'Hover', color: 'bg-cyan-500/20 text-cyan-400' },
  { value: 'scroll', label: 'Scroll', color: 'bg-teal-500/20 text-teal-400' },
  { value: 'select', label: 'Select', color: 'bg-indigo-500/20 text-indigo-400' },
  { value: 'clear', label: 'Clear', color: 'bg-gray-500/20 text-gray-400' },
  { value: 'ai', label: 'AI', color: 'bg-amber-500/20 text-amber-400' },
];

const ASSERTION_TYPES = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'text', label: 'Has Text' },
  { value: 'value', label: 'Has Value' },
  { value: 'count', label: 'Count' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

function getStepTypeConfig(type: string) {
  return STEP_TYPES.find((t) => t.value === type) || {
    value: type,
    label: type,
    color: 'bg-muted text-muted-foreground',
  };
}

function getStepSummary(step: TestStep): string {
  switch (step.type) {
    case 'navigate':
      return step.url || '(no URL)';
    case 'click':
    case 'hover':
    case 'waitFor':
    case 'clear':
      return step.selector || '(no selector)';
    case 'type':
      return `${step.selector || '?'} = "${step.value || ''}"`;
    case 'select':
      return `${step.selector || '?'} → ${step.value || '?'}`;
    case 'assert':
      return `${step.selector || '?'} ${step.assertion || 'exists'}${step.value ? ` "${step.value}"` : ''}`;
    case 'screenshot':
      return step.name || 'capture';
    case 'scroll':
      return step.selector || 'page bottom';
    case 'ai':
      return step.value || step.name || '(no instruction)';
    default:
      return step.selector || step.value || step.url || '-';
  }
}

function needsSelector(type: string): boolean {
  return ['click', 'type', 'waitFor', 'assert', 'hover', 'select', 'clear'].includes(type);
}

function needsValue(type: string): boolean {
  return ['type', 'select'].includes(type);
}

function needsUrl(type: string): boolean {
  return type === 'navigate';
}

function needsName(type: string): boolean {
  return type === 'screenshot';
}

export function StepEditor({ steps, platform, onChange, readonly }: StepEditorProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [mode, setMode] = useState<'visual' | 'script'>('visual');
  const [scriptText, setScriptText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const updateStep = useCallback(
    (index: number, updates: Partial<TestStep>) => {
      const newSteps = [...steps];
      newSteps[index] = { ...newSteps[index], ...updates };
      onChange(newSteps);
    },
    [steps, onChange]
  );

  const addStep = useCallback(
    (atIndex?: number) => {
      const newStep: TestStep = { type: 'click' };
      const newSteps = [...steps];
      if (atIndex !== undefined) {
        newSteps.splice(atIndex + 1, 0, newStep);
      } else {
        newSteps.push(newStep);
      }
      onChange(newSteps);
      setExpandedStep(atIndex !== undefined ? atIndex + 1 : newSteps.length - 1);
    },
    [steps, onChange]
  );

  const removeStep = useCallback(
    (index: number) => {
      const newSteps = steps.filter((_, i) => i !== index);
      onChange(newSteps);
      if (expandedStep === index) setExpandedStep(null);
    },
    [steps, onChange, expandedStep]
  );

  // Drag and drop reorder
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newSteps = [...steps];
    const [moved] = newSteps.splice(dragIndex, 1);
    newSteps.splice(targetIndex, 0, moved);
    onChange(newSteps);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleParse = async () => {
    if (!scriptText.trim()) return;
    setIsParsing(true);
    try {
      const result = await api.post<{ steps: TestStep[]; warnings?: string[] }>('/tests/parse', {
        script: scriptText,
        format: 'natural',
      });
      if (result.steps.length > 0) {
        onChange(result.steps);
        setMode('visual');
        toast.success(`Parsed ${result.steps.length} steps`);
      } else {
        toast.warning('No steps could be parsed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to parse script');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">
            Test Steps
            {steps.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {steps.length}
              </Badge>
            )}
          </CardTitle>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'script')}>
            <TabsList className="bg-muted h-8">
              <TabsTrigger value="visual" className="text-xs h-7 px-2">
                <GripVertical className="w-3 h-3 mr-1" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="script" className="text-xs h-7 px-2">
                <Code className="w-3 h-3 mr-1" />
                Script
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'visual' ? (
          <div className="space-y-2">
            {steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-3">No steps defined</p>
                {!readonly && (
                  <Button variant="outline" size="sm" onClick={() => addStep()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Step
                  </Button>
                )}
              </div>
            ) : (
              steps.map((step, index) => {
                const typeConfig = getStepTypeConfig(step.type);
                const isExpanded = expandedStep === index;

                return (
                  <div
                    key={index}
                    draggable={!readonly}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={cn(
                      'border rounded-lg transition-all',
                      dragOverIndex === index && dragIndex !== index
                        ? 'border-blue-500 border-dashed'
                        : 'border-border',
                      isExpanded ? 'bg-muted/50' : 'hover:bg-muted/30'
                    )}
                  >
                    {/* Step header */}
                    <div
                      className="flex items-center gap-2 p-3 cursor-pointer"
                      onClick={() =>
                        !readonly && setExpandedStep(isExpanded ? null : index)
                      }
                    >
                      {!readonly && (
                        <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab flex-shrink-0" />
                      )}
                      <span className="text-muted-foreground font-mono text-xs w-5 flex-shrink-0">
                        {index + 1}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs font-mono flex-shrink-0', typeConfig.color)}
                      >
                        {typeConfig.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate flex-1">
                        {getStepSummary(step)}
                      </span>
                      {!readonly && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(index);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded edit form */}
                    {isExpanded && !readonly && (
                      <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50">
                        <div className="pt-3">
                          <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                          <select
                            value={step.type}
                            onChange={(e) => updateStep(index, { type: e.target.value })}
                            className="w-full h-8 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                          >
                            {STEP_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {needsUrl(step.type) && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">URL</label>
                            <Input
                              value={step.url || ''}
                              onChange={(e) => updateStep(index, { url: e.target.value })}
                              placeholder="https://example.com"
                              className="h-8 bg-muted border-border text-sm"
                            />
                          </div>
                        )}

                        {needsSelector(step.type) && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Selector
                            </label>
                            <Input
                              value={step.selector || ''}
                              onChange={(e) => updateStep(index, { selector: e.target.value })}
                              placeholder="#id, .class, [data-testid]"
                              className="h-8 bg-muted border-border text-sm font-mono"
                            />
                          </div>
                        )}

                        {needsValue(step.type) && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Value
                            </label>
                            <Input
                              value={step.value || ''}
                              onChange={(e) => updateStep(index, { value: e.target.value })}
                              placeholder="Text to type or option to select"
                              className="h-8 bg-muted border-border text-sm"
                            />
                          </div>
                        )}

                        {step.type === 'ai' && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Instruction
                            </label>
                            <Input
                              value={step.value || step.name || ''}
                              onChange={(e) => updateStep(index, { value: e.target.value })}
                              placeholder="Click the login button"
                              className="h-8 bg-muted border-border text-sm"
                            />
                          </div>
                        )}

                        {needsName(step.type) && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Name
                            </label>
                            <Input
                              value={step.name || ''}
                              onChange={(e) => updateStep(index, { name: e.target.value })}
                              placeholder="screenshot-name"
                              className="h-8 bg-muted border-border text-sm"
                            />
                          </div>
                        )}

                        {step.type === 'assert' && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Assertion Type
                            </label>
                            <select
                              value={step.assertion || ''}
                              onChange={(e) => updateStep(index, { assertion: e.target.value })}
                              className="w-full h-8 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                            >
                              <option value="">Exists (default)</option>
                              {ASSERTION_TYPES.map((a) => (
                                <option key={a.value} value={a.value}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                            {['text', 'value', 'count'].includes(step.assertion || '') && (
                              <Input
                                value={step.value || ''}
                                onChange={(e) => updateStep(index, { value: e.target.value })}
                                placeholder="Expected value"
                                className="h-8 bg-muted border-border text-sm mt-2"
                              />
                            )}
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Timeout (ms)
                          </label>
                          <Input
                            type="number"
                            value={step.timeout || ''}
                            onChange={(e) =>
                              updateStep(index, {
                                timeout: e.target.value ? parseInt(e.target.value) : undefined,
                              })
                            }
                            placeholder="30000"
                            className="h-8 bg-muted border-border text-sm w-32"
                          />
                        </div>

                        {/* Advanced Options */}
                        {step.type === 'navigate' && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Wait Until</label>
                            <select
                              value={(step.options as any)?.waitUntil || 'load'}
                              onChange={(e) => updateStep(index, { options: { ...(step.options || {}), waitUntil: e.target.value } })}
                              className="h-8 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                            >
                              <option value="load">Load</option>
                              <option value="domcontentloaded">DOM Content Loaded</option>
                              <option value="networkidle">Network Idle</option>
                            </select>
                          </div>
                        )}

                        {step.type === 'scroll' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Direction</label>
                              <select
                                value={(step.options as any)?.direction || 'down'}
                                onChange={(e) => updateStep(index, { options: { ...(step.options || {}), direction: e.target.value } })}
                                className="h-8 rounded-md bg-muted border border-border text-foreground px-2 text-sm w-full"
                              >
                                <option value="down">Down</option>
                                <option value="up">Up</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Behavior</label>
                              <select
                                value={(step.options as any)?.behavior || 'auto'}
                                onChange={(e) => updateStep(index, { options: { ...(step.options || {}), behavior: e.target.value } })}
                                className="h-8 rounded-md bg-muted border border-border text-foreground px-2 text-sm w-full"
                              >
                                <option value="auto">Auto</option>
                                <option value="smooth">Smooth</option>
                                <option value="instant">Instant</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {step.type === 'click' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Button</label>
                              <select
                                value={(step.options as any)?.button || 'left'}
                                onChange={(e) => updateStep(index, { options: { ...(step.options || {}), button: e.target.value } })}
                                className="h-8 rounded-md bg-muted border border-border text-foreground px-2 text-sm w-full"
                              >
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="middle">Middle</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Click Count</label>
                              <Input
                                type="number"
                                min="1"
                                max="3"
                                value={(step.options as any)?.clickCount || 1}
                                onChange={(e) => updateStep(index, { options: { ...(step.options || {}), clickCount: parseInt(e.target.value) || 1 } })}
                                className="h-8 bg-muted border-border text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Add step button */}
            {!readonly && steps.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addStep()}
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Step
              </Button>
            )}
          </div>
        ) : (
          /* Script mode */
          <div className="space-y-3">
            <Textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder={`Write your test in natural language, one step per line:

Go to https://example.com
Click the login button
Type "myuser" in the username field
Wait for the dashboard
Take a screenshot`}
              className="bg-muted border-border text-foreground font-mono min-h-[200px] text-sm"
            />
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleParse}
                disabled={isParsing || !scriptText.trim()}
              >
                {isParsing ? (
                  'Parsing...'
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Parse & Apply
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
