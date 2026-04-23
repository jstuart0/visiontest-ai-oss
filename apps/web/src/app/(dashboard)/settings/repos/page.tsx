'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  GitBranch,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  // Form state
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

  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Archives · Repositories</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(34px, 4.5vw, 56px)', lineHeight: 0.98 }}>
            Where the <em>code</em> lives.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            GitHub, GitLab, or a local checkout — the source the auto-fixer
            reads and writes to. Paired with a Fix Runner that can execute
            the repo&apos;s test suite in a sandbox.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Connect Repository
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Repository</DialogTitle>
              <DialogDescription>
                Link a Git repository for code investigation and fix generation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GITHUB">GitHub</SelectItem>
                    <SelectItem value="GITLAB">GitLab</SelectItem>
                    <SelectItem value="BITBUCKET">Bitbucket</SelectItem>
                    <SelectItem value="LOCAL">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Repository URL</Label>
                <Input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>
              <div>
                <Label>Default Branch</Label>
                <Input
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div>
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_..."
                />
              </div>
              <div>
                <Label>Repository Type</Label>
                <Select value={repoType} onValueChange={setRepoType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Single Repo</SelectItem>
                    <SelectItem value="MONOREPO">Monorepo</SelectItem>
                    <SelectItem value="SERVICE">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {repoType === 'MONOREPO' && (
                <div>
                  <Label>Default Path (monorepo sub-path)</Label>
                  <Input
                    value={defaultPath}
                    onChange={(e) => setDefaultPath(e.target.value)}
                    placeholder="packages/app"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={addLoading || !repoUrl}>
                {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : repos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No repositories connected</h3>
            <p className="text-muted-foreground mt-1">
              Connect a repository to enable code investigation and autonomous fixes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    <CardTitle className="text-base">{repo.repoUrl}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {repo.lastTestResult === 'success' ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : repo.lastTestResult === 'failure' ? (
                      <Badge variant="outline" className="text-red-600">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not tested</Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {repo.provider} - {repo.repoType} - Branch: {repo.defaultBranch}
                  {repo.defaultPath && ` - Path: ${repo.defaultPath}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(repo.id)}
                    disabled={testLoading === repo.id}
                  >
                    {testLoading === repo.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(repo.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
