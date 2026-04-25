'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '@/components/CommandPalette';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {}, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

/**
 * VtStage — page container. Keeps horizontal margins consistent.
 * narrow — 820px. For reading-dominant pages.
 * wide   — 1440px. For data and diffs.
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
    <div className={`${max} mx-auto px-6 md:px-10 py-8 ${className}`}>
      {children}
    </div>
  );
}

export default AppShell;
