'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  Play,
  Globe,
  Smartphone,
  Image,
  BookOpen,
  AlertTriangle,
  Layers,
  GitBranch,
  Puzzle,
  CalendarDays,
  Wrench,
  CheckSquare,
  BarChart3,
  FileText,
  Building2,
  Users,
  ScrollText,
  Bell,
  Key,
  HelpCircle,
  Settings,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  match?: (p: string) => boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Testing',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' || p === '/' },
      { name: 'Tests', href: '/tests', icon: FlaskConical },
      { name: 'Runs', href: '/executions', icon: Play, match: (p) => p.startsWith('/executions') || p.startsWith('/runs') },
      { name: 'API Tests', href: '/api-tests', icon: Globe },
      { name: 'Devices', href: '/devices', icon: Smartphone },
      { name: 'Scan', href: '/scan', icon: Compass },
    ],
  },
  {
    label: 'Visual',
    items: [
      { name: 'Visual Review', href: '/visual', icon: Image },
      { name: 'Baselines', href: '/baselines', icon: Image },
      { name: 'Storybook', href: '/storybook', icon: BookOpen },
      { name: 'Masks', href: '/masks', icon: Layers },
    ],
  },
  {
    label: 'Automation',
    items: [
      { name: 'Flaky Tests', href: '/flaky', icon: AlertTriangle },
      { name: 'Fixes', href: '/fixes', icon: Wrench },
      { name: 'Approvals', href: '/approvals', icon: CheckSquare },
      { name: 'Workflows', href: '/workflows', icon: GitBranch },
      { name: 'Blocks', href: '/blocks', icon: Puzzle },
      { name: 'Schedules', href: '/schedules', icon: CalendarDays },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { name: 'Organization', href: '/organization', icon: Building2 },
      { name: 'Teams', href: '/teams', icon: Users },
      { name: 'Audit Log', href: '/audit-log', icon: ScrollText },
      { name: 'Webhooks', href: '/webhooks', icon: Bell },
      { name: 'API Keys', href: '/api-keys', icon: Key },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = item.match
    ? item.match(pathname)
    : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.name}
      className={cn(
        'flex items-center gap-2.5 px-3 py-[7px] text-[12.5px] transition-colors',
        'font-mono tracking-[0.06em] leading-none',
        active
          ? 'text-[color:var(--ink-0)] bg-[color:var(--bg-2)]'
          : 'text-[color:var(--ink-2)] hover:text-[color:var(--ink-0)] hover:bg-[color:var(--bg-2)]'
      )}
      style={{
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      <Icon
        className="w-3.5 h-3.5 shrink-0"
        strokeWidth={active ? 2 : 1.5}
        style={{ color: active ? 'var(--accent)' : 'currentColor' }}
      />
      <span>{item.name}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 overflow-y-auto"
      style={{
        width: '200px',
        borderRight: '1px solid var(--rule)',
        background: 'var(--bg-1)',
      }}
    >
      <nav className="flex-1 py-3" aria-label="Primary navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <div
              className="px-3 pt-4 pb-1.5"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ))}
      </nav>

      <div
        className="py-2"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;
