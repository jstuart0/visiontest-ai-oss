'use client';

// Landing page — the first impression for VisionTest.ai.
// Editorial structure even in the Darkroom theme: a signature italic
// headline, a narrow URL input that promises the 60-second evaluator,
// then three "what it actually does" beats arranged asymmetrically.
// No grid-of-six feature cards. No purple gradient. No AI-slop.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

export default function LandingPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [smokeUrl, setSmokeUrl] = useState('');
  const [smokePending, setSmokePending] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Avoid getting stuck on landing when already signed in
    if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
      router.replace('/dashboard');
    }
  }, [router]);

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
            'This deployment disables the anonymous sandbox. Sign up to try it.',
          );
        } else {
          toast.error(err?.error?.message || 'Could not queue the scan.');
        }
        setSmokePending(false);
        return;
      }
      const body = await res.json();
      const executionId = body?.data?.executionId;
      if (executionId) window.location.href = `/runs/${executionId}`;
    } catch (err: any) {
      toast.error(err.message || 'Could not queue the scan.');
      setSmokePending(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
      {/* slim sticky chrome */}
      <header
        className="sticky top-0 z-40 backdrop-blur-sm border-b h-[60px]"
        style={{ background: 'var(--bg-0)', borderColor: 'var(--rule)' }}
      >
        <div className="max-w-[1320px] mx-auto h-full flex items-center px-6 md:px-10 gap-6">
          <Link href="/" className="flex items-baseline gap-2.5 group shrink-0">
            <span
              aria-hidden
              className="block w-2 h-2 rounded-full vt-breathe self-center"
              style={{ background: 'var(--accent)', boxShadow: 'var(--accent-glow)' }}
            />
            <span
              className="text-[20px] leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 144',
                fontWeight: 380,
                letterSpacing: '-0.02em',
              }}
            >
              VisionTest<em style={{ color: 'var(--accent)', fontWeight: 350 }}>.ai</em>
            </span>
          </Link>
          <nav
            className="hidden md:flex items-center gap-6 pl-6 border-l vt-mono text-[11px] tracking-[0.18em] uppercase"
            style={{ borderColor: 'var(--rule)', color: 'var(--ink-2)' }}
          >
            <a href="#what" className="hover:text-[color:var(--ink-0)] transition-colors">What it does</a>
            <a href="#how" className="hover:text-[color:var(--ink-0)] transition-colors">How it works</a>
            <a
              href="https://github.com/jstuart0/visiontest-ai-oss"
              className="hover:text-[color:var(--ink-0)] transition-colors"
            >
              GitHub ↗
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {mounted && (
              <button
                type="button"
                onClick={() =>
                  setTheme(theme === 'darkroom' ? 'editorial' : 'darkroom')
                }
                className="h-9 w-9 border flex items-center justify-center transition-colors"
                style={{ borderColor: 'var(--rule)', color: 'var(--ink-1)' }}
                aria-label="Toggle theme"
              >
                {theme === 'darkroom' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            )}
            <Link
              href="/login"
              className="vt-mono text-[11px] tracking-[0.18em] uppercase px-3 py-2"
              style={{ color: 'var(--ink-1)' }}
            >
              Sign in
            </Link>
            <Link href="/register" className="vt-btn vt-btn--primary">
              Get access
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-6 md:px-10 pt-20 pb-40 relative">
        {/* top meta row */}
        <div className="flex items-baseline justify-between mb-14 vt-stagger">
          <span className="vt-eyebrow">Chapter I · The Darkroom</span>
          <span className="vt-kicker hidden md:block">
            Vol. 2 · Issue 04 · OSS
          </span>
        </div>

        <div className="grid grid-cols-12 gap-8 items-end">
          {/* Headline */}
          <h1
            className="col-span-12 md:col-span-10 vt-display vt-reveal"
            style={{
              fontSize: 'clamp(56px, 9vw, 140px)',
              lineHeight: 0.92,
            }}
          >
            Watch for <em>what</em>
            <br />
            changes, frame<br />
            by frame.
          </h1>

          {/* Sub-column — right-aligned lede */}
          <div
            className="col-span-12 md:col-span-8 md:col-start-3 mt-6 md:mt-10"
            style={{ animationDelay: '120ms' }}
          >
            <p
              className="vt-reveal"
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 36',
                fontSize: 'clamp(18px, 1.6vw, 22px)',
                fontStyle: 'italic',
                lineHeight: 1.45,
                color: 'var(--ink-1)',
                maxWidth: '36ch',
              }}
            >
              Write a user story in plain English. We run it against your site
              — step by step, every frame photographed — then tell you, in
              daylight, exactly what moved.
            </p>
          </div>

          {/* Smoke Explore prompt — narrow, no border box */}
          <form
            onSubmit={startSmokeExplore}
            className="col-span-12 md:col-span-8 md:col-start-3 mt-10 vt-reveal"
            style={{ animationDelay: '200ms' }}
          >
            <div
              className="flex items-end gap-4 pb-2 border-b"
              style={{ borderColor: 'var(--ink-3)' }}
            >
              <span className="vt-kicker pb-2" style={{ color: 'var(--accent)' }}>
                Try it
              </span>
              <input
                type="url"
                value={smokeUrl}
                onChange={(e) => setSmokeUrl(e.target.value)}
                placeholder="https://your-site.com"
                required
                className="flex-1 bg-transparent outline-none py-2 min-w-0"
                style={{
                  fontFamily: 'var(--font-mono-feature)',
                  fontSize: '18px',
                  color: 'var(--ink-0)',
                }}
              />
              <button
                type="submit"
                disabled={smokePending}
                className="vt-btn vt-btn--primary shrink-0"
              >
                {smokePending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Developing
                  </>
                ) : (
                  <>
                    Develop
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <p
              className="mt-3 vt-kicker"
              style={{ color: 'var(--ink-2)' }}
            >
              No account needed · we keep your sandbox 24h · anonymous scans are read-only
            </p>
          </form>
        </div>
      </section>

      {/* ── ornamental rule ──────────────────────────────────────── */}
      <div className="max-w-[1320px] mx-auto px-6 md:px-10">
        <div className="vt-ornament">◈</div>
      </div>

      {/* ── What it does — three beats, asymmetric ─────────── */}
      <section
        id="what"
        className="max-w-[1320px] mx-auto px-6 md:px-10 py-32"
      >
        <div className="mb-20 flex items-baseline justify-between flex-wrap gap-6">
          <h2
            className="vt-display"
            style={{
              fontSize: 'clamp(40px, 5vw, 64px)',
              letterSpacing: '-0.025em',
            }}
          >
            Three things it does <em>really</em> well.
          </h2>
          <span className="vt-kicker">§ II · capabilities</span>
        </div>

        <div className="grid grid-cols-12 gap-x-10 gap-y-20">
          {/* beat 1 — Story */}
          <article className="col-span-12 md:col-span-7">
            <div
              className="vt-kicker mb-4"
              style={{ color: 'var(--brass)' }}
            >
              01 · stories
            </div>
            <h3
              className="mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 72',
                fontSize: 'clamp(28px, 3vw, 42px)',
                fontWeight: 360,
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
              }}
            >
              Describe the journey.{' '}
              <em style={{ color: 'var(--accent)' }}>
                It writes the test.
              </em>
            </h3>
            <p
              className="text-[16.5px] leading-[1.55]"
              style={{ color: 'var(--ink-1)', maxWidth: '55ch' }}
            >
              Your stories compile to a real step array that our worker
              executes in a real browser. Every sentence is parsed with a
              confidence badge — exact, heuristic, or unknown — so you can
              see how we interpreted it before it runs.
            </p>
          </article>

          {/* sample story — visual */}
          <aside
            className="col-span-12 md:col-span-5 md:mt-16"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--rule)',
              padding: '28px 32px',
              transform: 'translateY(-12px) rotate(-0.6deg)',
            }}
          >
            <div
              className="vt-kicker mb-3"
              style={{ color: 'var(--brass)' }}
            >
              spec. VT-042 · draft
            </div>
            <pre
              className="m-0 whitespace-pre-wrap"
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 24',
                fontStyle: 'italic',
                fontSize: '16px',
                lineHeight: 1.55,
                color: 'var(--ink-0)',
              }}
            >{`Go to /login.
Type "admin@acme.co" in the email field.
Click "Sign in".
Wait for the dashboard.
Verify "Welcome back" is visible.`}</pre>
            <div
              className="mt-5 pt-4 border-t vt-mono text-[11px] tracking-[0.14em]"
              style={{
                color: 'var(--ink-2)',
                borderColor: 'var(--rule)',
              }}
            >
              goal · <span style={{ color: 'var(--pass)' }}>URL ends /dashboard</span> · <span style={{ color: 'var(--pass)' }}>"Welcome" visible</span>
            </div>
          </aside>

          {/* beat 2 — Scan */}
          <article className="col-span-12 md:col-span-5 md:col-start-2 order-3 md:order-none">
            <div
              className="vt-kicker mb-4"
              style={{ color: 'var(--brass)' }}
            >
              02 · exploration
            </div>
            <h3
              className="mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 72',
                fontSize: 'clamp(28px, 3vw, 42px)',
                fontWeight: 360,
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
              }}
            >
              Point it at a URL.{' '}
              <em style={{ color: 'var(--accent)' }}>Find the broken.</em>
            </h3>
            <p
              className="text-[16.5px] leading-[1.55]"
              style={{ color: 'var(--ink-1)', maxWidth: '55ch' }}
            >
              An exploratory crawler enumerates clickables, classifies every
              element (destructive or safe), exercises the safe ones, and
              flags failures. Works on staging or a sandbox — never your
              production.
            </p>
          </article>

          {/* sample scan tree */}
          <aside
            className="col-span-12 md:col-span-6 md:col-start-7 order-4 md:order-none md:-mt-6"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--rule)',
              padding: '20px 24px',
            }}
          >
            <div
              className="flex items-center justify-between vt-kicker mb-3"
              style={{ color: 'var(--ink-2)' }}
            >
              <span>scan · acme.example.com</span>
              <span style={{ color: 'var(--pass)' }}>42 pages · 187 interactions</span>
            </div>
            <ul
              className="m-0 p-0 list-none vt-mono text-[13px]"
              style={{ color: 'var(--ink-1)', lineHeight: 1.9 }}
            >
              <li>/ <span style={{ color: 'var(--pass)' }}>✓</span></li>
              <li className="pl-5">├── /login <span style={{ color: 'var(--pass)' }}>✓</span></li>
              <li className="pl-5">├── /dashboard <span style={{ color: 'var(--pass)' }}>✓</span></li>
              <li className="pl-10">│   ├── [button: "New Project"] <span style={{ color: 'var(--pass)' }}>✓</span></li>
              <li className="pl-10">│   └── [link: /orders] <span style={{ color: 'var(--pass)' }}>✓</span></li>
              <li className="pl-5">├── /orders <span style={{ color: 'var(--warn)' }}>⚠ 1 console error</span></li>
              <li className="pl-10">│   └── [button: "Delete"] <span style={{ color: 'var(--fail)' }}>✗ 500</span></li>
              <li className="pl-5">└── /settings <span style={{ color: 'var(--pass)' }}>✓</span></li>
            </ul>
          </aside>

          {/* beat 3 — Baseline */}
          <article className="col-span-12 md:col-span-7">
            <div
              className="vt-kicker mb-4"
              style={{ color: 'var(--brass)' }}
            >
              03 · baselines
            </div>
            <h3
              className="mb-6"
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: '"opsz" 72',
                fontSize: 'clamp(28px, 3vw, 42px)',
                fontWeight: 360,
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
              }}
            >
              Photograph the pass.{' '}
              <em style={{ color: 'var(--accent)' }}>Catch the drift.</em>
            </h3>
            <p
              className="text-[16.5px] leading-[1.55]"
              style={{ color: 'var(--ink-1)', maxWidth: '55ch' }}
            >
              One click on a passing run sets it as the baseline. Every run
              after that is compared against it, pixel by pixel. Approve or
              reject changes with a keystroke. The baseline moves with the
              design.
            </p>
          </article>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section
        id="how"
        className="max-w-[1320px] mx-auto px-6 md:px-10 pb-32"
      >
        <div className="mb-16 flex items-baseline justify-between flex-wrap gap-6">
          <h2
            className="vt-display"
            style={{
              fontSize: 'clamp(40px, 5vw, 64px)',
              letterSpacing: '-0.025em',
            }}
          >
            <em>Four</em> steps to first signal.
          </h2>
          <span className="vt-kicker">§ III · in 60 seconds</span>
        </div>

        <ol
          className="grid grid-cols-1 md:grid-cols-4 gap-10 m-0 p-0 list-none"
          style={{ counterReset: 'step' }}
        >
          {[
            { n: '01', t: 'Point', d: 'Drop a URL above. We start an anonymous sandbox in a single HTTP call.' },
            { n: '02', t: 'Write', d: 'Describe the journey in plain sentences. The preview shows how we parsed each one.' },
            { n: '03', t: 'Watch', d: 'The worker runs it live — every step is photographed; you see them stream in.' },
            { n: '04', t: 'Baseline', d: 'Once it passes, press Set as baseline. Every run after that is a diff.' },
          ].map((s, i) => (
            <li key={s.n} className="relative" style={{ animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 80}ms var(--ease-out) both` }}>
              <div
                className="vt-mono text-[11px] tracking-[0.3em] uppercase mb-3"
                style={{ color: 'var(--accent)' }}
              >
                step {s.n}
              </div>
              <h3
                className="mb-3"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontVariationSettings: '"opsz" 72',
                  fontWeight: 340,
                  fontSize: '28px',
                  letterSpacing: '-0.01em',
                }}
              >
                {s.t}
              </h3>
              <p
                className="text-[15px] leading-[1.55]"
                style={{ color: 'var(--ink-1)' }}
              >
                {s.d}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-6 md:px-10 pb-40">
        <div
          className="relative overflow-hidden"
          style={{
            borderTop: '1px solid var(--rule)',
            borderBottom: '1px solid var(--rule)',
            padding: '80px 0',
          }}
        >
          <div className="text-center max-w-[680px] mx-auto">
            <h2
              className="vt-display mb-6"
              style={{
                fontSize: 'clamp(36px, 5vw, 68px)',
                letterSpacing: '-0.025em',
              }}
            >
              Ready to <em>develop</em> your first run?
            </h2>
            <p
              className="vt-italic mb-10"
              style={{
                fontVariationSettings: '"opsz" 36',
                fontSize: '19px',
                color: 'var(--ink-1)',
              }}
            >
              Free, open-source, self-hostable — no credit card, no cloud lock-in.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/register" className="vt-btn vt-btn--primary">
                Create free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="vt-btn">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Colophon ──────────────────────────────────────── */}
      <footer
        className="max-w-[1320px] mx-auto px-6 md:px-10 py-12"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        <div className="flex items-baseline justify-between flex-wrap gap-4 vt-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: 'var(--ink-2)' }}>
          <span>
            VisionTest.<em style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--accent)', letterSpacing: 0, fontSize: '14px' }}>ai</em> — OSS · MIT
          </span>
          <span>Designed in the darkroom — Fraunces · Instrument Sans · Fragment Mono</span>
        </div>
      </footer>
    </div>
  );
}
