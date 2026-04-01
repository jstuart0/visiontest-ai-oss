'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

type EventHandler = (data: unknown) => void;

interface WebSocketHookReturn {
  isConnected: boolean;
  subscribe: (event: string, handler: EventHandler) => () => void;
  emit: (event: string, data?: unknown) => void;
}

export function useWebSocket(): WebSocketHookReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const { token, isAuthenticated } = useAuthStore();
  const { currentProject } = useProjectStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Initialize socket connection
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected');

      // Join project room if we have a current project
      if (currentProject) {
        socket.emit('join:project', { projectId: currentProject.id });
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
    });

    // Forward all events to registered handlers
    socket.onAny((event, data) => {
      const handlers = handlersRef.current.get(event);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, token, currentProject]);

  // Join project room when current project changes
  useEffect(() => {
    if (socketRef.current?.connected && currentProject) {
      socketRef.current.emit('join:project', { projectId: currentProject.id });
    }
  }, [currentProject]);

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { isConnected, subscribe, emit };
}

// Typed event hooks for common events
export function useTestUpdates(onUpdate: (test: { id: string; status: string }) => void) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe('test:updated', onUpdate as EventHandler);
    return unsubscribe;
  }, [subscribe, onUpdate]);
}

export function useVisualUpdates(
  onUpdate: (comparison: { id: string; status: string }) => void
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe('visual:updated', onUpdate as EventHandler);
    return unsubscribe;
  }, [subscribe, onUpdate]);
}

export function useRunProgress(
  onProgress: (progress: { testId: string; progress: number; status: string }) => void
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe('run:progress', onProgress as EventHandler);
    return unsubscribe;
  }, [subscribe, onProgress]);
}
