'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Eye,
  Camera,
  GitCompare,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FlaskConical,
  Smartphone,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const features = [
  {
    icon: Camera,
    title: 'Automated Screenshots',
    description:
      'Capture pixel-perfect screenshots of your web pages automatically across different viewports and devices.',
  },
  {
    icon: GitCompare,
    title: 'Visual Comparison',
    description:
      'Pixel-by-pixel comparison detects even the smallest unintended changes in your UI.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Analysis',
    description:
      'Get intelligent insights about visual changes with natural language descriptions and auto-healing.',
  },
  {
    icon: CheckCircle2,
    title: 'Approval Workflow',
    description:
      'Review, approve, or reject changes with a streamlined team-based approval process.',
  },
  {
    icon: Smartphone,
    title: 'Cross-Platform Testing',
    description:
      'Test across Web, iOS, Android, and Mobile Web with Playwright and Appium integration.',
  },
  {
    icon: Shield,
    title: 'Flaky Test Detection',
    description:
      'Automatically detect, quarantine, and manage flaky tests with smart scoring.',
  },
];

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [smokeUrl, setSmokeUrl] = useState('');
  const [smokePending, setSmokePending] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setChecked(true);
  }, []);

  // If authenticated, redirect to dashboard
  useEffect(() => {
    if (checked && isAuthenticated) {
      window.location.href = '/dashboard';
    }
  }, [checked, isAuthenticated]);

  const startSmokeExplore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smokeUrl.trim()) return;
    setSmokePending(true);
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiBase}/anon/smoke-explore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl: smokeUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.error?.code;
        if (code === 'ANONYMOUS_DISABLED') {
          toast.error(
            'This deployment disabled the anonymous sandbox. Sign up to try VisionTest.',
          );
        } else {
          toast.error(err?.error?.message || 'Scan failed to queue');
        }
        setSmokePending(false);
        return;
      }
      const body = await res.json();
      const executionId = body?.data?.executionId;
      if (executionId) {
        window.location.href = `/runs/${executionId}`;
      }
    } catch (err: any) {
      toast.error(err.message || 'Scan failed to queue');
      setSmokePending(false);
    }
  };

  if (!checked || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-foreground">VisionTest.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-4 py-20 text-center">
        <div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Catch Visual Bugs
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Before Your Users Do
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            VisionTest.ai automatically detects unintended UI changes through visual regression
            testing. Compare screenshots, get AI insights, and ship with confidence.
          </p>

          {/* Smoke Explore — Phase 4 anonymous evaluator flow. */}
          <form
            onSubmit={startSmokeExplore}
            className="mx-auto mb-6 max-w-xl flex gap-2"
          >
            <Input
              type="url"
              value={smokeUrl}
              onChange={(e) => setSmokeUrl(e.target.value)}
              placeholder="https://your-site.com"
              className="h-11 bg-card border-border text-foreground"
              required
            />
            <Button
              type="submit"
              size="lg"
              disabled={smokePending}
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
            >
              {smokePending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  Try it in 60s
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mb-10">
            No account needed. We&apos;ll run a 1-page read-only probe
            and let you keep going for 24 hours without signing up.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white">
                Create free account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 border-border text-muted-foreground hover:bg-accent"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mt-16">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <div className="h-3 w-3 rounded-full bg-muted" />
              <div className="h-3 w-3 rounded-full bg-muted" />
              <span className="ml-4 text-sm text-muted-foreground">VisionTest.ai Dashboard</span>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
                <div className="h-2 w-16 rounded bg-muted" />
                <div className="aspect-video rounded bg-muted" />
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Baseline</span>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
                <div className="h-2 w-16 rounded bg-muted" />
                <div className="aspect-video rounded bg-muted" />
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">New Screenshot</span>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
                <div className="h-2 w-16 rounded bg-muted" />
                <div className="aspect-video rounded bg-muted" />
                <div className="flex items-center gap-2">
                  <GitCompare className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Diff: 2.3%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
            Everything You Need for Visual Testing
          </h2>
          <p className="text-muted-foreground">
            A complete toolkit to ensure your UI stays pixel-perfect across platforms
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-border/80"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-blue-400">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 py-20">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-12 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">Ready to Start Testing?</h2>
          <p className="mb-8 text-white/70">
            Join teams who ship with confidence using VisionTest.ai
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="h-11 px-6">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1200px] px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <FlaskConical className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-medium text-muted-foreground">VisionTest.ai</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} VisionTest.ai. Visual regression testing made simple.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
