'use client';

// TopBar — the slim top chrome.
// Left:  brand mark + project switcher (minimal; project is implied).
// Right: command-palette hint, theme toggle, user avatar.
// The brand mark uses the signature italic treatment so the typography
// identity is visible from the very first pixel a user sees.

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

  // Cmd+K reminder string — shown desaturated; the palette itself is
  // mounted at the shell level so the key binding works globally.
  const kbd = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  return (
    <header
      className="
        sticky top-0 z-40
        border-b bg-[var(--bg-0)]
        flex items-center gap-6
        px-6 md:px-10 h-[60px]
        backdrop-blur-sm
      "
      style={{ borderColor: 'var(--rule)' }}
    >
      {/* Brand mark — editorial italic .ai */}
      <Link href="/dashboard" className="flex items-baseline gap-2.5 group shrink-0">
        <span
          aria-hidden
          className="block w-2 h-2 rounded-full vt-breathe"
          style={{
            background: 'var(--accent)',
            boxShadow: 'var(--accent-glow)',
            alignSelf: 'center',
          }}
        />
        <span
          className="text-[20px] leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontVariationSettings: '"opsz" 144',
            fontWeight: 380,
            letterSpacing: '-0.02em',
          }}
        >
          VisionTest<em style={{ color: 'var(--accent)', fontWeight: 350 }}>.ai</em>
        </span>
      </Link>

      {/* Project switcher — understated, a marginal affordance */}
      {project && projects && projects.length > 0 && (
        <div
          className="hidden md:flex items-baseline gap-2 pl-6 border-l text-[13px]"
          style={{ borderColor: 'var(--rule)', color: 'var(--ink-1)' }}
        >
          <span className="vt-mono text-[10.5px] tracking-[0.18em] uppercase" style={{ color: 'var(--ink-2)' }}>
            Project
          </span>
          <select
            aria-label="Switch project"
            value={project.id}
            onChange={(e) => {
              const next = projects?.find((p) => p.id === e.target.value);
              if (next) setCurrentProject(next);
            }}
            className="
              bg-transparent cursor-pointer outline-none
              font-[var(--font-display)] italic
              text-[15px]
            "
            style={{ color: 'var(--ink-0)' }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} style={{ color: '#000' }}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* Command palette hint — actual trigger is global Cmd+K */}
        <button
          type="button"
          onClick={() => {
            // Dispatch the same Cmd+K synthetic event that the palette listens for.
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }),
            );
          }}
          className="
            hidden sm:flex items-center gap-3 px-3 h-9
            border vt-mono text-[11px] tracking-[0.14em] uppercase
            transition-colors
          "
          style={{ borderColor: 'var(--rule)', color: 'var(--ink-1)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
          aria-label="Open command palette"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <span
            className="px-1.5 py-0.5 text-[10px]"
            style={{ background: 'var(--bg-2)', color: 'var(--ink-1)' }}
          >
            {kbd}K
          </span>
        </button>

        {/* Theme toggle — Darkroom ↔ Editorial */}
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'darkroom' ? 'editorial' : 'darkroom')}
            aria-label={`Switch to ${theme === 'darkroom' ? 'editorial' : 'darkroom'} theme`}
            className="
              relative h-9 w-9 border flex items-center justify-center
              transition-colors
            "
            style={{ borderColor: 'var(--rule)', color: 'var(--ink-1)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--rule)';
              e.currentTarget.style.color = 'var(--ink-1)';
            }}
          >
            {theme === 'darkroom' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          aria-label="Account"
          className="h-9 w-9 rounded-full border flex items-center justify-center"
          style={{
            borderColor: 'var(--rule)',
            background: 'var(--bg-2)',
            color: 'var(--ink-1)',
          }}
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
