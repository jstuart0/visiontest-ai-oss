'use client';

// Credentials management.
//
// Security-first UX: we NEVER display blob values. Create/rotate enter
// values through a key-value builder that clears on submit. The UI
// shows metadata only (key, scope, env, version, last-rotated). Delete
// surfaces the "blocked by N tests" state explicitly.

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Plus,
  Trash2,
  RotateCw,
  Shield,
  ShieldAlert,
  Info,
  Loader2,
  Globe,
  Folder,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { credentialsApi, type Credential } from '@/lib/api';

type FieldRow = { key: string; value: string };

const DEFAULT_FIELDS: FieldRow[] = [
  { key: 'email', value: '' },
  { key: 'password', value: '' },
];

export default function CredentialsPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();

  const orgId = project?.orgId;
  const [createOpen, setCreateOpen] = useState(false);
  const [rotating, setRotating] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const [revealed, setRevealed] = useState(false);

  const [draft, setDraft] = useState<{
    key: string;
    environment: string;
    scope: 'project' | 'org';
    allowEnvironmentFallback: boolean;
    fields: FieldRow[];
  }>({
    key: '',
    environment: '',
    scope: 'project',
    allowEnvironmentFallback: false,
    fields: DEFAULT_FIELDS,
  });

  const [rotateFields, setRotateFields] = useState<FieldRow[]>(DEFAULT_FIELDS);
  const [rotateFallback, setRotateFallback] = useState(false);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials', orgId, project?.id],
    queryFn: () => credentialsApi.list(orgId!, project?.id),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const blob: Record<string, string> = {};
      for (const row of draft.fields) {
        if (row.key.trim() && row.value.length > 0) {
          blob[row.key.trim()] = row.value;
        }
      }
      return credentialsApi.create({
        orgId: orgId!,
        projectId: draft.scope === 'project' ? project!.id : undefined,
        key: draft.key.trim(),
        environment: draft.environment.trim() || undefined,
        blob,
        allowEnvironmentFallback: draft.allowEnvironmentFallback,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Credential created');
      setCreateOpen(false);
      setDraft({
        key: '',
        environment: '',
        scope: 'project',
        allowEnvironmentFallback: false,
        fields: DEFAULT_FIELDS,
      });
    },
    onError: (err: any) => toast.error(err.message || 'Create failed'),
  });

  const rotateMutation = useMutation({
    mutationFn: () => {
      if (!rotating) throw new Error('no credential');
      const blob: Record<string, string> = {};
      for (const row of rotateFields) {
        if (row.key.trim() && row.value.length > 0) {
          blob[row.key.trim()] = row.value;
        }
      }
      return credentialsApi.rotate(rotating.id, {
        blob: Object.keys(blob).length > 0 ? blob : undefined,
        allowEnvironmentFallback: rotateFallback,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Credential rotated — tests will pick up v+1');
      setRotating(null);
      setRotateFields(DEFAULT_FIELDS);
    },
    onError: (err: any) => toast.error(err.message || 'Rotate failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => credentialsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Credential deleted');
      setDeleting(null);
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed'),
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">
          Select a project to manage credentials
        </div>
        <Link href="/">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const projectCreds =
    credentials?.filter((c) => c.projectId === project.id) ?? [];
  const orgCreds =
    credentials?.filter((c) => c.projectId === null) ?? [];

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 space-y-10 vt-reveal">
      <header className="pb-6 border-b flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Credentials · Encrypted at rest</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 0.97 }}>
            Store once. <em>Reference everywhere.</em>
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            AES-256-GCM encrypted. Referenced by stories via{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              {'{{creds.<key>}}'}
            </code>{' '}
            — never inlined. We never show blob values back to you — if
            you lose one, rotate.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0">
              <Plus className="w-4 h-4 mr-2" /> New credential
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>New credential</DialogTitle>
              <DialogDescription>
                Choose a key name, scope, environment, and the fields
                stories will reference.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Key <span className="text-red-400">*</span>
                  </label>
                  <Input
                    autoFocus
                    value={draft.key}
                    onChange={(e) =>
                      setDraft({ ...draft, key: e.target.value })
                    }
                    placeholder="admin"
                    className="bg-muted border-border font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use in stories: {`{{creds.${draft.key || 'admin'}}}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Environment
                  </label>
                  <Input
                    value={draft.environment}
                    onChange={(e) =>
                      setDraft({ ...draft, environment: e.target.value })
                    }
                    placeholder="blank = default"
                    className="bg-muted border-border"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    e.g. staging, prod. Blank matches tests with no env set.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, scope: 'project' })}
                    className={`border rounded-md px-3 py-2 text-sm text-left flex items-start gap-2 ${
                      draft.scope === 'project'
                        ? 'bg-accent border-accent'
                        : 'bg-muted border-border hover:bg-accent/50'
                    }`}
                  >
                    <Folder className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Project</div>
                      <div className="text-xs text-muted-foreground">
                        Available only to {project.name}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, scope: 'org' })}
                    className={`border rounded-md px-3 py-2 text-sm text-left flex items-start gap-2 ${
                      draft.scope === 'org'
                        ? 'bg-accent border-accent'
                        : 'bg-muted border-border hover:bg-accent/50'
                    }`}
                  >
                    <Globe className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Org-wide</div>
                      <div className="text-xs text-muted-foreground">
                        Any project in the org can use it
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {draft.environment === '' && (
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.allowEnvironmentFallback}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        allowEnvironmentFallback: e.target.checked,
                      })
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="text-foreground">Allow as fallback</span>
                    <span className="block text-xs text-muted-foreground">
                      Tests with an environment set can use this default
                      credential when no env-specific one exists. Leave off
                      for prod-like credentials you don&apos;t want
                      accidentally used.
                    </span>
                  </span>
                </label>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">
                    Fields
                  </label>
                  <button
                    type="button"
                    onClick={() => setRevealed(!revealed)}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    {revealed ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide values
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Show values
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.fields.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={row.key}
                        onChange={(e) => {
                          const fields = [...draft.fields];
                          fields[i] = { ...row, key: e.target.value };
                          setDraft({ ...draft, fields });
                        }}
                        placeholder="field name"
                        className="bg-muted border-border font-mono text-sm w-40"
                      />
                      <Input
                        type={revealed ? 'text' : 'password'}
                        value={row.value}
                        onChange={(e) => {
                          const fields = [...draft.fields];
                          fields[i] = { ...row, value: e.target.value };
                          setDraft({ ...draft, fields });
                        }}
                        placeholder="value"
                        className="bg-muted border-border font-mono text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const fields = draft.fields.filter(
                            (_, j) => j !== i,
                          );
                          setDraft({
                            ...draft,
                            fields: fields.length
                              ? fields
                              : [{ key: '', value: '' }],
                          });
                        }}
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        fields: [...draft.fields, { key: '', value: '' }],
                      })
                    }
                    className="text-muted-foreground"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add field
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  !draft.key.trim() ||
                  !draft.fields.some((f) => f.key.trim() && f.value) ||
                  createMutation.isPending
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Create credential'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading credentials…
        </div>
      ) : (credentials?.length ?? 0) === 0 ? (
        <Card className="bg-card border-dashed border-border">
          <CardContent className="py-12 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-foreground font-medium">
                No credentials yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Store login details once, reference by key in every story.
                Rotate in-place — tests pick up the new blob on the next run.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" /> Add first credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {projectCreds.length > 0 && (
            <CredentialSection
              title="This project"
              icon={Folder}
              items={projectCreds}
              onRotate={(c) => {
                setRotating(c);
                setRotateFields(DEFAULT_FIELDS);
                setRotateFallback(c.allowEnvironmentFallback);
              }}
              onDelete={setDeleting}
            />
          )}
          {orgCreds.length > 0 && (
            <CredentialSection
              title="Org-wide"
              icon={Globe}
              items={orgCreds}
              onRotate={(c) => {
                setRotating(c);
                setRotateFields(DEFAULT_FIELDS);
                setRotateFallback(c.allowEnvironmentFallback);
              }}
              onDelete={setDeleting}
            />
          )}
        </div>
      )}

      {/* Rotate dialog */}
      <Dialog
        open={!!rotating}
        onOpenChange={(open) => {
          if (!open) setRotating(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="w-5 h-5" /> Rotate{' '}
              <code className="text-sm bg-muted px-2 py-0.5 rounded">
                {rotating?.key}
              </code>
            </DialogTitle>
            <DialogDescription>
              Current version: v{rotating?.version}. Rotating bumps to v
              {(rotating?.version ?? 0) + 1}. Running tests won&apos;t be
              affected until their next run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {rotateFields.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => {
                    const f = [...rotateFields];
                    f[i] = { ...row, key: e.target.value };
                    setRotateFields(f);
                  }}
                  className="bg-muted border-border font-mono text-sm w-40"
                />
                <Input
                  type="password"
                  value={row.value}
                  onChange={(e) => {
                    const f = [...rotateFields];
                    f[i] = { ...row, value: e.target.value };
                    setRotateFields(f);
                  }}
                  placeholder="new value"
                  className="bg-muted border-border font-mono text-sm flex-1"
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={rotateFallback}
                onChange={(e) => setRotateFallback(e.target.checked)}
              />
              <span className="text-foreground">
                Allow as environment fallback
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRotating(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {rotateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCw className="w-4 h-4 mr-2" />
              )}
              Rotate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" /> Delete{' '}
              <code className="text-sm bg-muted px-2 py-0.5 rounded">
                {deleting?.key}
              </code>
              ?
            </DialogTitle>
            <DialogDescription>
              If any test still references this key, the delete will be
              rejected by the server — we&apos;ll tell you which tests to
              repoint first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialSection({
  title,
  icon: Icon,
  items,
  onRotate,
  onDelete,
}: {
  title: string;
  icon: React.ElementType;
  items: Credential[];
  onRotate: (c: Credential) => void;
  onDelete: (c: Credential) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {title}
      </div>
      <Card className="bg-card border-border">
        <CardContent className="p-0 divide-y divide-border">
          {items.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-shrink-0">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm text-foreground">
                    {c.key}
                  </code>
                  {c.environment ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono bg-muted/50"
                    >
                      env: {c.environment}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-muted/50 text-muted-foreground"
                    >
                      default env
                    </Badge>
                  )}
                  {c.allowEnvironmentFallback && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-900/20 text-blue-300 border-blue-800/50"
                      title="This credential can be used as a fallback when a more-specific env match doesn't exist."
                    >
                      fallback
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  v{c.version} · rotated{' '}
                  {new Date(c.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRotate(c)}
                className="text-muted-foreground hover:text-foreground"
                title="Rotate this credential's blob — version increments"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(c)}
                className="text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
