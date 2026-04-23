'use client';

// Credentials — the vault ledger.
//
// Every credential is a numbered entry (K-XXX) with its key, scope,
// environment, version, and last-rotated stamp. Blobs are never shown.
// An AES-256-GCM annotation is handwritten in the masthead. Expiry is
// not tracked in the schema — instead we stamp "REV · ROTATE" when a
// credential has not been rotated in 90+ days.

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  RotateCw,
  ShieldAlert,
  Loader2,
  Globe,
  Folder,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

type FieldRow = { key: string; value: string };

const DEFAULT_FIELDS: FieldRow[] = [
  { key: 'email', value: '' },
  { key: 'password', value: '' },
];

const ROTATE_WARN_DAYS = 90;

function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, '.');
}

function daysSince(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24)));
}

function relativeStamp(iso: string): string {
  const days = daysSince(iso);
  if (days === 0) return 'TODAY';
  if (days === 1) return '1 DAY AGO';
  if (days < 30) return `${days} DAYS AGO`;
  if (days < 365) return `${Math.floor(days / 30)} MO AGO`;
  return `${Math.floor(days / 365)} YR AGO`;
}

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
      toast.success('Credential filed');
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
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1 className="vt-display mb-6" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Pick a <em>project</em> to open its vault.
        </h1>
        <p className="text-[17px]" style={{ color: 'var(--ink-1)' }}>
          Credentials are indexed by org and optionally scoped to a project.
          Open the project switcher to proceed.
        </p>
      </VtStage>
    );
  }

  const projectCreds = credentials?.filter((c) => c.projectId === project.id) ?? [];
  const orgCreds = credentials?.filter((c) => c.projectId === null) ?? [];
  const total = (credentials?.length ?? 0);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="04 / 14"
        eyebrow="§ 04 · CREDENTIAL VAULT"
        revision={<>REV · 02 · {today}</>}
        title={
          <>
            credential <em>vault</em>
          </>
        }
        lead={
          <>
            Login details filed once, referenced from stories via{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                fontSize: '0.9em',
                letterSpacing: '0.03em',
              }}
            >
              {'{{creds.<key>}}'}
            </code>
            . Blobs are sealed at rest and never displayed back.
          </>
        }
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button type="button" className="vt-btn vt-btn--primary">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                NEW CREDENTIAL
              </button>
            </DialogTrigger>
            <CreateCredentialDialog
              project={project}
              draft={draft}
              setDraft={setDraft}
              revealed={revealed}
              setRevealed={setRevealed}
              onCancel={() => setCreateOpen(false)}
              onSubmit={() => createMutation.mutate()}
              pending={createMutation.isPending}
            />
          </Dialog>
        }
      >
        {/* Annotation — AES-256-GCM in Caveat script, ochre */}
        <div className="vt-annotation" style={{ marginTop: '-8px' }}>
          sealed w/ AES-256-GCM — if the key is lost, rotate.
        </div>

        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">ORG · PROJECT</span>
            <span className="v big">{project.name}</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-CRED-{(project.slug || project.id.slice(-6)).toUpperCase()}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">ENTRIES · TOTAL</span>
            <span className="v">{String(total).padStart(3, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">PROJECT-SCOPED</span>
            <span className="v">{String(projectCreds.length).padStart(3, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">ORG-WIDE</span>
            <span className="v">{String(orgCreds.length).padStart(3, '0')}</span>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingFrame label="LOADING VAULT" />
        ) : total === 0 ? (
          <EmptyVault onDraft={() => setCreateOpen(true)} />
        ) : (
          <>
            {projectCreds.length > 0 && (
              <CredentialSection
                sectionNum="05"
                title={`project · ${project.name}`}
                stamp="PROJECT-SCOPED"
                icon={Folder}
                items={projectCreds}
                prefix="K"
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
                sectionNum="06"
                title="org-wide"
                stamp="SHARED ACROSS ORG"
                icon={Globe}
                items={orgCreds}
                prefix="O"
                onRotate={(c) => {
                  setRotating(c);
                  setRotateFields(DEFAULT_FIELDS);
                  setRotateFallback(c.allowEnvironmentFallback);
                }}
                onDelete={setDeleting}
              />
            )}
          </>
        )}

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
          <span>SHEET 04 · VAULT · {project.name}</span>
          <span>SEALED · AES-256-GCM</span>
          <span>ENTRIES · {String(total).padStart(3, '0')}</span>
        </footer>
      </EditorialHero>

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
              <RotateCw className="w-5 h-5" strokeWidth={1.5} />
              Rotate{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--accent)',
                  background: 'var(--bg-2)',
                  padding: '2px 8px',
                  border: '1px solid var(--rule)',
                }}
              >
                {rotating?.key}
              </code>
            </DialogTitle>
            <DialogDescription>
              Current version · v{rotating?.version}. Rotating bumps to v
              {(rotating?.version ?? 0) + 1}. In-flight runs finish on the old
              blob; the next run picks up v+1.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {rotateFields.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.key}
                  onChange={(e) => {
                    const f = [...rotateFields];
                    f[i] = { ...row, key: e.target.value };
                    setRotateFields(f);
                  }}
                  className="vt-input"
                  style={{ width: '160px', fontSize: '12px' }}
                />
                <input
                  type="password"
                  value={row.value}
                  onChange={(e) => {
                    const f = [...rotateFields];
                    f[i] = { ...row, value: e.target.value };
                    setRotateFields(f);
                  }}
                  placeholder="new value"
                  className="vt-input"
                  style={{ flex: 1, fontSize: '12px' }}
                />
              </div>
            ))}
            <label
              className="flex items-center gap-2 pt-1 cursor-pointer"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-1)',
              }}
            >
              <input
                type="checkbox"
                checked={rotateFallback}
                onChange={(e) => setRotateFallback(e.target.checked)}
              />
              ALLOW AS ENVIRONMENT FALLBACK
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRotating(null)}
              className="vt-btn vt-btn--ghost"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
              className="vt-btn vt-btn--primary"
            >
              {rotateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              ROTATE
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--fail)' }} />
              Delete{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--fail)',
                  background: 'var(--fail-soft)',
                  padding: '2px 8px',
                  border: '1px solid color-mix(in oklab, var(--fail) 40%, var(--rule))',
                }}
              >
                {deleting?.key}
              </code>
              ?
            </DialogTitle>
            <DialogDescription>
              If any test still references this key, the delete will be
              rejected by the server — the response names the tests that
              need to be repointed first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="vt-btn vt-btn--ghost"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              className="vt-btn"
              style={{
                color: 'var(--fail)',
                borderColor: 'color-mix(in oklab, var(--fail) 50%, var(--rule))',
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              DELETE
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VtStage>
  );
}

