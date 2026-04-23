'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Search,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

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

  const filtered = stories.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = new Map<string, StoryTest[]>();
  for (const story of filtered) {
    const parts = story.name.split(' / ');
    const group = parts.length >= 3 ? parts.slice(0, 2).join(' / ') : parts[0];
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(story);
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const lastSyncStamp = config?.lastSyncAt
    ? new Date(config.lastSyncAt).toISOString().slice(0, 16).replace('T', ' · ')
    : '— · NEVER';

  if (!project) {
    return (
      <VtStage width="narrow">
        <EditorialHero
          width="narrow"
          sheet="S-00"
          eyebrow="§ CATALOG · STORYBOOK"
          revision={<>REV · 01 · {isoDate}</>}
          title={<>no <em>project</em> selected.</>}
          lead="The component catalog is scoped to a project. Choose one from the switcher to see its index."
        />
      </VtStage>
    );
  }

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`S-${String(stories.length).padStart(2, '0')}`}
        eyebrow="§ CATALOG · STORYBOOK"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            component <em>catalog</em>.
          </>
        }
        lead="Every story synced from your Storybook instance is indexed here as a fixture. Photograph any of them, promote to a test, keep the baseline."
        actions={
          <>
            <Link href="/settings/storybook" className="vt-btn">
              <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
              CONFIGURE
            </Link>
            {config?.storybookUrl && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="vt-btn vt-btn--primary"
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                SYNC
              </button>
            )}
          </>
        }
      >
        {/* ── Title block ───────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">CATALOG ID</span>
            <span className="v">
              VT-S-{(project.slug || project.id.slice(-8)).toUpperCase()}
            </span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">LAST SYNC · UTC</span>
            <span className="v">{lastSyncStamp}</span>
          </div>
          <div className="span2">
            <span className="k">COMPONENTS</span>
            <span className="v">{String(grouped.size).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">STORIES</span>
            <span className="v">{String(stories.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">MODE</span>
            <span className="v">{(config?.mode || 'MANUAL').toUpperCase()}</span>
          </div>
        </div>

        {/* ── Sync error ────────────────────────────────────────────── */}
        {config?.lastSyncError && (
          <div
            style={{
              border: '1px solid var(--fail)',
              background: 'var(--fail-soft)',
              padding: '16px 20px',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--fail)' }} />
              <span
                className="vt-mono"
                style={{
                  fontSize: '10.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--fail)',
                }}
              >
                LAST SYNC · ERROR
              </span>
            </div>
            <p
              className="vt-mono"
              style={{
                fontSize: '12px',
                color: 'var(--ink-1)',
                lineHeight: 1.5,
              }}
            >
              {config.lastSyncError}
            </p>
          </div>
        )}

        {/* ── Search ────────────────────────────────────────────────── */}
        <div
          className="relative"
          style={{
            border: '1px solid var(--rule)',
            background: 'color-mix(in oklab, var(--bg-1) 45%, transparent)',
            padding: '6px 10px 6px 38px',
          }}
        >
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            strokeWidth={1.5}
            style={{ color: 'var(--ink-2)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH STORIES…"
            className="vt-mono w-full bg-transparent border-none outline-none"
            style={{
              fontSize: '12px',
              letterSpacing: '0.14em',
              color: 'var(--ink-0)',
              textTransform: 'uppercase',
              padding: '6px 0',
            }}
          />
        </div>

        {/* ── Catalog index ─────────────────────────────────────────── */}
        <section aria-labelledby="index-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="index-head">library index</span>
            <span className="rule" />
            <span className="stamp">
              {String(grouped.size).padStart(2, '0')} · COMPONENTS
            </span>
          </div>

          {loading ? (
            <LoadingFrame label="READING CATALOG" />
          ) : stories.length === 0 ? (
            <EmptyFrame
              label="CATALOG EMPTY"
              body="Connect a Storybook instance and the library index will populate. Every story becomes a fixture the camera can work with."
              action={
                <div className="flex items-center gap-2">
                  <Link href="/settings/storybook/wizard" className="vt-btn vt-btn--primary">
                    SET UP STORYBOOK
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Link>
                  <Link href="/settings/storybook" className="vt-btn">
                    <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
                    ADVANCED
                  </Link>
                </div>
              }
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              {Array.from(grouped.entries()).map(([group, groupStories], idx) => (
                <div
                  key={group}
                  style={{
                    borderBottom:
                      idx < grouped.size - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div
                    className="grid grid-cols-[90px_1fr_100px] items-center"
                    style={{ borderBottom: '1px solid var(--rule-soft)' }}
                  >
                    <div
                      className="py-3 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11px',
                        letterSpacing: '0.14em',
                        color: 'var(--accent)',
                      }}
                    >
                      C-{String(idx + 1).padStart(3, '0')}
                    </div>
                    <div
                      className="py-3 px-4"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                        borderRight: '1px solid var(--rule-soft)',
                      }}
                    >
                      {group.replace('Storybook / ', '')}
                    </div>
                    <div
                      className="py-3 px-4 vt-mono text-right"
                      style={{
                        fontSize: '10.5px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      {String(groupStories.length).padStart(2, '0')} STORIES
                    </div>
                  </div>
                  <div>
                    {groupStories.map((story, si) => {
                      const storyName = story.name.split(' / ').pop() || story.name;
                      const statusColor =
                        story.status === 'ACTIVE'
                          ? 'var(--pass)'
                          : story.status === 'ARCHIVED'
                          ? 'var(--ink-2)'
                          : 'var(--warn)';
                      return (
                        <Link
                          key={story.id}
                          href={`/tests/${story.id}`}
                          className="grid grid-cols-[90px_1fr_140px_100px] items-center group"
                          style={{
                            borderBottom:
                              si < groupStories.length - 1
                                ? '1px solid var(--rule-soft)'
                                : 'none',
                            textDecoration: 'none',
                            transition: 'background var(--dur-quick) var(--ease-out)',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              'color-mix(in oklab, var(--bg-2) 35%, transparent)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = 'transparent')
                          }
                        >
                          <div
                            className="py-3 px-4 vt-mono"
                            style={{
                              borderRight: '1px solid var(--rule-soft)',
                              fontSize: '10.5px',
                              letterSpacing: '0.12em',
                              color: 'var(--ink-2)',
                            }}
                          >
                            · {String(si + 1).padStart(2, '0')}
                          </div>
                          <div
                            className="py-3 px-4 truncate"
                            style={{
                              borderRight: '1px solid var(--rule-soft)',
                              fontFamily: 'var(--font-body)',
                              fontSize: '13.5px',
                              color: 'var(--ink-0)',
                            }}
                          >
                            <span className="group-hover:text-[color:var(--accent)] transition-colors">
                              {storyName}
                            </span>
                          </div>
                          <div
                            className="py-3 px-4 vt-mono text-right"
                            style={{
                              borderRight: '1px solid var(--rule-soft)',
                              fontSize: '10px',
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              color: statusColor,
                            }}
                          >
                            {story.status}
                          </div>
                          <div className="py-3 px-4 flex items-center justify-end">
                            <ArrowRight
                              className="w-3 h-3 transition-transform group-hover:translate-x-1"
                              strokeWidth={1.5}
                              style={{ color: 'var(--ink-2)' }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer
          className="pt-6 flex justify-between gap-4 flex-wrap"
          style={{
            borderTop: '1px solid var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>SHEET · CATALOG · {project.name}</span>
          <span>SYNCED · {lastSyncStamp}</span>
          <span>FIXTURES · {String(stories.length).padStart(3, '0')}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function EmptyFrame({
  label,
  body,
  action,
}: {
  label: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 20%, transparent)',
      }}
    >
      <div
        className="vt-mono"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>
      <p
        className="mx-auto mt-4"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-1)',
          maxWidth: '52ch',
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 20%, transparent)',
      }}
    >
      <Loader2
        className="w-5 h-5 animate-spin mx-auto mb-4"
        strokeWidth={1.5}
        style={{ color: 'var(--ink-2)' }}
      />
      <div
        className="vt-mono"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>
    </div>
  );
}
