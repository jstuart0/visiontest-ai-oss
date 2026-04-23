'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { toast } from 'sonner';
import { UserPlus, Trash2, Save, Crown, Shield, User, Eye, Loader2 } from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

const ROLE_ORDER = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;

function RoleIcon({ role }: { role: string }) {
  const common = { strokeWidth: 1.5 };
  switch (role) {
    case 'OWNER':
      return <Crown className="w-3.5 h-3.5" {...common} style={{ color: 'var(--accent)' }} />;
    case 'ADMIN':
      return <Shield className="w-3.5 h-3.5" {...common} style={{ color: 'var(--ink-1)' }} />;
    case 'VIEWER':
      return <Eye className="w-3.5 h-3.5" {...common} style={{ color: 'var(--ink-2)' }} />;
    default:
      return <User className="w-3.5 h-3.5" {...common} style={{ color: 'var(--ink-2)' }} />;
  }
}

export default function OrganizationPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const orgId = project?.orgId;

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [orgName, setOrgName] = useState('');

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: () => organizationsApi.get(orgId!),
    enabled: !!orgId,
  });

  const { data: members } = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: () => organizationsApi.members(orgId!),
    enabled: !!orgId,
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: { name: string }) => organizationsApi.update(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Organization updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      organizationsApi.addMember(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      setInviteEmail('');
      toast.success('Member added');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to add member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => organizationsApi.removeMember(orgId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast.success('Member removed');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to remove member'),
  });

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!orgId) {
    return (
      <VtStage width="narrow">
        <EditorialHero
          width="narrow"
          sheet="O-00"
          eyebrow="§ NAMEPLATE · ORGANIZATION"
          revision={<>REV · 01 · {isoDate}</>}
          title={<>no <em>organization</em> selected.</>}
          lead="Choose a project in the switcher; its organization nameplate will redraw here."
        />
      </VtStage>
    );
  }

  const memberList = (members as any[]) || [];
  const displayName = orgName || org?.name || '';

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`O-${String(memberList.length).padStart(2, '0')}`}
        eyebrow="§ NAMEPLATE · ORGANIZATION"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            the <em>nameplate</em>.
          </>
        }
        lead="The institution that owns the projects, baselines, and credentials. Billing lives here too. Edit the name, amend the roster."
      >
        {/* ── Title block ───────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">ORGANIZATION</span>
            <span className="v big">{org?.name || '—'}</span>
          </div>
          <div className="span2">
            <span className="k">ORG ID</span>
            <span className="v">VT-O-{orgId.slice(-8).toUpperCase()}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div className="span2">
            <span className="k">MEMBERS</span>
            <span className="v">{String(memberList.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">PLAN</span>
            <span className="v">{((org as any)?.plan || 'FREE').toString().toUpperCase()}</span>
          </div>
          <div>
            <span className="k">STATUS</span>
            <span className="v" style={{ color: 'var(--pass)' }}>ACTIVE</span>
          </div>
        </div>

        {/* ── Identity ──────────────────────────────────────────────── */}
        <section aria-labelledby="ident-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="ident-head">identity</span>
            <span className="rule" />
            <span className="stamp">NAMEPLATE · EDITABLE</span>
          </div>
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              padding: '28px 32px',
            }}
          >
            <label
              className="vt-mono block mb-3"
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              ORGANIZATION NAME
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organization name"
                className="vt-input flex-1"
              />
              <button
                type="button"
                onClick={() => updateOrgMutation.mutate({ name: orgName })}
                disabled={!orgName || updateOrgMutation.isPending}
                className="vt-btn vt-btn--primary"
              >
                {updateOrgMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                SAVE
              </button>
            </div>
          </div>
        </section>

        {/* ── Roster ────────────────────────────────────────────────── */}
        <section aria-labelledby="roster-head">
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl" id="roster-head">the roster</span>
            <span className="rule" />
            <span className="stamp">
              {String(memberList.length).padStart(2, '0')} · MEMBERS
            </span>
          </div>

          {/* Invite row */}
          <div
            style={{
              border: '1px solid var(--rule-strong)',
              borderBottom: 'none',
              background: 'color-mix(in oklab, var(--bg-2) 25%, transparent)',
              padding: '18px 20px',
            }}
          >
            <div
              className="vt-mono mb-3"
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              ADD MEMBER
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@example.com"
                className="vt-input"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="vt-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="ADMIN">ADMIN</option>
                <option value="MEMBER">MEMBER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  addMemberMutation.mutate({ email: inviteEmail, role: inviteRole })
                }
                disabled={!inviteEmail || addMemberMutation.isPending}
                className="vt-btn vt-btn--primary"
              >
                {addMemberMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                ADD
              </button>
            </div>
          </div>

          {/* Member rows */}
          {isLoading ? (
            <LoadingFrame label="READING ROSTER" />
          ) : memberList.length === 0 ? (
            <EmptyFrame label="NO MEMBERS" body="The roster is empty. Invite someone above." />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[90px_1fr_160px_100px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['NO.', 'NAME · EMAIL', 'ROLE', 'ACTION'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 3 ? '1px solid var(--rule)' : 'none',
                      textAlign: i >= 2 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {memberList.map((member: any, idx: number) => {
                const name = member.user?.name || member.user?.email || member.email;
                const email = member.user?.email || member.email;
                return (
                  <div
                    key={member.id || member.userId}
                    className="grid grid-cols-[90px_1fr_160px_100px] gap-0 items-center"
                    style={{
                      borderBottom:
                        idx < memberList.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    }}
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
                      M-{String(idx + 1).padStart(3, '0')}
                    </div>
                    <div
                      className="py-3 px-4"
                      style={{ borderRight: '1px solid var(--rule-soft)' }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '14px',
                          color: 'var(--ink-0)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {name}
                      </div>
                      {email !== name && (
                        <div
                          className="vt-mono"
                          style={{
                            fontSize: '11px',
                            color: 'var(--ink-2)',
                            marginTop: '2px',
                          }}
                        >
                          {email}
                        </div>
                      )}
                    </div>
                    <div
                      className="py-3 px-4 flex items-center gap-2"
                      style={{
                        borderRight: '1px solid var(--rule-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: member.role === 'OWNER' ? 'var(--accent)' : 'var(--ink-1)',
                      }}
                    >
                      <RoleIcon role={member.role} />
                      {member.role}
                    </div>
                    <div className="py-2 px-3 flex items-center justify-end">
                      {member.role !== 'OWNER' && (
                        <button
                          type="button"
                          onClick={() =>
                            removeMemberMutation.mutate(member.id || member.userId)
                          }
                          className="vt-btn vt-btn--ghost"
                          style={{
                            padding: '6px 10px',
                            fontSize: '10px',
                            color: 'var(--fail)',
                          }}
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
          <span>SHEET · NAMEPLATE · {org?.name || '—'}</span>
          <span>ROSTER · {String(memberList.length).padStart(3, '0')}</span>
          <span>DRAWN · {isoDate}</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function EmptyFrame({ label, body }: { label: string; body: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule)',
        borderTop: 'none',
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
        className="mx-auto mt-3"
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
    </div>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: '1px dashed var(--rule)',
        borderTop: 'none',
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
