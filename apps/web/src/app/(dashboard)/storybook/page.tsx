'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  BookOpen,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Search,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface StoryTest {
  id: string;
  name: string;
  status: string;
  storybookStoryId: string | null;
  storybookImport: string | null;
  tags: string[];
  createdAt: string;
}

interface StorybookConfigData {
  enabled: boolean;
  mode: string;
  storybookUrl: string | null;
  lastSyncAt: string | null;
  lastSyncStoryCount: number | null;
  lastSyncError: string | null;
}

export default function StorybookPage() {
  const { project } = useCurrentProject();
  const [stories, setStories] = useState<StoryTest[]>([]);
  const [config, setConfig] = useState<StorybookConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (project?.id) {
      loadData();
    }
  }, [project?.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [storiesData, configData] = await Promise.all([
        api.get<StoryTest[]>('/storybook/stories', { projectId: project!.id }),
        api.get<StorybookConfigData>('/storybook/config', { projectId: project!.id }),
      ]);
      setStories(storiesData || []);
      setConfig(configData);
    } catch (error) {
      console.error('Failed to load storybook data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!config?.storybookUrl) return;
    setSyncing(true);
    try {
      await api.post('/storybook/sync', { projectId: project!.id });
      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }

  const filtered = stories.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  // Group by component (first two parts of name: "Storybook / Component / Story")
  const grouped = new Map<string, StoryTest[]>();
  for (const story of filtered) {
    const parts = story.name.split(' / ');
    const group = parts.length >= 3 ? parts.slice(0, 2).join(' / ') : parts[0];
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(story);
  }

  // Component gallery — stories grouped by component. Emphasise
  // component COUNT as the Fraunces numeral; stories count reads as
  // sub-meta. No "Stats" label — the headline is the stat.
  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-5">§ Gallery · Storybook</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <h1 className="vt-display" style={{ fontSize: 'clamp(38px, 5vw, 60px)', lineHeight: 0.98 }}>
              Your components, <em>on stage</em>.
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '62ch' }}
            >
              Every story synced from your Storybook instance becomes a
              fixture VisionTest can photograph. Hover, click, convert to
              a test.{' '}
              <span className="vt-mono text-[13px]" style={{ color: 'var(--ink-2)' }}>
                {config?.lastSyncAt
                  ? `Last sync: ${new Date(config.lastSyncAt).toLocaleString()}`
                  : 'Not synced yet.'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/settings/storybook" className="vt-btn">
              <Settings className="w-4 h-4" /> Configure
            </Link>
            {config?.storybookUrl && (
              <button type="button" onClick={handleSync} disabled={syncing} className="vt-btn vt-btn--primary">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync now
              </button>
            )}
          </div>
        </div>
      </header>

      {config?.lastSyncError && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10 text-sm text-red-800 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Last sync error: {config.lastSyncError}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search stories..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Stats */}
      {stories.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {stories.length} stories - {grouped.size} components
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : stories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Storybook stories</h3>
            <p className="text-muted-foreground mt-1">
              Connect your Storybook to auto-discover components and create visual tests.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link href="/settings/storybook/wizard">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white"><BookOpen className="h-4 w-4 mr-2" /> Set Up Storybook</Button>
              </Link>
              <Link href="/settings/storybook">
                <Button variant="outline"><Settings className="h-4 w-4 mr-2" /> Advanced Settings</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([group, groupStories]) => (
            <Card key={group}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {group.replace('Storybook / ', '')}
                  <Badge variant="outline" className="text-xs">{groupStories.length} stories</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {groupStories.map((story) => {
                    const storyName = story.name.split(' / ').pop() || story.name;
                    return (
                      <Link key={story.id} href={`/tests/${story.id}`} className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors text-center">
                        <div className="w-full h-16 bg-muted rounded mb-2 flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-xs font-medium truncate">{storyName}</p>
                        <div className="mt-1">
                          {story.status === 'ACTIVE' ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600 inline" />
                          ) : story.status === 'ARCHIVED' ? (
                            <Circle className="h-3 w-3 text-gray-400 inline" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-yellow-600 inline" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
