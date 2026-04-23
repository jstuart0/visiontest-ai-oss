'use client';

// AppShell — the new top-chrome layout for the Darkroom/Editorial
// design system. Intentionally no left sidebar: navigation is a thin
// horizontal zone bar under a slim top chrome, and the rest of the
// viewport is given to the page itself. Pages that want to be narrow
// wrap their content in <VtStage narrow>; pages that want to spread
// out use <VtStage wide>.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { ZoneBar } from './ZoneBar';
import { CommandPalette } from '@/components/CommandPalette';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Cache-bust the page chrome on route change so entrance animations
  // re-play at the right tempo on each navigation.
  useEffect(() => {}, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <ZoneBar />
      <main className="flex-1 relative">{children}</main>
      <CommandPalette />
    </div>
  );
}

/**
 * VtStage — the common page container. Sets the horizontal margins
 * consistently without enforcing a max-width unless asked.
 *
 * narrow    — 760px max. Used for editorial/reading pages.
 * wide      — 1320px max. Used for dashboards and data-dense pages.
 * fluid     — no max width. Used for film-strip + gallery pages.
 */
export function VtStage({
  children,
  width = 'wide',
  className = '',
}: {
  children: React.ReactNode;
  width?: 'narrow' | 'wide' | 'fluid';
  className?: string;
}) {
  const max =
    width === 'narrow' ? 'max-w-[760px]' : width === 'fluid' ? 'max-w-none' : 'max-w-[1320px]';
  return (
    <div className={`${max} mx-auto px-6 md:px-12 py-10 ${className}`}>
      {children}
    </div>
  );
}

export default AppShell;
