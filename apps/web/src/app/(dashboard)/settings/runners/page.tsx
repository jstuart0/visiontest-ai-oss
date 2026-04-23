'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Server,
  Plus,
  Trash2,
  Loader2,
  Circle,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

interface RunnerData {
  id: string;
  name: string;
  type: string;
  status: string;
  version: string | null;
  capabilities: Record<string, unknown> | null;
  lastHeartbeatAt: string | null;
  lastJobAt: string | null;
  registeredAt: string;
  project?: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  OFFLINE: 'bg-gray-400',
  STARTING: 'bg-yellow-400',
  READY: 'bg-green-400',
  BUSY: 'bg-blue-400',
  DEGRADED: 'bg-orange-400',
  DRAINING: 'bg-purple-400',
  UNHEALTHY: 'bg-red-400',
};

export default function RunnersPage() {
  const { project: currentProject } = useCurrentProject();
  const [runners, setRunners] = useState<RunnerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('SELF_HOSTED');

  useEffect(() => {
    loadRunners();
  }, [currentProject?.id]);

  async function loadRunners() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentProject?.id) params.projectId = currentProject.id;
      const data = await api.get<RunnerData[]>('/fix-runners', params);
      setRunners(data || []);
    } catch (error) {
      console.error('Failed to load runners:', error);
      setRunners([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!name) return;
    setAddLoading(true);
    try {
      await api.post('/fix-runners/register', {
        projectId: currentProject?.id,
        name,
        type,
      });
      setShowAdd(false);
      setName('');
      await loadRunners();
    } catch (error) {
      console.error('Failed to register runner:', error);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDrain(runnerId: string) {
    try {
      await api.post(`/fix-runners/${runnerId}/drain`);
      await loadRunners();
    } catch (error) {
      console.error('Failed to drain runner:', error);
    }
  }

  async function handleDelete(runnerId: string) {
    if (!confirm('Deregister this runner?')) return;
    try {
      await api.delete(`/fix-runners/${runnerId}`);
      await loadRunners();
    } catch (error) {
      console.error('Failed to deregister runner:', error);
    }
  }

  // Stagehands — runners that actually execute fix sessions. Labeled
  // as crew, not as infrastructure.
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Crew · Fix runners</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(34px, 4.5vw, 56px)', lineHeight: 0.98 }}>
            The <em>stagehands</em>.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            Where fix sessions actually execute — your CI, a local sandbox,
            a self-hosted runner. Jobs wait in a queue here until a runner
            picks them up.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register Runner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Fix Runner</DialogTitle>
              <DialogDescription>
                Add a runner to execute fix sessions and verifications.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Runner Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-runner-01" />
              </div>
              <div>
                <Label>Runner Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGED">Managed</SelectItem>
                    <SelectItem value="SELF_HOSTED">Self-Hosted</SelectItem>
                    <SelectItem value="LOCAL">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleRegister} disabled={addLoading || !name}>
                {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Register
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : runners.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No runners registered</h3>
            <p className="text-muted-foreground mt-1">
              Register a runner to execute fix sessions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {runners.map((runner) => (
            <Card key={runner.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusColors[runner.status] || 'bg-gray-400'}`} />
                    <CardTitle className="text-base">{runner.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{runner.type.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline">{runner.status}</Badge>
                  </div>
                </div>
                <CardDescription>
                  {runner.version && `v${runner.version} - `}
                  Registered {new Date(runner.registeredAt).toLocaleDateString()}
                  {runner.lastHeartbeatAt && ` - Last heartbeat: ${new Date(runner.lastHeartbeatAt).toLocaleString()}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runner.capabilities && Object.keys(runner.capabilities).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {(runner.capabilities as any).languages?.map((lang: string) => (
                      <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                    ))}
                    {(runner.capabilities as any).browsers?.map((browser: string) => (
                      <Badge key={browser} variant="outline" className="text-xs">{browser}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {runner.status === 'READY' && (
                    <Button variant="outline" size="sm" onClick={() => handleDrain(runner.id)}>
                      <Activity className="h-4 w-4 mr-2" />
                      Drain
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(runner.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deregister
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
