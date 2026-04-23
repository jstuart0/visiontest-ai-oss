'use client';

// TopBar — the drawing-sheet title block running along the top of every page.
// Left:  brand mark (Major Mono Display, lowercase, with dot separator).
// Middle: project switcher as a dimension-callout row (hidden on mobile).
// Right: command palette trigger, theme toggle, account stamp.

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, User, Search } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/project.store';

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { projects } = useProject();
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const project = currentProject;

  const kbd = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
  const isoDate = new Date().toISOString().slice(0, 10);

  return (
    <header
      className="sticky top-0 z-40 flex items-stretch h-[60px] backdrop-blur-sm"
      style={{
        background: 'color-mix(in oklab, var(--bg-0) 85%, transparent)',
        borderBottom: '1px solid var(--rule-strong)',
      }}
    >
      {/* Brand mark — drafting title block */}
      <Link
        href="/dashboard"
        className="flex items-center gap-4 shrink-0 pl-6 md:pl-10 pr-8 group"
        style={{ borderRight: '1px solid var(--rule)' }}
      >
        <span
          aria-hidden
          className="block w-2 h-2"
          style={{
            background: 'var(--accent)',
            transform: 'rotate(45deg)',
          }}
        />
        <span
          className="text-[22px] leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '0.02em',
            textTransform: 'lowercase',
            color: 'var(--ink-0)',
          }}
        >
          visiontest<span style={{ color: 'var(--accent)' }}>·</span>ai
        </span>
      </Link>

      {/* Sheet identifier — always visible */}
      <div
        className="hidden md:flex items-center gap-4 px-6 shrink-0"
        style={{
          borderRight: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>SHT · {isoDate.replace(/-/g, '.')}</span>
        <span style={{ color: 'var(--accent)' }}>REV ·</span>
        <span style={{ color: 'var(--accent)' }}>02</span>
      </div>

      {/* Project switcher — rendered as a dimensioned field */}
      {project && projects && projects.length > 0 && (
        <div
          className="hidden lg:flex items-center gap-3 px-6 flex-1 min-w-0"
          style={{
            borderRight: '1px solid var(--rule)',
            color: 'var(--ink-1)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            PROJ
          </span>
          <select
            aria-label="Switch project"
            value={project.id}
            onChange={(e) => {
              const next = projects?.find((p) => p.id === e.target.value);
              if (next) setCurrentProject(next);
            }}
            className="bg-transparent cursor-pointer outline-none truncate"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              letterSpacing: '0.04em',
              color: 'var(--ink-0)',
              textTransform: 'uppercase',
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} style={{ color: '#000' }}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ml-auto flex items-stretch">
        {/* Command palette trigger */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }),
            );
          }}
          className="hidden sm:flex items-center gap-3 px-5 transition-colors"
          style={{
            borderLeft: '1px solid var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ink-1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
          aria-label="Open command palette"
        >
          <Search className="w-3 h-3" strokeWidth={1.5} />
          <span>SEARCH</span>
          <span
            className="px-1.5 py-0.5"
            style={{
              border: '1px solid var(--rule)',
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: 'var(--ink-2)',
            }}
          >
            {kbd}K
          </span>
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'blueprint' ? 'paper' : 'blueprint')}
            aria-label={`Switch to ${theme === 'blueprint' ? 'paper' : 'blueprint'} theme`}
            className="flex items-center justify-center w-[60px] transition-colors"
            style={{
              borderLeft: '1px solid var(--rule)',
              color: 'var(--ink-1)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
          >
            {theme === 'blueprint' ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        )}

        {/* Account */}
        <button
          type="button"
          aria-label="Account"
          className="flex items-center justify-center w-[60px]"
          style={{
            borderLeft: '1px solid var(--rule)',
            color: 'var(--ink-1)',
          }}
        >
          <User className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
