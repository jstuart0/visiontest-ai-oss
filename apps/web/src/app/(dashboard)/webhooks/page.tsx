'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Plus,
  Trash2,
  Play,
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { webhooksApi, type Webhook, type WebhookEvent } from '@/lib/api';
import { toast } from 'sonner';

const WEBHOOK_EVENTS: Array<{ value: WebhookEvent; label: string; description: string }> = [
  { value: 'TEST_PASSED', label: 'Test Passed', description: 'When a test passes' },
  { value: 'TEST_FAILED', label: 'Test Failed', description: 'When a test fails' },
  { value: 'BASELINE_UPDATED', label: 'Baseline Updated', description: 'When a baseline is approved' },
  { value: 'SCHEDULE_COMPLETED', label: 'Schedule Completed', description: 'When a scheduled run finishes' },
  { value: 'FLAKY_DETECTED', label: 'Flaky Detected', description: 'When a test is marked as flaky' },
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks', project?.id],
    queryFn: () => webhooksApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; url: string; events: string[]; projectId: string }) =>
      webhooksApi.create(data),
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', project?.id] });
      if (webhook.secret) {
        setNewSecret(webhook.secret);
      }
      setNewWebhook({ name: '', url: '', events: [] });
      setCreateOpen(false);
      toast.success('Webhook created');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create webhook');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      webhooksApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', project?.id] });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to update webhook');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', project?.id] });
      toast.success('Webhook deleted');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete webhook');
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.test(id),
    onMutate: (id) => setTestingId(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Test successful - Response: ${result.statusCode}`);
      } else {
        toast.error(result.error || `Test failed - Status: ${result.statusCode}`);
      }
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to test webhook');
    },
    onSettled: () => setTestingId(null),
  });

  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim() || newWebhook.events.length === 0) {
      toast.error('Fill all required fields and select at least one event');
      return;
    }
    createMutation.mutate({
      ...newWebhook,
      projectId: project!.id,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Bell className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Project Selected</h2>
        <p className="text-muted-foreground">Select a project to manage webhooks.</p>
      </div>
    );
  }

  // Terminal config — webhooks are wiring. Mono-led, spare. Headline
  // references the physical metaphor: wires into your pipeline.
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10" style={{ borderColor: 'var(--rule)' }}>
        <div className="vt-eyebrow mb-5">§ Wiring · Webhooks</div>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="vt-display" style={{ fontSize: 'clamp(38px, 5vw, 60px)', lineHeight: 0.98 }}>
              Wire us into your <em>pipeline</em>.
            </h1>
            <p
              className="mt-4 vt-italic"
              style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}
            >
              Every failed test, every approved change, every scheduled run
              — we POST a signed JSON payload to any URL you point at.
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="vt-btn vt-btn--primary shrink-0">
            <Plus className="w-4 h-4" /> Add webhook
          </button>
        </div>
      </header>

      {/* Secret display after creation */}
      {newSecret && (
        <Card className="bg-amber-900/20 border-amber-700/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-amber-300">Save your webhook secret</span>
            </div>
            <p className="text-sm text-amber-200/70 mb-3">
              This secret will only be shown once. Use it to verify webhook signatures.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-card rounded text-xs font-mono text-muted-foreground break-all">
                {newSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret);
                  toast.success('Secret copied');
                }}
                className="border-border text-muted-foreground hover:bg-accent"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-amber-400 hover:text-amber-300"
              onClick={() => setNewSecret(null)}
            >
              I&apos;ve saved it
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Webhooks List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-12 h-12 text-muted-foreground/70 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No webhooks configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up webhooks to integrate with CI/CD pipelines and notification systems
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card
              key={webhook.id}
              className={`bg-card border-border ${!webhook.isActive ? 'opacity-60' : ''}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{webhook.name}</h3>
                      {webhook.failureCount > 0 && (
                        <Badge variant="destructive" className="text-xs bg-red-500/10 text-red-400">
                          {webhook.failureCount} failures
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate max-w-xs">{webhook.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <Badge
                          key={event}
                          variant="secondary"
                          className="text-xs bg-muted text-muted-foreground"
                        >
                          {event.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                    {webhook.lastTriggered && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testMutation.mutate(webhook.id)}
                      disabled={testingId === webhook.id}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      {testingId === webhook.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: webhook.id, isActive: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(webhook.id)}
                      className="text-muted-foreground hover:text-red-400 hover:bg-accent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedWebhookId(expandedWebhookId === webhook.id ? null : webhook.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Deliveries
                  </Button>
                </div>
                {expandedWebhookId === webhook.id && (
                  <DeliveryHistory webhookId={webhook.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Signature Verification Guide */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Webhook Signature Verification
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            VisionTest.ai signs all webhook payloads using HMAC SHA-256.
          </p>
          <pre className="p-3 bg-muted rounded text-xs font-mono text-muted-foreground overflow-x-auto">
{`const crypto = require('crypto');
const signature = req.headers['x-visiontest-signature'];
const expected = 'sha256=' + crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (signature !== expected) throw new Error('Invalid signature');`}
          </pre>
        </CardContent>
      </Card>

      {/* Create Webhook Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Webhook</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Configure a webhook endpoint to receive event notifications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Name</Label>
              <Input
                value={newWebhook.name}
                onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                placeholder="CI/CD Integration"
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Endpoint URL</Label>
              <Input
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground mb-2 block">Events</Label>
              <div className="space-y-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={event.value}
                      checked={newWebhook.events.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                    />
                    <label htmlFor={event.value} className="text-sm cursor-pointer">
                      <span className="font-medium text-foreground">{event.label}</span>
                      <span className="text-muted-foreground ml-2">{event.description}</span>
                    </label>
                  </div>
                ))}
              </div>
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
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryHistory({ webhookId }: { webhookId: string }) {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => webhooksApi.deliveries(webhookId),
  });

  if (isLoading) return <div className="mt-3 text-sm text-muted-foreground">Loading deliveries...</div>;
  if (!deliveries?.length) return <div className="mt-3 text-sm text-muted-foreground">No deliveries yet.</div>;

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Recent Deliveries</p>
      {deliveries.slice(0, 10).map((d) => (
        <div key={d.id} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {d.success ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}
            <span className="text-muted-foreground">{d.event?.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {d.statusCode && <Badge variant="outline" className="text-xs px-1">{d.statusCode}</Badge>}
            <span>{new Date(d.createdAt).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
