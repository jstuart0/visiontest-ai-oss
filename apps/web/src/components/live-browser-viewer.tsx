'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Wifi, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { io as socketIO, Socket } from 'socket.io-client';

interface LiveBrowserViewerProps {
  executionId: string;
  className?: string;
}

export function LiveBrowserViewer({ executionId, className }: LiveBrowserViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState<number>(0);
  const [enlarged, setEnlarged] = useState(false);

  // Draw frame to canvas(es)
  const drawFrame = useCallback((base64Data: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Resize canvas to match image aspect ratio on first frame
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.drawImage(img, 0, 0);

      // Also draw to dialog canvas if open
      const dialogCanvas = dialogCanvasRef.current;
      if (dialogCanvas) {
        const dctx = dialogCanvas.getContext('2d');
        if (dctx) {
          if (dialogCanvas.width !== img.width || dialogCanvas.height !== img.height) {
            dialogCanvas.width = img.width;
            dialogCanvas.height = img.height;
          }
          dctx.drawImage(img, 0, 0);
        }
      }

      setFrameCount((prev) => prev + 1);
      setLastFrameTime(Date.now());
    };
    img.src = `data:image/jpeg;base64,${base64Data}`;
  }, []);

  // Connect to WebSocket for stream
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    // Strip /api or /api/v1 suffix if present for socket connection
    const socketUrl = apiUrl.replace(/\/api(\/v1)?\/?$/, '');

    const socket = socketIO(socketUrl, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe:stream', executionId);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('stream:frame', (data: { executionId: string; data: string }) => {
      if (data.executionId === executionId) {
        drawFrame(data.data);
      }
    });

    return () => {
      socket.emit('unsubscribe:stream', executionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [executionId, drawFrame]);

  const isReceiving = Date.now() - lastFrameTime < 2000;

  return (
    <div ref={containerRef} className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-pointer"
        style={{ imageRendering: 'auto' }}
        onClick={() => frameCount > 0 && setEnlarged(true)}
      />

      {/* No frames yet placeholder */}
      {frameCount === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
          <div className="animate-pulse mb-2">
            {connected ? (
              <Wifi className="w-8 h-8" />
            ) : (
              <WifiOff className="w-8 h-8" />
            )}
          </div>
          <p className="text-sm">
            {connected ? 'Waiting for browser frames...' : 'Connecting...'}
          </p>
          <p className="text-xs text-white/40 mt-1">
            Live streaming requires Chromium browser
          </p>
        </div>
      )}

      {/* Status indicators */}
      <div className="absolute top-2 left-2 flex items-center gap-2">
        {frameCount > 0 && isReceiving && (
          <Badge className="bg-red-500 text-white text-xs animate-pulse">
            LIVE
          </Badge>
        )}
        {frameCount > 0 && !isReceiving && (
          <Badge className="bg-yellow-500 text-white text-xs">
            PAUSED
          </Badge>
        )}
        <Badge
          variant="secondary"
          className={cn(
            'text-xs',
            connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          )}
        >
          {connected ? (
            <><Wifi className="w-3 h-3 mr-1" /> Connected</>
          ) : (
            <><WifiOff className="w-3 h-3 mr-1" /> Disconnected</>
          )}
        </Badge>
      </div>

      {/* Enlarge button */}
      {frameCount > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 text-white hover:bg-white/20 h-7 w-7"
          onClick={() => setEnlarged(true)}
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      )}

      {/* Enlarged dialog */}
      <Dialog open={enlarged} onOpenChange={setEnlarged}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black border-none">
          <div className="relative flex items-center justify-center w-full h-full">
            <canvas
              ref={dialogCanvasRef}
              className="max-w-full max-h-[90vh]"
              style={{ imageRendering: 'auto', objectFit: 'contain' }}
            />
            {/* Status indicators in dialog */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {isReceiving && (
                <Badge className="bg-red-500 text-white text-xs animate-pulse">
                  LIVE
                </Badge>
              )}
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs',
                  connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}
              >
                {connected ? (
                  <><Wifi className="w-3 h-3 mr-1" /> Connected</>
                ) : (
                  <><WifiOff className="w-3 h-3 mr-1" /> Disconnected</>
                )}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-white hover:bg-white/20 z-10"
              onClick={() => setEnlarged(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
