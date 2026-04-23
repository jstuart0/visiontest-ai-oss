'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Save,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useCurrentProject } from '@/hooks/useProject';
import { projectsApi, apiKeysApi, ApiKeyData } from '@/lib/api';
import { useProjectStore } from '@/stores/project.store';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
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

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

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

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);

  const createKeyMutation = useMutation({
    mutationFn: () => apiKeysApi.create({ name: newKeyName, scopes: newKeyScopes }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyVisible(data.key || data.rawKey);
      setNewKeyName('');
      toast.success('API key created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create API key'),
  });

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
      <VtStage width="narrow">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ NO PROJECT</div>
        <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
          pick a project first.
        </h1>
      </VtStage>
    );
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const subpages = [
    { href: '/settings/ai-providers', part: 'S-01', name: 'ai providers', desc: 'LLM brains on retainer — Anthropic, OpenAI, Gemini, OpenRouter, local.' },
    { href: '/settings/ai-diff', part: 'S-02', name: 'ai visual diff', desc: 'SSIM, LPIPS, DINOv2 thresholds and VLM pipeline depth.' },
    { href: '/settings/storybook', part: 'S-03', name: 'storybook', desc: 'Point at a Storybook URL. Stories become visual-regression fixtures.' },
    { href: '/settings/repos', part: 'S-04', name: 'repositories', desc: 'Git remotes the auto-fixer reads and writes to.' },
    { href: '/settings/fix-policies', part: 'S-05', name: 'fix policies', desc: 'Charter for the auto-fixer — paths, limits, approval rules.' },
    { href: '/settings/verification-profiles', part: 'S-06', name: 'verification profiles', desc: 'Assay protocols run against every proposed fix.' },
    { href: '/settings/runners', part: 'S-07', name: 'fix runners', desc: 'Stagehands that actually execute fix sessions in a sandbox.' },
  ];

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`07 / 14`}
        eyebrow={`§ 07 · WORKBENCH`}
        revision={<>REV · 02 · {isoDate}</>}
        title={<>workbench <em>—</em> settings.</>}
        lead="The drawer of tools behind every drawing set. Project defaults, automation wiring, notifications, API keys. Change carefully."
      >
        {/* ── §01 · Project plate ─────────────────────────────────── */}
        <section aria-labelledby="project-head">
          <div className="vt-section-head">
            <span className="num">§ 01</span>
            <span className="ttl" id="project-head">project plate</span>
            <span className="rule" />
            <span className="stamp">PROJECT · {(project.slug || 'VT').toUpperCase()}</span>
          </div>

          <div style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <FieldCell label="PROJECT NAME" borderRight borderBottom>
                <input
                  className="vt-input"
                  value={projectSettings.name}
                  onChange={(e) => setProjectSettings((s) => ({ ...s, name: e.target.value }))}
                />
              </FieldCell>
              <FieldCell label="DESCRIPTION" borderBottom>
                <input
                  className="vt-input"
                  value={projectSettings.description}
                  onChange={(e) => setProjectSettings((s) => ({ ...s, description: e.target.value }))}
                />
              </FieldCell>
            </div>
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)' }}>
              <button
                type="button"
                className="vt-btn vt-btn--primary"
                disabled={updateProjectMutation.isPending}
                onClick={() => updateProjectMutation.mutate(projectSettings)}
              >
                <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                {updateProjectMutation.isPending ? 'SAVING' : 'SAVE'}
              </button>
              <button
                type="button"
                className="vt-btn"
                onClick={() =>
                  setProjectSettings({ name: project.name || '', description: project.description || '' })
                }
              >
                RESET
              </button>
            </div>
          </div>
        </section>

        {/* ── §02 · Parts catalog — subpages ──────────────────────── */}
        <section aria-labelledby="subpages-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="subpages-head">parts catalog</span>
            <span className="rule" />
            <span className="stamp">{subpages.length} PLATES · INDEX</span>
          </div>

          <div style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}>
            {subpages.map((p, i) => (
              <Link
                key={p.href}
                href={p.href}
                className="grid grid-cols-[90px_220px_1fr_40px] gap-0 group"
                style={{
                  borderBottom: i < subpages.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  textDecoration: 'none',
                  transition: 'background var(--dur-quick) var(--ease-out)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    'color-mix(in oklab, var(--bg-2) 35%, transparent)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
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
                  {p.part}
                </div>
                <div
                  className="py-4 px-4"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    color: 'var(--ink-0)',
                    textTransform: 'lowercase',
                  }}
                >
                  {p.name}
                </div>
                <div
                  className="py-4 px-4"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13.5px',
                    color: 'var(--ink-1)',
                    lineHeight: 1.5,
                  }}
                >
                  {p.desc}
                </div>
                <div className="py-4 px-4 flex items-center justify-center">
                  <ArrowRight
                    className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                    strokeWidth={1.5}
                    style={{ color: 'var(--ink-2)' }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── §03 · Notifications ─────────────────────────────────── */}
        <section aria-labelledby="notif-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="notif-head">notifications · signals</span>
            <span className="rule" />
            <span className="stamp">DISPATCH CHANNELS</span>
          </div>

          <div style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}>
            <ToggleRow
              label="EMAIL · ON FAILURE"
              desc="Emailed when a run fails."
              checked={notifications.emailOnFailure}
              onChange={(v) => setNotifications((n) => ({ ...n, emailOnFailure: v }))}
            />
            <ToggleRow
              label="EMAIL · ON APPROVAL"
              desc="Emailed when a visual change awaits review."
              checked={notifications.emailOnApproval}
              onChange={(v) => setNotifications((n) => ({ ...n, emailOnApproval: v }))}
            />
            <ToggleRow
              label="SLACK · ON FAILURE"
              desc="Post to Slack when tests fail."
              checked={notifications.slackOnFailure}
              onChange={(v) => setNotifications((n) => ({ ...n, slackOnFailure: v }))}
            />
            <ToggleRow
              label="SLACK · ON APPROVAL"
              desc="Post to Slack when a visual change awaits review."
              checked={notifications.slackOnApproval}
              onChange={(v) => setNotifications((n) => ({ ...n, slackOnApproval: v }))}
              last={!(notifications.slackOnFailure || notifications.slackOnApproval)}
            />
            {(notifications.slackOnFailure || notifications.slackOnApproval) && (
              <FieldCell label="SLACK WEBHOOK URL" last>
                <input
                  className="vt-input"
                  value={notifications.slackWebhookUrl}
                  onChange={(e) => setNotifications((n) => ({ ...n, slackWebhookUrl: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </FieldCell>
            )}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)' }}>
              <button
                type="button"
                className="vt-btn vt-btn--primary"
                disabled={saveNotificationsMutation.isPending}
                onClick={() => saveNotificationsMutation.mutate(notifications)}
              >
                <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                {saveNotificationsMutation.isPending ? 'SAVING' : 'SAVE'}
              </button>
            </div>
          </div>
        </section>

        {/* ── §04 · Integrations ─────────────────────────────────── */}
        <section aria-labelledby="integrations-head">
          <div className="vt-section-head">
            <span className="num">§ 04</span>
            <span className="ttl" id="integrations-head">integrations</span>
            <span className="rule" />
            <span className="stamp">CI/CD · PENDING</span>
          </div>

          <div
            className="p-10 text-center"
            style={{
              border: '1px dashed var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
            }}
          >
            <div className="vt-kicker" style={{ color: 'var(--ink-2)', justifyContent: 'center' }}>
              UNDER DRAFT
            </div>
            <h3
              className="mt-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(22px, 2.4vw, 32px)',
                color: 'var(--ink-0)',
              }}
            >
              github, gitlab, slack integrations pending.
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
              Use API keys and webhooks (§ 05) for CI/CD integration in the
              meantime.
            </p>
          </div>
        </section>

        {/* ── §05 · API keys ─────────────────────────────────────── */}
        <section aria-labelledby="keys-head">
          <div className="vt-section-head">
            <span className="num">§ 05</span>
            <span className="ttl" id="keys-head">api keys · credentials</span>
            <span className="rule" />
            <span className="stamp">{(apiKeys?.length ?? 0).toString().padStart(2, '0')} ON FILE</span>
          </div>

          <div style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}>
            {/* create row */}
            <div
              className="grid grid-cols-[1fr_180px_160px] gap-0"
              style={{ borderBottom: '1px solid var(--rule-soft)' }}
            >
              <FieldCell label="NAME" borderRight>
                <input
                  className="vt-input"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. CI Pipeline"
                />
              </FieldCell>
              <FieldCell label="SCOPE" borderRight>
                <select
                  className="vt-input"
                  value={newKeyScopes.join(',')}
                  onChange={(e) => setNewKeyScopes(e.target.value.split(','))}
                >
                  <option value="read">READ</option>
                  <option value="read,write">READ + WRITE</option>
                  <option value="read,write,execute">FULL</option>
                </select>
              </FieldCell>
              <div className="p-4 flex items-center">
                <button
                  type="button"
                  className="vt-btn vt-btn--primary w-full"
                  disabled={!newKeyName || createKeyMutation.isPending}
                  onClick={() => createKeyMutation.mutate()}
                >
                  {createKeyMutation.isPending ? 'GENERATING' : 'GENERATE'}
                </button>
              </div>
            </div>

            {newKeyVisible && (
              <div
                className="p-4"
                style={{
                  borderBottom: '1px solid var(--rule-soft)',
                  background: 'var(--accent-soft)',
                }}
              >
                <div
                  className="vt-kicker mb-2"
                  style={{ color: 'var(--accent)' }}
                >
                  NEW KEY · COPY NOW · NOT SHOWN AGAIN
                </div>
                <code
                  className="vt-mono block select-all break-all"
                  style={{ fontSize: '12.5px', color: 'var(--ink-0)' }}
                >
                  {newKeyVisible}
                </code>
                <button
                  type="button"
                  className="vt-btn mt-3"
                  onClick={() => {
                    navigator.clipboard.writeText(newKeyVisible);
                    toast.success('Copied to clipboard');
                  }}
                >
                  COPY
                </button>
              </div>
            )}

            {/* existing keys */}
            {apiKeys && apiKeys.length > 0 ? (
              <>
                <div
                  className="grid grid-cols-[1fr_200px_140px_120px] gap-0"
                  style={{
                    borderBottom: '1px solid var(--rule-strong)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9.5px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  {['NAME', 'KEY · PREFIX', 'SCOPES', 'ACTION'].map((h, i) => (
                    <div
                      key={h}
                      className="py-3 px-4"
                      style={{ borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}
                    >
                      {h}
                    </div>
                  ))}
                </div>
                {apiKeys.map((key: ApiKeyData, i: number) => (
                  <div
                    key={key.id}
                    className="grid grid-cols-[1fr_200px_140px_120px] gap-0"
                    style={{
                      borderBottom: i < apiKeys.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                      opacity: key.revokedAt ? 0.4 : 1,
                    }}
                  >
                    <div
                      className="py-3 px-4"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '13px',
                        color: 'var(--ink-0)',
                      }}
                    >
                      {key.name}
                      {key.lastUsedAt && (
                        <div
                          className="mt-1"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9.5px',
                            letterSpacing: '0.12em',
                            color: 'var(--ink-2)',
                            textTransform: 'uppercase',
                          }}
                        >
                          LAST · {new Date(key.lastUsedAt).toISOString().slice(0, 10).replace(/-/g, '.')}
                        </div>
                      )}
                    </div>
                    <div
                      className="py-3 px-4 vt-mono"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontSize: '11.5px',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {key.keyPrefix}…
                    </div>
                    <div
                      className="py-3 px-4"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        color: 'var(--ink-1)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {key.scopes?.join(' · ')}
                    </div>
                    <div className="py-3 px-4 flex items-center justify-end">
                      {!key.revokedAt ? (
                        <button
                          type="button"
                          className="vt-btn vt-btn--ghost"
                          style={{ color: 'var(--fail)', padding: '6px 12px', fontSize: '10px' }}
                          onClick={() => revokeKeyMutation.mutate(key.id)}
                        >
                          REVOKE
                        </button>
                      ) : (
                        <span className="vt-chip" style={{ color: 'var(--ink-2)', fontSize: '9.5px' }}>
                          REVOKED
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div
                className="p-8 text-center"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  borderTop: '1px dashed var(--rule)',
                }}
              >
                — NO KEYS ON FILE —
              </div>
            )}
          </div>
        </section>

        {/* ── §06 · Danger zone ──────────────────────────────────── */}
        <section aria-labelledby="danger-head">
          <div className="vt-section-head">
            <span className="num">§ 06</span>
            <span className="ttl" id="danger-head">demolition · irreversible</span>
            <span className="rule" />
            <span className="stamp" style={{ color: 'var(--fail)' }}>DANGER</span>
          </div>

          <div
            style={{
              border: '1px solid var(--fail)',
              background: 'var(--fail-soft)',
            }}
          >
            <div
              className="px-6 py-4"
              style={{
                borderBottom: '1px solid color-mix(in oklab, var(--fail) 40%, transparent)',
                fontFamily: 'var(--font-body)',
                fontSize: '13.5px',
                color: 'var(--ink-1)',
                lineHeight: 1.5,
              }}
            >
              Permanently deletes the project and every test, run, baseline, and
              comparison attached to it. No undo.
            </div>
            <FieldCell
              label={<>TYPE <span style={{ color: 'var(--fail)' }}>{project.name}</span> TO CONFIRM</>}
              borderBottom
            >
              <input
                className="vt-input"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={project.name}
              />
            </FieldCell>
            <div className="px-6 py-4">
              <button
                type="button"
                className="vt-btn"
                style={{
                  borderColor: 'var(--fail)',
                  color: 'var(--fail)',
                }}
                disabled={deleteConfirm !== project.name || deleteProjectMutation.isPending}
                onClick={() => deleteProjectMutation.mutate()}
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                {deleteProjectMutation.isPending ? 'DELETING' : 'DELETE PROJECT'}
              </button>
            </div>
          </div>
        </section>
      </EditorialHero>
    </VtStage>
  );
}

