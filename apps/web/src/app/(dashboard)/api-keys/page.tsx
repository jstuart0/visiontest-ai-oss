'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Shield,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiKeysApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AVAILABLE_SCOPES = [
  { id: 'read', label: 'Read', description: 'Read tests, results, and configurations' },
  { id: 'write', label: 'Write', description: 'Create/update tests and configurations' },
  { id: 'execute', label: 'Execute', description: 'Trigger test executions' },
  { id: 'admin', label: 'Admin', description: 'Manage API keys and team settings' },
];

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [expiresIn, setExpiresIn] = useState('never');

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scopes: string[]; expiresIn?: string }) => {
      // Convert expiresIn duration to expiresAt ISO date
      let expiresAt: string | undefined;
      if (data.expiresIn && data.expiresIn !== 'never') {
        const days = parseInt(data.expiresIn, 10);
        if (!isNaN(days)) {
          const date = new Date();
          date.setDate(date.getDate() + days);
          expiresAt = date.toISOString();
        }
      }
      return apiKeysApi.create({ name: data.name, scopes: data.scopes, expiresAt });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyVisible(data.key || data.rawKey);
      setName('');
      setScopes(['read']);
      setExpiresIn('never');
      toast.success('API key created');
    },
    onError: () => toast.error('Failed to create API key'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: () => toast.error('Failed to revoke API key'),
  });

  function toggleScope(scopeId: string) {
    setScopes((prev) =>
      prev.includes(scopeId)
        ? prev.filter((s) => s !== scopeId)
        : [...prev, scopeId]
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for programmatic access to VisionTest.ai
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setNewKeyVisible(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            {newKeyVisible ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">API Key Created</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Copy your API key now. You won't be able to see it again.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                    <code className="flex-1 text-sm text-green-400 font-mono break-all">
                      {newKeyVisible}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(newKeyVisible)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>Store this key securely. It cannot be recovered.</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => { setCreateOpen(false); setNewKeyVisible(null); }}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">Create API Key</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Generate a new API key for external integrations.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., CI/CD Pipeline"
                      className="bg-muted border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Scopes</Label>
                    <div className="space-y-2">
                      {AVAILABLE_SCOPES.map((scope) => (
                        <label
                          key={scope.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={scopes.includes(scope.id)}
                            onCheckedChange={() => toggleScope(scope.id)}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{scope.label}</p>
                            <p className="text-xs text-muted-foreground">{scope.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Expiration</Label>
                    <Select value={expiresIn} onValueChange={setExpiresIn}>
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="30d">30 days</SelectItem>
                        <SelectItem value="90d">90 days</SelectItem>
                        <SelectItem value="1y">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      createMutation.mutate({
                        name,
                        scopes,
                        expiresIn: expiresIn === 'never' ? undefined : expiresIn,
                      })
                    }
                    disabled={!name.trim() || scopes.length === 0 || createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Keys List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="h-20" />
            </Card>
          ))}
        </div>
      ) : (apiKeys as any[])?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Key className="w-12 h-12 text-muted-foreground/70 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-1">No API keys</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create an API key to access VisionTest.ai programmatically.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(apiKeys as any[])?.map((key: any) => {
            const isRevoked = !!key.revokedAt;
            const isExpired = key.expiresAt && new Date(key.expiresAt) < new Date();

            return (
              <Card
                key={key.id}
                className={cn(
                  'bg-card border-border',
                  (isRevoked || isExpired) && 'opacity-60'
                )}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        isRevoked || isExpired
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-blue-500/10 text-blue-400'
                      )}
                    >
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{key.name}</p>
                        {isRevoked && (
                          <Badge variant="secondary" className="bg-red-500/10 text-red-400 text-xs">
                            Revoked
                          </Badge>
                        )}
                        {isExpired && !isRevoked && (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-xs text-muted-foreground font-mono">
                          vt_{key.keyPrefix}...
                        </code>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {(key.scopes || []).join(', ')}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                        {key.lastUsedAt && (
                          <span className="text-xs text-muted-foreground">
                            Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isRevoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2"
                      onClick={() => {
                        revokeMutation.mutate(key.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Revoke
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Usage Help */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Using API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Include your API key in the <code className="text-blue-400">X-API-Key</code> header:
            </p>
            <div className="bg-muted rounded-lg p-3 font-mono text-sm text-muted-foreground">
              <span className="text-muted-foreground">curl</span> -H{' '}
              <span className="text-green-400">"X-API-Key: vt_your_key_here"</span>{' '}
              <span className="text-blue-400">https://your-api.example.com/api/v1/tests</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