/* ── Section + row ───────────────────────────────────────────────── */

function CredentialSection({
  sectionNum,
  title,
  stamp,
  icon: Icon,
  items,
  prefix,
  onRotate,
  onDelete,
}: {
  sectionNum: string;
  title: string;
  stamp: string;
  icon: React.ElementType;
  items: Credential[];
  prefix: string;
  onRotate: (c: Credential) => void;
  onDelete: (c: Credential) => void;
}) {
  return (
    <section>
      <div className="vt-section-head">
        <span className="num">§ {sectionNum}</span>
        <span className="ttl">{title}</span>
        <span className="rule" />
        <span className="stamp">{stamp}</span>
      </div>

      <div
        style={{
          border: '1px solid var(--rule-strong)',
          background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
        }}
      >
        <div
          className="grid grid-cols-[80px_1.4fr_120px_80px_140px_110px] gap-0"
          style={{
            borderBottom: '1px solid var(--rule-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          {['REF', 'KEY', 'ENV', 'VER', 'LAST ROTATED', 'ACTIONS'].map((h, i) => (
            <div
              key={i}
              className="py-3 px-4"
              style={{
                borderRight: i < 5 ? '1px solid var(--rule)' : 'none',
                textAlign: i === 3 ? 'right' : i === 5 ? 'right' : 'left',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {items.map((c, i) => (
          <CredentialRow
            key={c.id}
            cred={c}
            part={`${prefix}-${String(i + 1).padStart(3, '0')}`}
            isLast={i === items.length - 1}
            onRotate={() => onRotate(c)}
            onDelete={() => onDelete(c)}
            idx={i}
            icon={Icon}
          />
        ))}
      </div>
    </section>
  );
}

function CredentialRow({
  cred,
  part,
  isLast,
  onRotate,
  onDelete,
  idx,
  icon: Icon,
}: {
  cred: Credential;
  part: string;
  isLast: boolean;
  onRotate: () => void;
  onDelete: () => void;
  idx: number;
  icon: React.ElementType;
}) {
  const stale = daysSince(cred.updatedAt) >= ROTATE_WARN_DAYS;
  return (
    <div
      className="grid grid-cols-[80px_1.4fr_120px_80px_140px_110px] gap-0"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--rule-soft)',
        animation: `vt-reveal var(--dur-reveal) ${(idx + 1) * 30}ms var(--ease-out) both`,
      }}
    >
      <div
        className="py-4 px-4"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.16em',
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {part}
      </div>

      <div
        className="py-4 px-4 min-w-0 flex items-center gap-3"
        style={{ borderRight: '1px solid var(--rule-soft)' }}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: 'var(--ink-2)' }} />
        <div className="min-w-0">
          <div
            className="truncate"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--ink-0)',
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {cred.key}
          </div>
          {cred.allowEnvironmentFallback && (
            <div
              className="mt-1"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              fallback-eligible
            </div>
          )}
        </div>
      </div>

      <div
        className="py-4 px-4"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: cred.environment ? 'var(--ink-1)' : 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cred.environment || 'default'}
      </div>

      <div
        className="py-4 px-4 text-right"
        style={{
          borderRight: '1px solid var(--rule-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12.5px',
          color: 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.04em',
        }}
      >
        v{cred.version}
      </div>

      <div
        className="py-4 px-4"
        style={{ borderRight: '1px solid var(--rule-soft)' }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.1em',
            color: 'var(--ink-1)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isoDate(cred.updatedAt)}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {relativeStamp(cred.updatedAt)}
          </span>
          {stale && (
            <span className="vt-rev-stamp" style={{ fontSize: '8.5px', padding: '2px 6px' }}>
              REV · ROTATE
            </span>
          )}
        </div>
      </div>

      <div className="py-4 px-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onRotate}
          title="Rotate blob — version increments"
          className="inline-flex items-center justify-center"
          style={{
            width: '32px',
            height: '32px',
            border: '1px solid var(--rule)',
            background: 'transparent',
            color: 'var(--ink-1)',
            cursor: 'pointer',
            transition: 'color var(--dur-quick), border-color var(--dur-quick)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink-1)';
            e.currentTarget.style.borderColor = 'var(--rule)';
          }}
        >
          <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete credential"
          className="inline-flex items-center justify-center"
          style={{
            width: '32px',
            height: '32px',
            border: '1px solid var(--rule)',
            background: 'transparent',
            color: 'var(--ink-1)',
            cursor: 'pointer',
            transition: 'color var(--dur-quick), border-color var(--dur-quick)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fail)';
            e.currentTarget.style.borderColor = 'var(--fail)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink-1)';
            e.currentTarget.style.borderColor = 'var(--rule)';
          }}
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="inline-flex items-center gap-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
        {label}
      </div>
    </div>
  );
}

