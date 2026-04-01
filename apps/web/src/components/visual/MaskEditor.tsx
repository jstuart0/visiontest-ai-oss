'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Save,
  Square,
  Image,
  MousePointer,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { masksApi, type Mask } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MaskEditorProps {
  projectId: string;
  testId: string;
  imageUrl?: string;
  onClose: () => void;
}

interface DrawingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Tool = 'select' | 'draw';
type DragMode = 'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w';
const HANDLE_SIZE = 8;

export function MaskEditor({
  projectId,
  testId,
  imageUrl,
  onClose,
}: MaskEditorProps) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<Tool>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<DrawingRect | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [newMaskName, setNewMaskName] = useState('');
  const [newMaskType, setNewMaskType] = useState<'RECTANGLE' | 'SELECTOR' | 'XPATH' | 'REGEX'>('RECTANGLE');
  const [newMaskValue, setNewMaskValue] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMaskOriginal, setDragMaskOriginal] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Fetch existing masks
  const { data: masks, isLoading } = useQuery({
    queryKey: ['masks', projectId, testId],
    queryFn: () => masksApi.list(projectId, { testId }),
  });

  // Create mask mutation
  const createMutation = useMutation({
    mutationFn: (data: { type: string; value: any; reason?: string }) =>
      masksApi.create({ projectId, testId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masks', projectId, testId] });
      toast.success('Mask created');
      setCurrentRect(null);
      setNewMaskName('');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create mask');
    },
  });

  // Update mask mutation (for move/resize)
  const updateMutation = useMutation({
    mutationFn: ({ maskId, value }: { maskId: string; value: any }) =>
      masksApi.update(maskId, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masks', projectId, testId] });
      toast.success('Mask updated');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to update mask');
    },
  });

  // Delete mask mutation
  const deleteMutation = useMutation({
    mutationFn: (maskId: string) => masksApi.delete(maskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masks', projectId, testId] });
      toast.success('Mask deleted');
      setSelectedMaskId(null);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete mask');
    },
  });

  // Load image
  useEffect(() => {
    if (!imageUrl) {
      setImageLoaded(true); // No image, just show blank canvas
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageLoaded(true); // Continue without image
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const container = containerRef.current;
    if (!container) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image if loaded
    if (imageRef.current) {
      const img = imageRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate scale to fit
      const scaleX = containerWidth / img.width;
      const scaleY = containerHeight / img.height;
      const newScale = Math.min(scaleX, scaleY, 1);
      setScale(newScale);

      canvas.width = img.width * newScale;
      canvas.height = img.height * newScale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      // Placeholder canvas
      canvas.width = container.clientWidth;
      canvas.height = 400;
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#52525b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No baseline image available', canvas.width / 2, canvas.height / 2);
    }

    // Draw existing masks
    if (masks) {
      masks.forEach((mask) => {
        const isSelected = mask.id === selectedMaskId;
        ctx.fillStyle = isSelected
          ? 'rgba(59, 130, 246, 0.3)'
          : 'rgba(239, 68, 68, 0.3)';
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.fillRect(
          mask.x * scale,
          mask.y * scale,
          mask.width * scale,
          mask.height * scale
        );
        ctx.strokeRect(
          mask.x * scale,
          mask.y * scale,
          mask.width * scale,
          mask.height * scale
        );

        // Draw mask name
        ctx.fillStyle = isSelected ? '#3b82f6' : '#ef4444';
        ctx.font = '12px sans-serif';
        ctx.fillText(mask.name || mask.reason || '', (mask.x || 0) * scale + 4, (mask.y || 0) * scale + 14);

        // Draw resize handles for selected mask
        if (isSelected && mask.x !== undefined) {
          const sx = (mask.x || 0) * scale;
          const sy = (mask.y || 0) * scale;
          const sw = (mask.width || 0) * scale;
          const sh = (mask.height || 0) * scale;
          const hs = HANDLE_SIZE;
          ctx.fillStyle = '#3b82f6';
          // 8 handles: corners + edge midpoints
          const handles = [
            [sx - hs/2, sy - hs/2],                    // NW
            [sx + sw/2 - hs/2, sy - hs/2],             // N
            [sx + sw - hs/2, sy - hs/2],               // NE
            [sx + sw - hs/2, sy + sh/2 - hs/2],        // E
            [sx + sw - hs/2, sy + sh - hs/2],          // SE
            [sx + sw/2 - hs/2, sy + sh - hs/2],        // S
            [sx - hs/2, sy + sh - hs/2],               // SW
            [sx - hs/2, sy + sh/2 - hs/2],             // W
          ];
          handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx, hy, hs, hs);
          });
        }
      });
    }

    // Draw current drawing rectangle
    if (currentRect) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.fillRect(
        currentRect.x,
        currentRect.y,
        currentRect.width,
        currentRect.height
      );
      ctx.strokeRect(
        currentRect.x,
        currentRect.y,
        currentRect.width,
        currentRect.height
      );
    }
  }, [masks, currentRect, selectedMaskId, scale]);

  useEffect(() => {
    if (imageLoaded) {
      draw();
    }
  }, [imageLoaded, draw]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Helper: detect which resize handle (if any) is under the mouse
  const getResizeHandle = (pos: { x: number; y: number }, mask: any): DragMode => {
    if (!mask || mask.x === undefined) return 'none';
    const sx = (mask.x || 0) * scale;
    const sy = (mask.y || 0) * scale;
    const sw = (mask.width || 0) * scale;
    const sh = (mask.height || 0) * scale;
    const hs = HANDLE_SIZE + 4; // slightly larger hit area

    if (Math.abs(pos.x - sx) < hs && Math.abs(pos.y - sy) < hs) return 'resize-nw';
    if (Math.abs(pos.x - (sx + sw)) < hs && Math.abs(pos.y - sy) < hs) return 'resize-ne';
    if (Math.abs(pos.x - sx) < hs && Math.abs(pos.y - (sy + sh)) < hs) return 'resize-sw';
    if (Math.abs(pos.x - (sx + sw)) < hs && Math.abs(pos.y - (sy + sh)) < hs) return 'resize-se';
    if (Math.abs(pos.y - sy) < hs && pos.x > sx && pos.x < sx + sw) return 'resize-n';
    if (Math.abs(pos.y - (sy + sh)) < hs && pos.x > sx && pos.x < sx + sw) return 'resize-s';
    if (Math.abs(pos.x - (sx + sw)) < hs && pos.y > sy && pos.y < sy + sh) return 'resize-e';
    if (Math.abs(pos.x - sx) < hs && pos.y > sy && pos.y < sy + sh) return 'resize-w';
    if (pos.x > sx && pos.x < sx + sw && pos.y > sy && pos.y < sy + sh) return 'move';
    return 'none';
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);

    // If in select mode, check for move/resize on selected mask
    if (tool === 'select' && selectedMaskId) {
      const selectedMask = masks?.find((m) => m.id === selectedMaskId);
      if (selectedMask) {
        const mode = getResizeHandle(pos, selectedMask);
        if (mode !== 'none') {
          setDragMode(mode);
          setDragStart(pos);
          setDragMaskOriginal({
            x: selectedMask.x || 0,
            y: selectedMask.y || 0,
            width: selectedMask.width || 0,
            height: selectedMask.height || 0,
          });
          return;
        }
      }
      // Click on empty space or another mask
      const clickedMask = masks?.find((mask) => {
        if (mask.x === undefined) return false;
        const sx = (mask.x || 0) * scale;
        const sy = (mask.y || 0) * scale;
        const sw = (mask.width || 0) * scale;
        const sh = (mask.height || 0) * scale;
        return pos.x >= sx && pos.x <= sx + sw && pos.y >= sy && pos.y <= sy + sh;
      });
      setSelectedMaskId(clickedMask?.id || null);
      return;
    }

    // Draw mode
    if (tool === 'draw') {
      setIsDrawing(true);
      setStartPos(pos);
      setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);

    // Handle drag move/resize
    if (dragMode !== 'none' && selectedMaskId && dragMaskOriginal) {
      const dx = (pos.x - dragStart.x) / scale;
      const dy = (pos.y - dragStart.y) / scale;
      const orig = dragMaskOriginal;

      // Temporarily update the mask in the local query cache for live preview
      queryClient.setQueryData(['masks', projectId, testId], (old: any[]) => {
        if (!old) return old;
        return old.map((m) => {
          if (m.id !== selectedMaskId) return m;
          let newRect = { ...orig };

          if (dragMode === 'move') {
            newRect.x = orig.x + dx;
            newRect.y = orig.y + dy;
          } else if (dragMode === 'resize-se') {
            newRect.width = Math.max(10, orig.width + dx);
            newRect.height = Math.max(10, orig.height + dy);
          } else if (dragMode === 'resize-nw') {
            newRect.x = orig.x + dx;
            newRect.y = orig.y + dy;
            newRect.width = Math.max(10, orig.width - dx);
            newRect.height = Math.max(10, orig.height - dy);
          } else if (dragMode === 'resize-ne') {
            newRect.y = orig.y + dy;
            newRect.width = Math.max(10, orig.width + dx);
            newRect.height = Math.max(10, orig.height - dy);
          } else if (dragMode === 'resize-sw') {
            newRect.x = orig.x + dx;
            newRect.width = Math.max(10, orig.width - dx);
            newRect.height = Math.max(10, orig.height + dy);
          } else if (dragMode === 'resize-n') {
            newRect.y = orig.y + dy;
            newRect.height = Math.max(10, orig.height - dy);
          } else if (dragMode === 'resize-s') {
            newRect.height = Math.max(10, orig.height + dy);
          } else if (dragMode === 'resize-e') {
            newRect.width = Math.max(10, orig.width + dx);
          } else if (dragMode === 'resize-w') {
            newRect.x = orig.x + dx;
            newRect.width = Math.max(10, orig.width - dx);
          }

          return { ...m, x: Math.round(newRect.x), y: Math.round(newRect.y), width: Math.round(newRect.width), height: Math.round(newRect.height) };
        });
      });
      draw();
      return;
    }

    // Handle drawing
    if (!isDrawing || tool !== 'draw') return;
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    });
  };

  const handleMouseUp = () => {
    // Persist move/resize to server
    if (dragMode !== 'none' && selectedMaskId) {
      const updatedMask = masks?.find((m) => m.id === selectedMaskId);
      if (updatedMask && updatedMask.x !== undefined) {
        updateMutation.mutate({
          maskId: selectedMaskId,
          value: {
            x: updatedMask.x,
            y: updatedMask.y,
            width: updatedMask.width,
            height: updatedMask.height,
          },
        });
      }
      setDragMode('none');
      setDragMaskOriginal(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentRect && currentRect.width > 10 && currentRect.height > 10) {
      // Valid rectangle drawn, wait for name input
    } else {
      setCurrentRect(null);
    }
  };

  // Cursor style based on hover position
  const handleMouseMoveCursor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'select' || !selectedMaskId) return;
    const pos = getMousePos(e);
    const selectedMask = masks?.find((m) => m.id === selectedMaskId);
    if (!selectedMask) return;
    const mode = getResizeHandle(pos, selectedMask);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cursors: Record<string, string> = {
      'none': 'default', 'move': 'move',
      'resize-nw': 'nwse-resize', 'resize-se': 'nwse-resize',
      'resize-ne': 'nesw-resize', 'resize-sw': 'nesw-resize',
      'resize-n': 'ns-resize', 'resize-s': 'ns-resize',
      'resize-e': 'ew-resize', 'resize-w': 'ew-resize',
    };
    canvas.style.cursor = cursors[mode] || 'default';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Click handling is now done in mouseDown for select tool
  };

  const handleSaveMask = () => {
    if (!currentRect || !newMaskName.trim()) return;

    // Convert scaled coordinates back to original, pack into value object
    createMutation.mutate({
      type: 'RECTANGLE',
      value: {
        x: Math.round(currentRect.x / scale),
        y: Math.round(currentRect.y / scale),
        width: Math.round(currentRect.width / scale),
        height: Math.round(currentRect.height / scale),
      },
      reason: newMaskName.trim(),
    });
  };

  const handleDeleteMask = () => {
    if (selectedMaskId) {
      deleteMutation.mutate(selectedMaskId);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === 'select' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTool('select')}
            className={cn(
              tool === 'select'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <MousePointer className="w-4 h-4 mr-1" />
            Select
          </Button>
          <Button
            variant={tool === 'draw' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTool('draw')}
            className={cn(
              tool === 'draw'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Square className="w-4 h-4 mr-1" />
            Draw
          </Button>

          {selectedMaskId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteMask}
              disabled={deleteMutation.isPending}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-2"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Selected
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={newMaskType}
            onChange={(e) => setNewMaskType(e.target.value as any)}
            className="h-8 rounded-md bg-muted border border-border text-muted-foreground px-2 text-xs"
          >
            <option value="RECTANGLE">Rectangle</option>
            <option value="SELECTOR">CSS Selector</option>
            <option value="XPATH">XPath</option>
            <option value="REGEX">Regex</option>
          </select>
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            {masks?.length || 0} masks
          </Badge>
        </div>
      </div>

      {/* Non-rectangle mask input */}
      {newMaskType !== 'RECTANGLE' && (
        <div className="p-4 border-b border-border bg-muted/30 space-y-2">
          <div className="flex gap-2">
            <Input
              value={newMaskValue}
              onChange={(e) => setNewMaskValue(e.target.value)}
              placeholder={
                newMaskType === 'SELECTOR' ? '.dynamic-content, #timestamp' :
                newMaskType === 'XPATH' ? '//div[@class="timestamp"]' :
                '/\\d{2}:\\d{2}:\\d{2}/g'
              }
              className="flex-1 h-8 bg-muted border-border text-sm font-mono"
            />
            <Input
              value={newMaskName}
              onChange={(e) => setNewMaskName(e.target.value)}
              placeholder="Mask name"
              className="w-40 h-8 bg-muted border-border text-sm"
            />
            <Button
              size="sm"
              disabled={!newMaskValue.trim() || !newMaskName.trim() || createMutation.isPending}
              onClick={() => {
                createMutation.mutate({
                  type: newMaskType,
                  value: newMaskValue.trim(),
                  reason: newMaskName.trim(),
                });
                setNewMaskValue('');
                setNewMaskName('');
              }}
            >
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {newMaskType === 'SELECTOR' && 'CSS selector to match elements to mask (e.g., .timestamp, #user-avatar)'}
            {newMaskType === 'XPATH' && 'XPath expression to match elements to mask'}
            {newMaskType === 'REGEX' && 'Regular expression to match text content to mask'}
          </p>
        </div>
      )}

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-background p-4"
      >
        {!imageLoaded ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => { handleMouseMove(e); handleMouseMoveCursor(e); }}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCanvasClick}
            className={cn(
              'mx-auto cursor-crosshair',
              tool === 'select' && 'cursor-pointer'
            )}
          />
        )}
      </div>

      {/* Save new mask panel */}
      {currentRect && currentRect.width > 10 && currentRect.height > 10 && (
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                value={newMaskName}
                onChange={(e) => setNewMaskName(e.target.value)}
                placeholder="Enter mask name..."
                className="bg-muted border-border text-foreground"
              />
            </div>
            <Button
              variant="ghost"
              onClick={() => setCurrentRect(null)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMask}
              disabled={!newMaskName.trim() || createMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Mask
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Region: {Math.round(currentRect.x / scale)}, {Math.round(currentRect.y / scale)} -
            {Math.round(currentRect.width / scale)}x{Math.round(currentRect.height / scale)}
          </p>
        </div>
      )}

      {/* Existing masks list */}
      {masks && masks.length > 0 && (
        <div className="p-4 border-t border-border max-h-32 overflow-auto">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Existing Masks
          </h4>
          <div className="flex flex-wrap gap-2">
            {masks.map((mask) => (
              <Badge
                key={mask.id}
                variant="secondary"
                className={cn(
                  'cursor-pointer transition-colors',
                  mask.id === selectedMaskId
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
                )}
                onClick={() => {
                  setSelectedMaskId(mask.id);
                  setTool('select');
                }}
              >
                {mask.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
