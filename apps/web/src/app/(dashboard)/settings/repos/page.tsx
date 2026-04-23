'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface RepoConnection {
  id: string;
  projectId: string;
  provider: string;
  repoUrl: string;
  defaultBranch: string;
  authMode: string;
  repoType: string;
  defaultPath: string | null;
  cloneStrategy: string;
  allowedPaths: string[];
  blockedPaths: string[];
  isActive: boolean;
  hasToken: boolean;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  createdAt: string;
}

export default function RepoSettingsPage() {
  const { project: currentProject } = useCurrentProject();
  const [repos, setRepos] = useState<RepoConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [testLoading, setTestLoading] = useState<string | null>(null);

  const [provider, setProvider] = useState('GITHUB');
  const [repoUrl, setRepoUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [token, setToken] = useState('');
  const [repoType, setRepoType] = useState('SINGLE');
  const [defaultPath, setDefaultPath] = useState('');

  useEffect(() => {
    if (currentProject?.id) loadRepos();
  }, [currentProject?.id]);

  async function loadRepos() {
    if (!currentProject?.id) return;
    setLoading(true);
    try {
      const data = await api.get<RepoConnection[]>('/repos', { projectId: currentProject.id });
      setRepos(data || []);
    } catch (error) {
      console.error('Failed to load repos:', error);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!currentProject?.id || !repoUrl) return;
    setAddLoading(true);
    try {
      await api.post('/repos', {
        projectId: currentProject.id,
        provider,
        repoUrl,
        defaultBranch,
        token: token || undefined,
        repoType,
        defaultPath: defaultPath || undefined,
      });
      setShowAdd(false);
      setRepoUrl('');
      setToken('');
      setDefaultPath('');
      await loadRepos();
    } catch (error) {
      console.error('Failed to add repo:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleTestConnection(repoId: string) {
    setTestLoading(repoId);
    try {
      await api.post(`/repos/${repoId}/test-connection`);
      await loadRepos();
    } catch (error) {
      console.error('Failed to test connection:', error);
    } finally {
      setTestLoading(null);
    }
  }

  async function handleDelete(repoId: string) {
    if (!confirm('Are you sure you want to remove this repository connection?')) return;
    try {
      await api.delete(`/repos/${repoId}`);
      await loadRepos();
    } catch (error) {
      console.error('Failed to delete repo:', error);
    }
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="07.D / 14"
        eyebrow="§ 07.D · ARCHIVES"
        back={{ href: '/settings', label: 'BACK · WORKBENCH' }}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>where the <em>code</em> lives.</>}
        lead="GitHub, GitLab, or a local checkout — the source the auto-fixer reads and writes to. Paired with a fix runner that can execute the repo’s test suite in a sandbox."
        actions={
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <button className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                CONNECT REPO
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Repository</DialogTitle>
                <DialogDescription>Link a Git repository for code investigation and fix generation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="PROVIDER">
                  <select className="vt-input" value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="GITHUB">GitHub</option>
                    <option value="GITLAB">GitLab</option>
                    <option value="BITBUCKET">Bitbucket</option>
                    <option value="LOCAL">Local</option>
                  </select>
                </Field>
                <Field label="REPOSITORY URL">
                  <input
                    className="vt-input"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/org/repo"
                  />
                </Field>
                <Field label="DEFAULT BRANCH">
                  <input
                    className="vt-input"
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                    placeholder="main"
                  />
                </Field>
                <Field label="ACCESS TOKEN">
                  <input
                    className="vt-input"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                  />
                </Field>
                <Field label="REPOSITORY TYPE">
                  <select className="vt-input" value={repoType} onChange={(e) => setRepoType(e.target.value)}>
                    <option value="SINGLE">Single Repo</option>
                    <option value="MONOREPO">Monorepo</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </Field>
                {repoType === 'MONOREPO' && (
                  <Field label="DEFAULT PATH · MONOREPO SUB-PATH">
                    <input
                      className="vt-input"
                      value={defaultPath}
                      onChange={(e) => setDefaultPath(e.target.value)}
                      placeholder="packages/app"
                    />
                  </Field>
                )}
              </div>
              <DialogFooter>
                <button className="vt-btn" onClick={() => setShowAdd(false)}>CANCEL</button>
                <button className="vt-btn vt-btn--primary" onClick={handleAdd} disabled={addLoading || !repoUrl}>
                  {addLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  CONNECT
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <section aria-labelledby="repos-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="repos-head">repositories on file</span>
            <span className="rule" />
            <span className="stamp">{repos.length.toString().padStart(2, '0')} CONNECTED</span>
          </div>

          {loading ? (
            <LoadingFrame />
          ) : repos.length === 0 ? (
            <EmptyFrame
              title="no repositories connected."
              body="Connect a repository to enable code investigation and autonomous fixes."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[100px_1fr_160px_160px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['CODE', 'REPO · URL', 'BRANCH · TYPE', 'LAST SYNC'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{ borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {repos.map((repo, i) => (
                <div
                  key={repo.id}
                  style={{
                    borderBottom: i < repos.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  }}
                >
                  <div className="grid grid-cols-[100px_1fr_160px_160px] gap-0 items-center">
                    <div
                      className="py-4 px-4"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        letterSpacing: '0.18em',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      R-{String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      className="py-4 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        className="vt-mono truncate"
                        style={{
                          fontSize: '13px',
                          color: 'var(--ink-0)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {repo.repoUrl}
                      </div>
                      <div
                        className="mt-1"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {repo.provider}
                        {repo.defaultPath && <> · {repo.defaultPath}</>}
                      </div>
                    </div>
                    <div
                      className="py-4 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11px',
                        color: 'var(--ink-1)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      <div>{repo.defaultBranch}</div>
                      <div className="mt-1" style={{ color: 'var(--ink-2)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        {repo.repoType}
                      </div>
                    </div>
                    <div className="py-4 px-4">
                      {repo.lastTestResult === 'success' ? (
                        <span className="vt-chip vt-chip--pass" style={{ fontSize: '9.5px' }}>
                          <CheckCircle2 className="w-3 h-3" /> CONNECTED
                        </span>
                      ) : repo.lastTestResult === 'failure' ? (
                        <span className="vt-chip vt-chip--fail" style={{ fontSize: '9.5px' }}>
                          <XCircle className="w-3 h-3" /> FAILED
                        </span>
                      ) : (
                        <span className="vt-chip" style={{ fontSize: '9.5px' }}>
                          UNTESTED
                        </span>
                      )}
                      {repo.lastTestedAt && (
                        <div
                          className="mt-2"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9.5px',
                            letterSpacing: '0.14em',
                            color: 'var(--ink-2)',
                            fontVariantNumeric: 'tabular-nums',
                            textTransform: 'uppercase',
                          }}
                        >
                          {new Date(repo.lastTestedAt).toISOString().slice(0, 16).replace('T', ' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'color-mix(in oklab, var(--bg-2) 20%, transparent)',
                    }}
                  >
                    <button
                      className="vt-btn"
                      style={{ padding: '6px 12px', fontSize: '10px' }}
                      onClick={() => handleTestConnection(repo.id)}
                      disabled={testLoading === repo.id}
                    >
                      {testLoading === repo.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      TEST CONNECTION
                    </button>
                    <button
                      className="vt-btn vt-btn--ghost"
                      style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--fail)' }}
                      onClick={() => handleDelete(repo.id)}
                    >
                      <Trash2 className="w-3 h-3" /> REMOVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </EditorialHero>
    </VtStage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mb-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function LoadingFrame() {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--ink-2)' }} />
      <div
        className="mt-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        LOADING
      </div>
    </div>
  );
}

function EmptyFrame({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div className="vt-kicker" style={{ color: 'var(--ink-2)', justifyContent: 'center' }}>
        PLATE EMPTY
      </div>
      <h3
        className="mt-3"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 2.4vw, 32px)',
          color: 'var(--ink-0)',
        }}
      >
        {title}
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}
