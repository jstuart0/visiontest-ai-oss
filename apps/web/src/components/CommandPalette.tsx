// Command palette (Cmd+K / Ctrl+K)
//
// Minimal keyboard-driven launcher — new test, scan project, re-run last
// failed, copy run URL. Mounts once at the app layout level so it's
// available from every page.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Compass,
  Copy,
  RefreshCw,
  FileText,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';

interface Action {
  key: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmdk = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (cmdk) {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
      }
      if (e.key === 'Escape' && open) setOpen(false);
      // Global: Cmd+N jumps to new test
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          router.push('/tests/new');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, router]);

  const actions: Action[] = useMemo(
    () => [
      {
        key: 'new-test',
        label: 'New test from story',
        shortcut: '⌘N',
        icon: <Plus className="w-4 h-4" />,
        run: () => router.push('/tests/new'),
      },
      {
        key: 'scan',
        label: 'Scan project',
        icon: <Compass className="w-4 h-4" />,
        run: () => router.push('/scan/new'),
      },
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <Home className="w-4 h-4" />,
        run: () => router.push('/'),
      },
      {
        key: 'tests',
        label: 'All tests',
        icon: <FileText className="w-4 h-4" />,
        run: () => router.push('/tests'),
      },
      {
        key: 'rerun',
        label: 'Re-run last failed execution',
        icon: <RefreshCw className="w-4 h-4" />,
        run: async () => {
          toast.info('Not yet wired — coming soon.');
        },
      },
      {
        key: 'copy-url',
        label: 'Copy current page URL',
        icon: <Copy className="w-4 h-4" />,
        run: () => {
          navigator.clipboard.writeText(window.location.href);
          toast.success('URL copied');
        },
      },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) {
                filtered[0].run();
                setOpen(false);
              }
            }}
            placeholder="Type a command…"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matching commands.
            </div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  a.run();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground">{a.icon}</span>
                <span className="flex-1 text-sm text-foreground">
                  {a.label}
                </span>
                {a.shortcut && (
                  <kbd className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {a.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