/* ─────────────────────────────────────────────────────── primitives ── */

function FieldCell({
  label,
  children,
  borderRight,
  borderBottom,
  last,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  borderRight?: boolean;
  borderBottom?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="p-4"
      style={{
        borderRight: borderRight ? '1px solid var(--rule-soft)' : undefined,
        borderBottom: borderBottom || !last ? '1px solid var(--rule-soft)' : undefined,
      }}
    >
      <div
        className="mb-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  last,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[1fr_220px] gap-0 items-center"
      style={{ borderBottom: last ? 'none' : '1px solid var(--rule-soft)' }}
    >
      <div className="p-4" style={{ borderRight: '1px solid var(--rule-soft)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-0)',
          }}
        >
          {label}
        </div>
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--ink-2)',
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      <div className="p-4">
        <SegmentedToggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function SegmentedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="grid grid-cols-2"
      style={{ border: '1px solid var(--rule)' }}
      role="group"
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        className="vt-mono"
        style={{
          padding: '8px 0',
          background: !checked ? 'var(--bg-2)' : 'transparent',
          color: !checked ? 'var(--ink-0)' : 'var(--ink-2)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          borderRight: '1px solid var(--rule)',
          cursor: 'pointer',
        }}
      >
        OFF
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className="vt-mono"
        style={{
          padding: '8px 0',
          background: checked ? 'var(--accent)' : 'transparent',
          color: checked ? 'var(--bg-0)' : 'var(--ink-2)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        ON
      </button>
    </div>
  );
}
