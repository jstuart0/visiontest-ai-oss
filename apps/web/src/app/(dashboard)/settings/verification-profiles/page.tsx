'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  Star,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

interface VerificationProfileData {
  id: string;
  name: string;
  description: string | null;
  preset: string;
  commands: { name: string; command: string; timeout?: number; required?: boolean }[];
  targetingStrategy: string;
  maxRuntimeSeconds: number;
  failurePolicy: string;
  isDefault: boolean;
}

const presetDescriptions: Record<string, string> = {
  fast: 'Rerun failing test + scoped lint. Fastest verification.',
  balanced: 'Fast + package tests + visual rerun. Recommended default.',
  strict: 'Balanced + smoke suite + broader typecheck. Most thorough.',
  custom: 'Custom set of verification commands.',
};

export default function VerificationProfilesPage() {
  const { project: currentProject } = useCurrentProject();
  const [profiles, setProfiles] = useState<VerificationProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preset, setPreset] = useState('balanced');
  const [commandsText, setCommandsText] = useState('npm run lint\nnpx tsc --noEmit\nnpm test -- --related');
  const [maxRuntime, setMaxRuntime] = useState('300');
  const [failurePolicy, setFailurePolicy] = useState('fail_closed');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (currentProject?.id) loadProfiles();
  }, [currentProject?.id]);

  async function loadProfiles() {
    if (!currentProject?.id) return;
    setLoading(true);
    try {
      const data = await api.get<VerificationProfileData[]>('/fix-policies/verification-profiles', { projectId: currentProject.id });
      setProfiles(data || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!currentProject?.id || !name) return;
    setAddLoading(true);
    try {
      const commands = commandsText.split('\n').filter(Boolean).map((line, i) => ({
        name: `Step ${i + 1}`,
        command: line.trim(),
        timeout: 60,
        required: true,
      }));

      await api.post('/fix-policies/verification-profiles', {
        projectId: currentProject.id,
        name,
        description: description || undefined,
        preset,
        commands,
        maxRuntimeSeconds: parseInt(maxRuntime),
        failurePolicy,
        isDefault,
      });
      setShowAdd(false);
      setName('');
      setDescription('');
      await loadProfiles();
    } catch (error) {
      console.error('Failed to create profile:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(profileId: string) {
    if (!confirm('Delete this verification profile?')) return;
    try {
      await api.delete(`/fix-policies/verification-profiles/${profileId}`);
      await loadProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verification Profiles</h1>
          <p className="text-muted-foreground">
            Define what checks run after a fix is generated
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Verification Profile</DialogTitle>
              <DialogDescription>
                Define commands that verify a fix before it can be approved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Default verification" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <div>
                <Label>Preset</Label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{presetDescriptions[preset]}</p>
              </div>
              <div>
                <Label>Commands (one per line)</Label>
                <Textarea
                  value={commandsText}
                  onChange={(e) => setCommandsText(e.target.value)}
                  className="font-mono text-sm min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Runtime (seconds)</Label>
                  <Input type="number" value={maxRuntime} onChange={(e) => setMaxRuntime(e.target.value)} />
                </div>
                <div>
                  <Label>Failure Policy</Label>
                  <Select value={failurePolicy} onValueChange={setFailurePolicy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fail_closed">Fail Closed</SelectItem>
                      <SelectItem value="fail_open">Fail Open</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Set as Default</Label>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={addLoading || !name}>
                {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No verification profiles</h3>
            <p className="text-muted-foreground mt-1">
              Create a profile to define how fixes are verified before approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    {profile.isDefault && (
                      <Badge variant="outline" className="text-yellow-600">
                        <Star className="h-3 w-3 mr-1" /> Default
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline">{profile.preset}</Badge>
                </div>
                {profile.description && (
                  <CardDescription>{profile.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {profile.commands.map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Terminal className="h-3 w-3 text-muted-foreground" />
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{cmd.command}</code>
                      {cmd.required && (
                        <Badge variant="outline" className="text-xs">required</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span>Max runtime: {profile.maxRuntimeSeconds}s</span>
                  <span>Failure: {profile.failurePolicy.replace('_', ' ')}</span>
                  <span>Targeting: {profile.targetingStrategy}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(profile.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
