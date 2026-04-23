'use client';

// AppShell — Blueprint chassis. Top chrome = title block + sheet index,
// the rest is a drawing surface. No sidebar; dense data belongs inside
// sheets, not sidebars.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { ZoneBar } from './ZoneBar';
import { CommandPalette } from '@/components/CommandPalette';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
 * VtStage — page container. Keeps horizontal margins consistent.
 * narrow — 820px. For reading-dominant pages.
 * wide   — 1440px. For data and diffs (matches the proof's sheet width).
 * fluid  — no max. For film-strip / full-bleed surfaces.
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
    width === 'narrow' ? 'max-w-[820px]' : width === 'fluid' ? 'max-w-none' : 'max-w-[1440px]';
  return (
    <div className={`${max} mx-auto px-6 md:px-12 py-10 ${className}`}>
      {children}
    </div>
  );
}

export default AppShell;
