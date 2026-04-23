'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Trash2,
  Crown,
  Shield,
  User,
  Eye,
  UserPlus,
  FolderKanban,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { teamsApi, type Team, type TeamMember } from '@/lib/api';
import { toast } from 'sonner';

function getRoleIcon(role: string) {
  switch (role) {
    case 'OWNER':
      return <Crown className="h-4 w-4 text-amber-500" />;
    case 'ADMIN':
      return <Shield className="h-4 w-4 text-blue-400" />;
    case 'VIEWER':
      return <Eye className="h-4 w-4 text-muted-foreground" />;
    default:
      return <User className="h-4 w-4 text-green-400" />;
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
    mutationFn: ({ teamId, data }: { teamId: string; data: { userId: string; role?: string } }) =>
      teamsApi.addMember(teamId, data),
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

  // Masthead — teams are people. Treat the page like the mast of a
  // newspaper: a soft roman headline, no icon, team count typeset as
  // "in this edition" meta.
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-8 border-b-2 mb-12" style={{ borderColor: 'var(--ink-0)' }}>
        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <div className="vt-kicker mb-4" style={{ color: 'var(--ink-2)' }}>
              § Masthead · {teams?.length || 0} {teams?.length === 1 ? 'team' : 'teams'}
            </div>
            <h1
              className="vt-display"
              style={{ fontSize: 'clamp(44px, 6vw, 76px)', lineHeight: 0.97, fontWeight: 310 }}
            >
              Who runs the <em>tests</em>.
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{
                fontVariationSettings: '"opsz" 24',
                fontSize: '17px',
                color: 'var(--ink-1)',
                maxWidth: '58ch',
              }}
            >
              A team is a group of people who own a slice of the surface —
              pages, flows, or user journeys. Approvals route to the team
              that owns the surface.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="vt-btn vt-btn--primary shrink-0"
          >
            <Plus className="w-4 h-4" />
            New team
          </button>
        </div>
      </header>

      {/* Teams List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : !teams || teams.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/70 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No teams yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a team to collaborate on visual regression testing
            </p>
            <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">{team.name}</CardTitle>
                    {team.description && (
                      <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteTeamId(team.id)}
                      className="border-border text-muted-foreground hover:bg-accent"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTeam(team.id)}
                      className="text-muted-foreground hover:text-red-400 hover:bg-accent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {team.members?.length || 0} member{(team.members?.length || 0) !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <FolderKanban className="w-4 h-4" />
                    {team._count?.projects || 0} project{(team._count?.projects || 0) !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {team.members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm text-muted-foreground"
                    >
                      {getRoleIcon(member.role)}
                      <span>{member.user.name || member.user.email}</span>
                      {member.role !== 'OWNER' ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            teamsApi.updateMember(team.id, member.userId, { role: e.target.value })
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ['teams'] });
                                toast.success('Role updated');
                              })
                              .catch(() => toast.error('Failed to update role'))
                          }
                          className="text-xs bg-muted border border-border rounded px-1 py-0.5 text-muted-foreground"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">OWNER</Badge>
                      )}
                      {member.role !== 'OWNER' && (
                        <button
                          onClick={() =>
                            removeMemberMutation.mutate({
                              teamId: team.id,
                              userId: member.userId,
                            })
                          }
                          className="text-muted-foreground hover:text-red-400 transition-colors ml-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Team</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new team to organize members and projects
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Team Name</Label>
              <Input
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="My Team"
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description (optional)</Label>
              <Input
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="Team description"
                className="bg-muted border-border text-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={createMutation.isPending || !newTeam.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={!!inviteTeamId} onOpenChange={() => setInviteTeamId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Invite Member</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a member to this team by email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="member@example.com"
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <Select
                value={inviteData.role}
                onValueChange={(v) => setInviteData({ ...inviteData, role: v })}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setInviteTeamId(null)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={addMemberMutation.isPending || !inviteData.email.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addMemberMutation.isPending ? 'Adding...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
