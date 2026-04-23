'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Crown,
  Shield,
  User,
  Eye,
  UserPlus,
  Loader2,
  X,
} from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';
import { teamsApi, type Team, type TeamMember } from '@/lib/api';
import { toast } from 'sonner';

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

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [inviteData, setInviteData] = useState({ email: '', role: 'MEMBER' });

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(project?.orgId || ''),
    enabled: !!project?.orgId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      teamsApi.create({ ...data, orgId: project?.orgId || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCreateOpen(false);
      setNewTeam({ name: '', description: '' });
      toast.success('Team created');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create team');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => teamsApi.delete(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team deleted');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete team');
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({
      teamId,
      data,
    }: {
      teamId: string;
      data: { userId: string; role?: string };
    }) => teamsApi.addMember(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setInviteTeamId(null);
      setInviteData({ email: '', role: 'MEMBER' });
      toast.success('Member added');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to add member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Member removed');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });

  const handleCreateTeam = () => {
    if (!newTeam.name.trim()) return;
    createMutation.mutate({
      name: newTeam.name.trim(),
      description: newTeam.description.trim() || undefined,
    });
  };

  const handleInvite = () => {
    if (!inviteTeamId || !inviteData.email.trim()) return;
    addMemberMutation.mutate({
      teamId: inviteTeamId,
      data: inviteData,
    });
  };

  const handleDeleteTeam = (teamId: string) => {
    deleteMutation.mutate(teamId);
  };

  const list = (teams as Team[]) || [];
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const totalMembers = list.reduce((sum, t) => sum + (t.members?.length || 0), 0);
  const totalProjects = list.reduce((sum, t) => sum + ((t as any)._count?.projects || 0), 0);

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet={`T-${String(list.length).padStart(2, '0')}`}
        eyebrow="§ MASTHEAD · TEAMS"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            the <em>masthead</em>.
          </>
        }
        lead="A team is a byline for a slice of the surface — pages, flows, or user journeys. Approvals route to the team that owns the surface; its members get credited."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="vt-btn vt-btn--primary"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            NEW TEAM
          </button>
        }
      >
        {/* ── Title block ───────────────────────────────────────────── */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">SECTION</span>
            <span className="v big">Masthead · teams</span>
          </div>
          <div className="span2">
            <span className="k">EDITION</span>
            <span className="v">{isoDate}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">TEAMS</span>
            <span className="v">{String(list.length).padStart(3, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">MEMBERS · TOTAL</span>
            <span className="v">{String(totalMembers).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">PROJECTS</span>
            <span className="v">{String(totalProjects).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">STATUS</span>
            <span className="v" style={{ color: 'var(--pass)' }}>ACTIVE</span>
          </div>
        </div>

        {/* ── Sections ──────────────────────────────────────────────── */}
        <section aria-labelledby="teams-head">
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl" id="teams-head">bylines</span>
            <span className="rule" />
            <span className="stamp">{String(list.length).padStart(2, '0')} · TEAMS</span>
          </div>

          {isLoading ? (
            <LoadingFrame label="LOADING MASTHEAD" />
          ) : list.length === 0 ? (
            <EmptyFrame
              label="NO TEAMS ON THE MASTHEAD"
              body="Create a team to group members and route approvals. A team can own projects, flows, or surfaces."
              action={
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="vt-btn vt-btn--primary"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  CREATE FIRST TEAM
                </button>
              }
            />
          ) : (
            <div className="space-y-8">
              {list.map((team, idx) => (
                <TeamBlock
                  key={team.id}
                  team={team}
                  idx={idx}
                  onDelete={() => handleDeleteTeam(team.id)}
                  onInvite={() => setInviteTeamId(team.id)}
                  onRemoveMember={(userId) =>
                    removeMemberMutation.mutate({ teamId: team.id, userId })
                  }
                  onRoleChange={(userId, role) =>
                    teamsApi
                      .updateMember(team.id, userId, { role })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['teams'] });
                        toast.success('Role updated');
                      })
                      .catch(() => toast.error('Failed to update role'))
                  }
                />
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
          <span>SHEET · MASTHEAD</span>
          <span>EDITION · {isoDate}</span>
          <span>BYLINES · {String(list.length).padStart(3, '0')}</span>
        </footer>
      </EditorialHero>

      {createOpen && (
        <CreateTeamDialog
          newTeam={newTeam}
          setNewTeam={setNewTeam}
          onCreate={handleCreateTeam}
          onClose={() => setCreateOpen(false)}
          pending={createMutation.isPending}
        />
      )}

      {inviteTeamId && (
        <InviteDialog
          inviteData={inviteData}
          setInviteData={setInviteData}
          onInvite={handleInvite}
          onClose={() => setInviteTeamId(null)}
          pending={addMemberMutation.isPending}
        />
      )}
    </VtStage>
  );
}

/* ───────────────────────────────────────────────────── primitives ── */

function TeamBlock({
  team,
  idx,
  onDelete,
  onInvite,
  onRemoveMember,
  onRoleChange,
}: {
  team: Team;
  idx: number;
  onDelete: () => void;
  onInvite: () => void;
  onRemoveMember: (userId: string) => void;
  onRoleChange: (userId: string, role: string) => void;
}) {
  const memberCount = team.members?.length || 0;
  const projectCount = (team as any)._count?.projects || 0;

  return (
    <div
      style={{
        border: '1px solid var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
      }}
    >
      {/* Title-block masthead */}
      <div
        className="grid grid-cols-[110px_1fr_auto] items-start"
        style={{ borderBottom: '1px solid var(--rule-strong)' }}
      >
        <div
          className="py-5 px-5 vt-mono"
          style={{
            borderRight: '1px solid var(--rule)',
            fontSize: '11px',
            letterSpacing: '0.18em',
            color: 'var(--accent)',
          }}
        >
          T-{String(idx + 1).padStart(3, '0')}
        </div>
        <div className="py-5 px-6" style={{ borderRight: '1px solid var(--rule)' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(22px, 2.4vw, 30px)',
              lineHeight: 1,
              letterSpacing: '-0.005em',
              color: 'var(--ink-0)',
              textTransform: 'lowercase',
            }}
          >
            {team.name}
          </div>
          {team.description && (
            <div
              className="mt-2"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--ink-1)',
                lineHeight: 1.5,
                maxWidth: '60ch',
              }}
            >
              {team.description}
            </div>
          )}
          <div
            className="mt-3 flex items-center gap-4 vt-mono"
            style={{
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <span>{String(memberCount).padStart(2, '0')} MEMBERS</span>
            <span>·</span>
            <span>{String(projectCount).padStart(2, '0')} PROJECTS</span>
          </div>
        </div>
        <div className="py-4 px-4 flex items-center gap-2">
          <button type="button" onClick={onInvite} className="vt-btn">
            <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
            INVITE
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="vt-btn vt-btn--ghost"
            style={{ padding: '8px 12px', color: 'var(--fail)' }}
            title="Delete team"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Member rows */}
      {memberCount === 0 ? (
        <div
          className="py-8 text-center vt-mono"
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          NO MEMBERS ON THIS BYLINE
        </div>
      ) : (
        <div>
          <div
            className="grid grid-cols-[70px_1fr_160px_90px] gap-0"
            style={{
              borderBottom: '1px solid var(--rule)',
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
          {team.members?.map((member: TeamMember, mi: number) => (
            <div
              key={member.id}
              className="grid grid-cols-[70px_1fr_160px_90px] gap-0 items-center"
              style={{
                borderBottom:
                  mi < (team.members?.length || 0) - 1
                    ? '1px solid var(--rule-soft)'
                    : 'none',
              }}
            >
              <div
                className="py-3 px-4 vt-mono"
                style={{
                  borderRight: '1px solid var(--rule-soft)',
                  fontSize: '10.5px',
                  letterSpacing: '0.14em',
                  color: 'var(--ink-2)',
                }}
              >
                · {String(mi + 1).padStart(2, '0')}
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
                  {member.user.name || member.user.email}
                </div>
                {member.user.name && (
                  <div
                    className="vt-mono"
                    style={{
                      fontSize: '11px',
                      color: 'var(--ink-2)',
                      marginTop: '2px',
                    }}
                  >
                    {member.user.email}
                  </div>
                )}
              </div>
              <div
                className="py-3 px-4 flex items-center gap-2"
                style={{ borderRight: '1px solid var(--rule-soft)' }}
              >
                <RoleIcon role={member.role} />
                {member.role === 'OWNER' ? (
                  <span
                    className="vt-mono"
                    style={{
                      fontSize: '10.5px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                    }}
                  >
                    OWNER
                  </span>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) => onRoleChange(member.userId, e.target.value)}
                    className="vt-mono"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--rule)',
                      color: 'var(--ink-1)',
                      padding: '4px 8px',
                      fontSize: '10.5px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                )}
              </div>
              <div className="py-2 px-3 flex items-center justify-end">
                {member.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(member.userId)}
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
          ))}
        </div>
      )}
    </div>
  );
}

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

function CreateTeamDialog({
  newTeam,
  setNewTeam,
  onCreate,
  onClose,
  pending,
}: {
  newTeam: { name: string; description: string };
  setNewTeam: (v: any) => void;
  onCreate: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <Dialog title="§ NEW TEAM" subtitle="create a byline" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <div>
          <label
            className="vt-mono block mb-2"
            style={{
              fontSize: '10px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            TEAM NAME
          </label>
          <input
            type="text"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            placeholder="My team"
            className="vt-input"
          />
        </div>
        <div>
          <label
            className="vt-mono block mb-2"
            style={{
              fontSize: '10px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            DESCRIPTION · OPTIONAL
          </label>
          <input
            type="text"
            value={newTeam.description}
            onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
            placeholder="What this team owns"
            className="vt-input"
          />
        </div>
      </div>
      <div
        className="px-6 py-4 flex items-center justify-end gap-2"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        <button type="button" onClick={onClose} className="vt-btn vt-btn--ghost">
          CANCEL
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={pending || !newTeam.name.trim()}
          className="vt-btn vt-btn--primary"
        >
          {pending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              CREATING…
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              CREATE TEAM
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}

function InviteDialog({
  inviteData,
  setInviteData,
  onInvite,
  onClose,
  pending,
}: {
  inviteData: { email: string; role: string };
  setInviteData: (v: any) => void;
  onInvite: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <Dialog title="§ INVITE" subtitle="add to byline" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <div>
          <label
            className="vt-mono block mb-2"
            style={{
              fontSize: '10px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            EMAIL ADDRESS
          </label>
          <input
            type="email"
            value={inviteData.email}
            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
            placeholder="member@example.com"
            className="vt-input"
          />
        </div>
        <div>
          <label
            className="vt-mono block mb-2"
            style={{
              fontSize: '10px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            ROLE
          </label>
          <select
            value={inviteData.role}
            onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
            className="vt-input"
            style={{ cursor: 'pointer' }}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </div>
      </div>
      <div
        className="px-6 py-4 flex items-center justify-end gap-2"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        <button type="button" onClick={onClose} className="vt-btn vt-btn--ghost">
          CANCEL
        </button>
        <button
          type="button"
          onClick={onInvite}
          disabled={pending || !inviteData.email.trim()}
          className="vt-btn vt-btn--primary"
        >
          {pending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              SENDING…
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
              SEND INVITE
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}

function Dialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'color-mix(in oklab, var(--bg-3) 75%, transparent)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px]"
        style={{
          border: '1px solid var(--rule-strong)',
          background: 'var(--bg-1)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--rule)' }}
        >
          <div>
            <div
              className="vt-mono"
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: '4px',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
              }}
            >
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="vt-btn vt-btn--ghost"
            style={{ padding: '6px 10px' }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
