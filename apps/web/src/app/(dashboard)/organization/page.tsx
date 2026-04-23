'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Users, UserPlus, Trash2, Save, Crown, Shield, User, Eye } from 'lucide-react';

function getRoleIcon(role: string) {
  switch (role) {
    case 'OWNER': return <Crown className="h-3 w-3 text-yellow-500" />;
    case 'ADMIN': return <Shield className="h-3 w-3 text-blue-500" />;
    case 'MEMBER': return <User className="h-3 w-3 text-muted-foreground" />;
    case 'VIEWER': return <Eye className="h-3 w-3 text-muted-foreground" />;
    default: return null;
  }
}

export default function OrganizationPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const orgId = project?.orgId;

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');

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
    mutationFn: (data: { email: string; role: string }) => organizationsApi.addMember(orgId!, data),
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

  const [orgName, setOrgName] = useState('');

  if (!orgId) return <div className="p-6 text-muted-foreground">Select a project to view organization settings.</div>;

  // Nameplate — the institutional identity page. Subtle, formal.
  // Uses an editorial dateline + a Fraunces italic name as a plate.
  return (
    <div className="max-w-[860px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-8 border-b-2 mb-12" style={{ borderColor: 'var(--ink-0)' }}>
        <div className="vt-kicker mb-4" style={{ color: 'var(--ink-2)' }}>§ Nameplate · Organization</div>
        <h1
          className="vt-display"
          style={{ fontSize: 'clamp(40px, 5.5vw, 64px)', lineHeight: 0.98, fontWeight: 310 }}
        >
          Who we <em>are</em>.
        </h1>
        <p
          className="mt-4 vt-italic"
          style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '56ch' }}
        >
          The institution that owns the projects, the baselines, and the
          credentials. Billing lives here too — quietly.
        </p>
      </header>

      {/* Org Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Organization Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <div className="flex gap-2">
              <Input
                value={orgName || org?.name || ''}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organization name"
              />
              <Button
                onClick={() => updateOrgMutation.mutate({ name: orgName })}
                disabled={!orgName || updateOrgMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Members
          </CardTitle>
          <CardDescription>
            {members?.length || 0} member{(members?.length || 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Invite */}
          <div className="flex gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-muted border border-border rounded px-2 text-sm"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button
              onClick={() => addMemberMutation.mutate({ email: inviteEmail, role: inviteRole })}
              disabled={!inviteEmail || addMemberMutation.isPending}
            >
              <UserPlus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {/* Member List */}
          <div className="space-y-2">
            {members?.map((member: any) => (
              <div key={member.id || member.userId} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {getRoleIcon(member.role)}
                  <div>
                    <p className="text-sm font-medium">{member.user?.name || member.user?.email || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.user?.email || member.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{member.role}</Badge>
                </div>
                {member.role !== 'OWNER' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                    onClick={() => removeMemberMutation.mutate(member.id || member.userId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {(!members || members.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