function EmptyVault({ onDraft }: { onDraft: () => void }) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="vt-kicker"
        style={{ color: 'var(--ink-2)', justifyContent: 'center' }}
      >
        VAULT EMPTY
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(26px, 3vw, 38px)',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        no credentials on file.
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14.5px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.55,
        }}
      >
        File login details once, reference by key from every story. Rotate
        in-place — tests pick up the new blob on the next run.
      </p>
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onDraft} className="vt-btn vt-btn--primary">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          FILE FIRST CREDENTIAL
        </button>
      </div>
    </div>
  );
}

/* ── Create dialog ───────────────────────────────────────────────── */

function CreateCredentialDialog({
  project,
  draft,
  setDraft,
  revealed,
  setRevealed,
  onCancel,
  onSubmit,
  pending,
}: {
  project: { id: string; name: string };
  draft: {
    key: string;
    environment: string;
    scope: 'project' | 'org';
    allowEnvironmentFallback: boolean;
    fields: FieldRow[];
  };
  setDraft: React.Dispatch<React.SetStateAction<{
    key: string;
    environment: string;
    scope: 'project' | 'org';
    allowEnvironmentFallback: boolean;
    fields: FieldRow[];
  }>>;
  revealed: boolean;
  setRevealed: (v: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const canSubmit =
    draft.key.trim().length > 0 &&
    draft.fields.some((f) => f.key.trim() && f.value) &&
    !pending;

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>File new credential</DialogTitle>
        <DialogDescription>
          Choose a key, scope, environment, and the fields stories will
          reference. Blobs are sealed before they leave the browser.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <FieldBlock label="KEY" required helper={`IN STORIES · {{creds.${draft.key || 'admin'}}}`}>
            <input
              autoFocus
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="admin"
              className="vt-input"
            />
          </FieldBlock>
          <FieldBlock label="ENVIRONMENT" helper="BLANK = DEFAULT · e.g. STAGING · PROD">
            <input
              value={draft.environment}
              onChange={(e) => setDraft({ ...draft, environment: e.target.value })}
              placeholder="blank = default"
              className="vt-input"
            />
          </FieldBlock>
        </div>

        <div>
          <label
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            SCOPE
          </label>
          <div className="grid grid-cols-2 gap-0" style={{ border: '1px solid var(--rule)' }}>
            <ScopeButton
              active={draft.scope === 'project'}
              onClick={() => setDraft({ ...draft, scope: 'project' })}
              icon={Folder}
              title="Project"
              desc={`Only ${project.name}`}
            />
            <ScopeButton
              active={draft.scope === 'org'}
              onClick={() => setDraft({ ...draft, scope: 'org' })}
              icon={Globe}
              title="Org-wide"
              desc="Any project in the org"
              leftBorder
            />
          </div>
        </div>

        {draft.environment === '' && (
          <label
            className="flex items-start gap-3 cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-1)',
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={draft.allowEnvironmentFallback}
              onChange={(e) =>
                setDraft({ ...draft, allowEnvironmentFallback: e.target.checked })
              }
              className="mt-1"
            />
            <span>
              ALLOW AS ENVIRONMENT FALLBACK
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color: 'var(--ink-2)',
                  letterSpacing: '0.08em',
                  textTransform: 'none',
                  marginTop: '4px',
                  lineHeight: 1.5,
                }}
              >
                Tests with an env set may use this default when no env-specific
                match exists. Leave off for prod-like blobs.
              </span>
            </span>
          </label>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              FIELDS
            </label>
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              className="inline-flex items-center gap-1.5"
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
            >
              {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {revealed ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          <div className="space-y-2">
            {draft.fields.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.key}
                  onChange={(e) => {
                    const fields = [...draft.fields];
                    fields[i] = { ...row, key: e.target.value };
                    setDraft({ ...draft, fields });
                  }}
                  placeholder="field name"
                  className="vt-input"
                  style={{ width: '170px', fontSize: '12px' }}
                />
                <input
                  type={revealed ? 'text' : 'password'}
                  value={row.value}
                  onChange={(e) => {
                    const fields = [...draft.fields];
                    fields[i] = { ...row, value: e.target.value };
                    setDraft({ ...draft, fields });
                  }}
                  placeholder="value"
                  className="vt-input"
                  style={{ flex: 1, fontSize: '12px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const fields = draft.fields.filter((_, j) => j !== i);
                    setDraft({
                      ...draft,
                      fields: fields.length ? fields : [{ key: '', value: '' }],
                    });
                  }}
                  className="inline-flex items-center justify-center"
                  style={{
                    width: '36px',
                    height: '36px',
                    border: '1px solid var(--rule)',
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--fail)';
                    e.currentTarget.style.borderColor = 'var(--fail)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--ink-2)';
                    e.currentTarget.style.borderColor = 'var(--rule)';
                  }}
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft({ ...draft, fields: [...draft.fields, { key: '', value: '' }] })
              }
              className="vt-btn vt-btn--ghost"
              style={{ padding: '6px 14px', fontSize: '10px' }}
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
              ADD FIELD
            </button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <button type="button" onClick={onCancel} className="vt-btn vt-btn--ghost">
          CANCEL
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="vt-btn vt-btn--primary"
        >
          {pending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              FILING
            </>
          ) : (
            'FILE CREDENTIAL'
          )}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

function ScopeButton({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  leftBorder,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  desc: string;
  leftBorder?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex items-start gap-3"
      style={{
        padding: '14px 16px',
        borderLeft: leftBorder ? '1px solid var(--rule)' : 'none',
        background: active ? 'var(--accent-soft)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        strokeWidth={1.5}
        style={{ color: active ? 'var(--accent)' : 'var(--ink-2)' }}
      />
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: active ? 'var(--accent)' : 'var(--ink-0)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--ink-2)',
            marginTop: '3px',
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
    </button>
  );
}

function FieldBlock({
  label,
  required,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          display: 'inline-block',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>*</span>}
      </label>
      {children}
      {helper && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: 'var(--ink-2)',
            textTransform: 'uppercase',
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}
