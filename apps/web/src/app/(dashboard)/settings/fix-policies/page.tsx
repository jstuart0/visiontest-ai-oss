'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  Star,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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

interface FixPolicyData {
  id: string;
  name: string;
  mode: string;
  maxFilesChanged: number;
  maxLinesChanged: number;
  allowedPaths: string[];
  blockedPaths: string[];
  allowDependencyChanges: boolean;
  allowLockfileChanges: boolean;
  allowMigrationChanges: boolean;
  requireHumanApproval: boolean;
  branchPrefix: string;
  isDefault: boolean;
  isActive: boolean;
  repoConnection?: { id: string; repoUrl: string } | null;
}

const modeDescriptions: Record<string, string> = {
  MANUAL: 'Manual investigation and fix only. No automation.',
  GUIDED: 'AI investigates and proposes fixes. Human approval required.',
  SEMI_AUTO: 'AI applies fixes to branches. Human approval before merge.',
  FULLY_AUTO: 'AI applies and merges high-confidence fixes automatically.',
};

export default function FixPoliciesPage() {
  const { project: currentProject } = useCurrentProject();
  const [policies, setPolicies] = useState<FixPolicyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [mode, setMode] = useState('GUIDED');
  const [maxFilesChanged, setMaxFilesChanged] = useState('5');
  const [maxLinesChanged, setMaxLinesChanged] = useState('200');
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);
  const [branchPrefix, setBranchPrefix] = useState('visiontest/fix');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (currentProject?.id) loadPolicies();
  }, [currentProject?.id]);

  async function loadPolicies() {
    if (!currentProject?.id) return;
    setLoading(true);
    try {
      const data = await api.get<FixPolicyData[]>('/fix-policies', { projectId: currentProject.id });
      setPolicies(data || []);
    } catch (error) {
      console.error('Failed to load fix policies:', error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!currentProject?.id || !name) return;
    setAddLoading(true);
    try {
      await api.post('/fix-policies', {
        projectId: currentProject.id,
        name,
        mode,
        maxFilesChanged: parseInt(maxFilesChanged),
        maxLinesChanged: parseInt(maxLinesChanged),
        requireHumanApproval,
        branchPrefix,
        isDefault,
      });
      setShowAdd(false);
      setName('');
      await loadPolicies();
    } catch (error) {
      console.error('Failed to create fix policy:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(policyId: string) {
    if (!confirm('Delete this fix policy?')) return;
    try {
      await api.delete(`/fix-policies/${policyId}`);
      await loadPolicies();
    } catch (error) {
      console.error('Failed to delete fix policy:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fix Policies</h1>
          <p className="text-muted-foreground">
            Configure safety constraints for automated fixing
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Fix Policy</DialogTitle>
              <DialogDescription>
                Define safety constraints for automated bug fixing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Policy Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Default policy" />
              </div>
              <div>
                <Label>Fix Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                    <SelectItem value="GUIDED">Guided</SelectItem>
                    <SelectItem value="SEMI_AUTO">Semi-Auto</SelectItem>
                    <SelectItem value="FULLY_AUTO">Fully Auto</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{modeDescriptions[mode]}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Files Changed</Label>
                  <Input type="number" value={maxFilesChanged} onChange={(e) => setMaxFilesChanged(e.target.value)} />
                </div>
                <div>
                  <Label>Max Lines Changed</Label>
                  <Input type="number" value={maxLinesChanged} onChange={(e) => setMaxLinesChanged(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Branch Prefix</Label>
                <Input value={branchPrefix} onChange={(e) => setBranchPrefix(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Human Approval</Label>
                <Switch checked={requireHumanApproval} onCheckedChange={setRequireHumanApproval} />
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
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No fix policies configured</h3>
            <p className="text-muted-foreground mt-1">
              Add a policy to control how automated fixes are generated and applied.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <CardTitle className="text-base">{policy.name}</CardTitle>
                    {policy.isDefault && (
                      <Badge variant="outline" className="text-yellow-600">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline">{policy.mode.replace(/_/g, ' ')}</Badge>
                </div>
                <CardDescription>{modeDescriptions[policy.mode]}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Max Files</span>
                    <div className="font-medium">{policy.maxFilesChanged}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Lines</span>
                    <div className="font-medium">{policy.maxLinesChanged}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Branch Prefix</span>
                    <div className="font-mono text-xs">{policy.branchPrefix}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Human Approval</span>
                    <div className="font-medium">{policy.requireHumanApproval ? 'Required' : 'Optional'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(policy.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
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
