'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Compass,
  Loader2,
  Shield,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCurrentProject } from '@/hooks/useProject';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type SafetyMode = 'read-only' | 'allow-destructive' | 'sandbox';

export default function NewScanPage() {
  const router = useRouter();
  const { project } = useCurrentProject();

  const [startUrl, setStartUrl] = useState('');
  const [maxPages, setMaxPages] = useState(25);
  const [maxClicks, setMaxClicks] = useState(15);
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('read-only');
  const [stubWrites, setStubWrites] = useState(false);
  const [resetHookUrl, setResetHookUrl] = useState('');
  const [acknowledgedDestructive, setAcknowledgedDestructive] =
    useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      return api.post(`/projects/${project!.id}/scan`, {
        startUrl,
        maxPages,
        maxClicksPerPage: maxClicks,
        safety: {
          mode: safetyMode,
          stubNetworkWrites: stubWrites,
          resetHookUrl:
            safetyMode === 'sandbox' && resetHookUrl ? resetHookUrl : null,
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success('Scan queued');
      router.push(`/scan/${res.executionId}`);
    },
    onError: (err: any) => toast.error(err.message || 'Scan failed to queue'),
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">Select a project first</div>
        <Link href="/">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
    );
  }

  const canRun =
    startUrl.trim().length > 0 &&
    (safetyMode !== 'allow-destructive' || acknowledgedDestructive) &&
    (safetyMode !== 'sandbox' || resetHookUrl.trim().length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Scan project
          </h1>
          <p className="text-muted-foreground mt-1">
            Point at a URL. We crawl, click safe elements, flag the broken
            ones. Run against staging or a sandbox — not production.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="w-5 h-5" /> Where to scan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Start URL <span className="text-red-400">*</span>
            </label>
            <Input
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://staging.example.com"
              className="bg-muted border-border text-foreground"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Max pages
              </label>
              <Input
                type="number"
                min={1}
                max={200}
                value={maxPages}
                onChange={(e) =>
                  setMaxPages(Math.max(1, parseInt(e.target.value || '1')))
                }
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Max clicks per page
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxClicks}
                onChange={(e) =>
                  setMaxClicks(Math.max(1, parseInt(e.target.value || '1')))
                }
                className="bg-muted border-border text-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" /> Safety
          </CardTitle>
          <CardDescription>
            Default is read-only — destructive elements (delete, submit,
            pay, log out) are skipped and surfaced with their reason.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {(['read-only', 'allow-destructive', 'sandbox'] as SafetyMode[]).map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSafetyMode(m);
                      if (m !== 'allow-destructive')
                        setAcknowledgedDestructive(false);
                    }}
                    className={`border rounded-md px-3 py-2 text-sm text-left ${
                      safetyMode === m
                        ? 'bg-accent border-accent'
                        : 'bg-muted border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="font-medium capitalize">
                      {m.replace('-', ' ')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {m === 'read-only' &&
                        'Default. Skip destructive.'}
                      {m === 'allow-destructive' &&
                        'Click everything. Requires acknowledgement.'}
                      {m === 'sandbox' &&
                        'Click everything. Reset backend before each run.'}
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stubWrites}
              onChange={(e) => setStubWrites(e.target.checked)}
            />
            <span>
              Stub network writes (intercept DELETE/POST/PUT/PATCH with
              synthetic 200)
            </span>
          </label>

          {safetyMode === 'sandbox' && (
            <div className="space-y-2 p-3 border border-border rounded-md bg-muted/40">
              <label className="text-sm font-medium text-muted-foreground">
                Reset hook URL <span className="text-red-400">*</span>
              </label>
              <Input
                value={resetHookUrl}
                onChange={(e) => setResetHookUrl(e.target.value)}
                placeholder="https://staging.example.com/__reset"
                className="bg-muted border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                We POST to this URL before scanning. Non-2xx aborts the
                scan so we never exercise destructive actions against an
                un-reset backend.
              </p>
            </div>
          )}

          {safetyMode === 'allow-destructive' && (
            <div className="border border-amber-800/60 bg-amber-900/10 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <div className="text-amber-200 text-sm">
                  Allow-destructive mode clicks everything — delete
                  buttons, send emails, submit forms. <strong>Only use
                  against staging or a disposable test environment</strong>.
                </div>
                <label className="flex items-center gap-2 text-sm text-amber-100">
                  <input
                    type="checkbox"
                    checked={acknowledgedDestructive}
                    onChange={(e) =>
                      setAcknowledgedDestructive(e.target.checked)
                    }
                  />
                  I understand, proceed anyway.
                </label>
              </div>
            </div>
          )}

          <div className="border border-blue-800/60 bg-blue-900/10 rounded-md p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              Run against staging or a sandbox, not production. Destructive
              actions are skipped by default but heuristics are not perfect.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          disabled={!canRun || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Queuing…
            </>
          ) : (
            <>
              <Compass className="w-4 h-4 mr-2" /> Start scan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
