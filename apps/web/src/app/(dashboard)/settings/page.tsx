'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Bell,
  Key,
  Globe,
  Save,
  Trash2,
  AlertTriangle,
  Info,
  Wrench,
  GitBranch,
  Shield,
  CheckSquare,
  Server,
  ChevronRight,
  Brain,
  Eye,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCurrentProject } from '@/hooks/useProject';
import { projectsApi, apiKeysApi, ApiKeyData } from '@/lib/api';
import { useProjectStore } from '@/stores/project.store';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { project } = useCurrentProject();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setCurrentProject } = useProjectStore();

  const [projectSettings, setProjectSettings] = useState({
    name: '',
    description: '',
  });

  const [notifications, setNotifications] = useState({
    emailOnFailure: true,
    emailOnApproval: false,
    slackOnFailure: false,
    slackOnApproval: false,
    slackWebhookUrl: '',
  });

  const [deleteConfirm, setDeleteConfirm] = useState('');

  // Sync project settings when project loads
  useEffect(() => {
    if (project) {
      setProjectSettings({
        name: project.name || '',
        description: project.description || '',
      });
      const notifSettings = (project.settings as any)?.notifications;
      if (notifSettings) {
        setNotifications((prev) => ({ ...prev, ...notifSettings }));
      }
    }
  }, [project]);

  // API Keys query
  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

  // Project update mutation
  const updateProjectMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      projectsApi.update(project!.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProject({ ...project!, ...updated });
      toast.success('Project settings saved');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to save'),
  });

  // Notification save mutation
  const saveNotificationsMutation = useMutation({
    mutationFn: (notifs: typeof notifications) =>
      projectsApi.update(project!.id, {
        settings: { ...(project?.settings || {}), notifications: notifs },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Notification preferences saved');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to save'),
  });

  // Project delete mutation
  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.delete(project!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProject(null as any);
      toast.success('Project deleted');
      router.push('/dashboard');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete project'),
  });

  // API Key create mutation
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);

  const createKeyMutation = useMutation({
    mutationFn: () => {
      return apiKeysApi.create({ name: newKeyName, scopes: newKeyScopes });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyVisible(data.key || data.rawKey);
      setNewKeyName('');
      toast.success('API key created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create API key'),
  });

  // API Key revoke mutation
  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to revoke'),
  });

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a project first</p>
      </div>
    );
  }

  // Workbench — tools grouped by purpose. The tabs are the shelves:
  // project / automation / notifications / integrations / api. No
  // metric hero; the page is utilitarian on purpose.
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-5">§ Workbench · Settings</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(38px, 5vw, 60px)', lineHeight: 0.98 }}>
          The <em>tools</em> behind the work.
        </h1>
        <p
          className="mt-4 vt-italic"
          style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '58ch' }}
        >
          Project defaults, automation, notifications, integrations, API
          keys. Change carefully.
        </p>
      </header>

      <Tabs defaultValue="project" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="project"><Building2 className="w-4 h-4 mr-2" />Project</TabsTrigger>
          <TabsTrigger value="automation"><Wrench className="w-4 h-4 mr-2" />Automation</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" />Notifications</TabsTrigger>
          <TabsTrigger value="integrations"><Globe className="w-4 h-4 mr-2" />Integrations</TabsTrigger>
          <TabsTrigger value="api"><Key className="w-4 h-4 mr-2" />API Keys</TabsTrigger>
        </TabsList>

        {/* Project Settings */}
        <TabsContent value="project" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Configure your project details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={projectSettings.name}
                    onChange={(e) => setProjectSettings((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={projectSettings.description}
                  onChange={(e) => setProjectSettings((s) => ({ ...s, description: e.target.value }))}
                />
              </div>
              <Button
                onClick={() => updateProjectMutation.mutate(projectSettings)}
                disabled={updateProjectMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-900/50">
            <CardHeader>
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions for this project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will permanently delete the project and all its tests, executions, baselines, and comparisons.
              </p>
              <div className="space-y-2">
                <Label>Type <strong>{project.name}</strong> to confirm:</Label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={project.name}
                />
              </div>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== project.name || deleteProjectMutation.isPending}
                onClick={() => deleteProjectMutation.mutate()}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation (Fixes) */}
        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Autonomous Bug Fixing</CardTitle>
              <CardDescription>Configure repository connections, fix policies, verification profiles, and runners</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { href: '/settings/ai-providers', icon: Brain, title: 'AI Providers', desc: 'Configure LLM providers for analysis and fix generation (Anthropic, OpenAI, Gemini, OpenRouter, Local)', wizard: '' },
                { href: '/settings/ai-diff', icon: Eye, title: 'AI Visual Diff', desc: 'Configure AI-powered visual difference analysis pipeline (SSIM, LPIPS, DINOv2, VLM)', wizard: '/settings/ai-diff/wizard' },
                { href: '/settings/storybook', icon: BookOpen, title: 'Storybook Integration', desc: 'Connect Storybook for automatic component-level visual regression tests', wizard: '/settings/storybook/wizard' },
                { href: '/settings/repos', icon: GitBranch, title: 'Repository Connections', desc: 'Link Git repositories for code investigation and fix generation', wizard: '' },
                { href: '/settings/fix-policies', icon: Shield, title: 'Fix Policies', desc: 'Safety constraints for automated fixing', wizard: '' },
                { href: '/settings/verification-profiles', icon: CheckSquare, title: 'Verification Profiles', desc: 'Define what checks run after a fix is generated', wizard: '' },
                { href: '/settings/runners', icon: Server, title: 'Fix Runners', desc: 'Manage runners that execute fix sessions', wizard: '' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {item.title}
                      {item.wizard && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Guided Setup</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email on Failure</Label>
                  <p className="text-sm text-muted-foreground">Get emailed when tests fail</p>
                </div>
                <Switch
                  checked={notifications.emailOnFailure}
                  onCheckedChange={(checked) => setNotifications((n) => ({ ...n, emailOnFailure: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email on Approval Needed</Label>
                  <p className="text-sm text-muted-foreground">Get emailed when visual changes need review</p>
                </div>
                <Switch
                  checked={notifications.emailOnApproval}
                  onCheckedChange={(checked) => setNotifications((n) => ({ ...n, emailOnApproval: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Slack on Failure</Label>
                  <p className="text-sm text-muted-foreground">Post to Slack when tests fail</p>
                </div>
                <Switch
                  checked={notifications.slackOnFailure}
                  onCheckedChange={(checked) => setNotifications((n) => ({ ...n, slackOnFailure: checked }))}
                />
              </div>
              {(notifications.slackOnFailure || notifications.slackOnApproval) && (
                <div className="space-y-2">
                  <Label>Slack Webhook URL</Label>
                  <Input
                    value={notifications.slackWebhookUrl}
                    onChange={(e) => setNotifications((n) => ({ ...n, slackWebhookUrl: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
              )}
              <Button
                onClick={() => saveNotificationsMutation.mutate(notifications)}
                disabled={saveNotificationsMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {saveNotificationsMutation.isPending ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>CI/CD Integrations</CardTitle>
              <CardDescription>Connect VisionTest.ai to your development workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-6 rounded-lg border border-border bg-muted/30 text-center">
                <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Coming Soon</p>
                <p className="text-sm text-muted-foreground mt-1">
                  GitHub, GitLab, and Slack integrations are under development.
                  Use API keys and webhooks for CI/CD integration in the meantime.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for programmatic access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New key creation */}
              <div className="flex gap-2">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. CI Pipeline)"
                  className="flex-1"
                />
                <Select value={newKeyScopes.join(',')} onValueChange={(v) => setNewKeyScopes(v.split(','))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="read,write">Read+Write</SelectItem>
                    <SelectItem value="read,write,execute">Full</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => createKeyMutation.mutate()}
                  disabled={!newKeyName || createKeyMutation.isPending}
                >
                  <Key className="w-4 h-4 mr-2" /> Generate
                </Button>
              </div>

              {/* Newly created key display */}
              {newKeyVisible && (
                <div className="p-4 rounded-lg border border-green-600/50 bg-green-950/20">
                  <p className="text-sm font-medium text-green-400 mb-2">New API Key (copy now -- it won't be shown again):</p>
                  <code className="text-sm font-mono text-green-300 break-all select-all">{newKeyVisible}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(newKeyVisible);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              )}

              {/* Existing keys */}
              {apiKeys && apiKeys.length > 0 ? (
                <div className="space-y-2">
                  {apiKeys.map((key: ApiKeyData) => (
                    <div key={key.id} className={`flex items-center justify-between p-3 rounded-lg border ${key.revokedAt ? 'opacity-50' : ''}`}>
                      <div>
                        <p className="font-medium text-sm">{key.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {key.keyPrefix}... &middot; {key.scopes?.join(', ')}
                          {key.lastUsedAt && ` &middot; Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      {!key.revokedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          onClick={() => revokeKeyMutation.mutate(key.id)}
                        >
                          Revoke
                        </Button>
                      )}
                      {key.revokedAt && <Badge variant="secondary">Revoked</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No API keys yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
