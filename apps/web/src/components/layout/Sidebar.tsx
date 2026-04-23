'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  Image,
  AlertTriangle,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Play,
  HelpCircle,
  Smartphone,
  Users,
  Bell,
  GitBranch,
  Key,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Puzzle,
  FileText,
  Building2,
  ScrollText,
  Wrench,
  Globe,
  BookOpen,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tests', href: '/tests', icon: FlaskConical },
  { name: 'Features', href: '/features', icon: Layers },
  { name: 'Templates', href: '/templates', icon: Sparkles },
  { name: 'Credentials', href: '/credentials', icon: KeyRound },
  { name: 'Executions', href: '/executions', icon: Play },
  { name: 'API Tests', href: '/api-tests', icon: Globe },
  { name: 'Devices', href: '/devices', icon: Smartphone },
  { name: 'Visual Regression', href: '/visual', icon: Image },
  { name: 'Storybook', href: '/storybook', icon: BookOpen },
  { name: 'Baselines', href: '/baselines', icon: Image },
  { name: 'Flaky Tests', href: '/flaky', icon: AlertTriangle },
  { name: 'Masks', href: '/masks', icon: Layers },
  { name: 'Workflows', href: '/workflows', icon: GitBranch },
  { name: 'Task Blocks', href: '/blocks', icon: Puzzle },
  { name: 'Schedules', href: '/schedules', icon: CalendarDays },
  { name: 'Fixes', href: '/fixes', icon: Wrench },
  { name: 'Approvals', href: '/approvals', icon: CheckSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Organization', href: '/organization', icon: Building2 },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Audit Log', href: '/audit-log', icon: ScrollText },
  { name: 'Webhooks', href: '/webhooks', icon: Bell },
  { name: 'API Keys', href: '/api-keys', icon: Key },
];

const bottomNavigation = [
  { name: 'Help & Docs', href: '/help', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground">VisionTest.ai</span>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-2 border-t border-sidebar-border space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
