'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CAPABILITIES = [
  { num: 'C-01', name: 'screenshots', spec: '1440×900 / 390×844 / 820×1180', desc: 'Pixel-perfect captures across browsers and viewports, driven by Playwright and Appium.' },
  { num: 'C-02', name: 'comparison',  spec: 'SSIM · LPIPS · DINOv2',        desc: 'Pixel + AI-semantic diff that separates intended redesigns from genuine regressions.' },
  { num: 'C-03', name: 'authoring',   spec: 'natural language → steps',    desc: 'Write tests as user stories. Goal checks compile to deterministic assertions where possible.' },
  { num: 'C-04', name: 'exploration', spec: 'crawl · depth ≤ 3',           desc: 'Point at a URL, get a coverage map of the app under test with every click path traced.' },
  { num: 'C-05', name: 'approval',    spec: 'accept · reject · rev up',    desc: 'Team review of visual changes. Every accept becomes the new baseline. Revisions tracked.' },
  { num: 'C-06', name: 'quarantine',  spec: 'flake score > 0.4',           desc: 'Automatic detection and quarantine of flaky tests. Nothing blocks a deploy on noise.' },
  { num: 'C-07', name: 'auto-fix',    spec: 'LLM → PR',                     desc: 'On genuine regression, generate a patch, verify the fix, open a PR against your repo.' },
];

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [smokeUrl, setSmokeUrl] = useState('');
  const [smokePending, setSmokePending] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) setIsAuthenticated(true);
    setChecked(true);
  }, []);
  useEffect(() => {
    if (checked && isAuthenticated) window.location.href = '/dashboard';
  }, [checked, isAuthenticated]);

  const startSmokeExplore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smokeUrl.trim()) return;
    setSmokePending(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiBase}/anon/smoke-explore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl: smokeUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.error?.code;
        if (code === 'ANONYMOUS_DISABLED') toast.error('This deployment disabled the anonymous sandbox. Sign up to try VisionTest.');
        else toast.error(err?.error?.message || 'Scan failed to queue');
        setSmokePending(false);
        return;
      }
      const body = await res.json();
      const executionId = body?.data?.executionId;
      if (executionId) window.location.href = `/runs/${executionId}`;
    } catch (err: any) {
      toast.error(err.message || 'Scan failed to queue');
      setSmokePending(false);
    }
  };

  if (!checked || isAuthenticated) return null;
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <div className="min-h-screen">
      {/* TITLE BLOCK */}
      <header
        className="sticky top-0 z-40 flex items-stretch h-[60px] backdrop-blur-sm"
        style={{
          background: 'color-mix(in oklab, var(--bg-0) 85%, transparent)',
          borderBottom: '1px solid var(--rule-strong)',
        }}
      >
        <Link href="/" className="flex items-center gap-4 shrink-0 pl-6 md:pl-10 pr-8" style={{ borderRight: '1px solid var(--rule)' }}>
          <span aria-hidden className="block w-2 h-2" style={{ background: 'var(--accent)', transform: 'rotate(45deg)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.02em', textTransform: 'lowercase', color: 'var(--ink-0)' }}>
            visiontest<span style={{ color: 'var(--accent)' }}>·</span>ai
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-4 px-6"
          style={{ borderRight: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
          <span>SHT · {isoDate}</span>
          <span style={{ color: 'var(--accent)' }}>REV · 02</span>
        </div>
        <div className="ml-auto flex items-stretch">
          <Link href="/login" className="flex items-center px-6 transition-colors"
            style={{ borderLeft: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-1)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}>
            SIGN IN
          </Link>
          <Link href="/register" className="flex items-center px-6"
            style={{ borderLeft: '1px solid var(--rule)', background: 'var(--accent)', color: 'var(--bg-0)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            ENLIST
          </Link>
        </div>
      </header>

      {/* SHEET 01 · HERO */}
      <section className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 pt-6">
          <div>
            <div className="flex items-center gap-4 mb-7 flex-wrap"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
              <span>SHEET 01 / 03</span>
              <span className="flex-1 min-w-[40px]" style={{ height: '1px', background: 'var(--ink-3)' }} />
              <span>VT-SCH-0041-A</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 7vw, 96px)', lineHeight: 0.96, letterSpacing: '-0.01em', textTransform: 'lowercase', color: 'var(--ink-0)', margin: 0 }}>
              visual regression<br />
              <span style={{ color: 'var(--accent)' }}>drafted</span>{' '}
              <span style={{ color: 'var(--ink-2)' }}>—</span>{' '}
              <span>redlined</span><br />
              before it ships.
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch', lineHeight: 1.6, marginTop: '32px' }}>
              Every interface is a schematic. Every deploy, a revision. VisionTest.ai captures your pages as precise plates, compares them against the approved baseline, and calls out the deltas like an engineer marking up a drawing set.
            </p>
            <form onSubmit={startSmokeExplore} className="mt-10 max-w-[640px] grid grid-cols-[1fr_auto] gap-2">
              <input type="url" value={smokeUrl} onChange={(e) => setSmokeUrl(e.target.value)}
                placeholder="https://your-site.com" required className="vt-input" style={{ height: '48px' }} />
              <button type="submit" disabled={smokePending} className="vt-btn vt-btn--primary" style={{ height: '48px' }}>
                {smokePending ? (<><Loader2 className="w-4 h-4 animate-spin" />RUNNING</>) : (<>SCAN IN 60s<ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} /></>)}
              </button>
            </form>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', marginTop: '12px', fontVariantNumeric: 'tabular-nums' }}>
              NO ACCOUNT · READ-ONLY PROBE · 24H SANDBOX
            </p>
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link href="/register" className="vt-btn vt-btn--primary">CREATE FREE ACCOUNT <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} /></Link>
              <Link href="/login" className="vt-btn">SIGN IN</Link>
            </div>
            <div className="mt-14 grid grid-cols-2 md:grid-cols-4" style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
              {[
                { k: 'PROBES / MO', v: '1.2M', u: 'RUNS' },
                { k: 'DIFF ACCURACY', v: '99.4', u: '% ± 0.1' },
                { k: 'BROWSERS', v: '07', u: 'ENGINES' },
                { k: 'AVG. RUN', v: '4.8', u: 'SEC' },
              ].map((x, i) => (
                <div key={x.k} className="py-4 pr-4" style={{ borderRight: i < 3 ? '1px solid var(--rule-soft)' : 'none' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: '6px' }}>{x.k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', letterSpacing: '0.04em', color: 'var(--ink-0)', fontVariantNumeric: 'tabular-nums' }}>
                    {x.v}<span style={{ fontSize: '11px', color: 'var(--ink-2)', letterSpacing: '0.16em', marginLeft: '6px' }}>{x.u}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative" style={{ border: '1px solid var(--rule-strong)', padding: '16px', background: 'color-mix(in oklab, var(--bg-1) 50%, transparent)' }}>
            <div className="flex justify-between pb-2 mb-3"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-2)', borderBottom: '1px solid var(--rule)' }}>
              <span>FIG. 1 · DEVICE SET</span><span>ORTHOGRAPHIC · 1:12</span>
            </div>
            <svg viewBox="0 0 400 500" className="w-full h-auto" style={{ color: 'var(--ink-1)' }}>
              <rect x="30" y="30" width="340" height="190" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="30" y1="60" x2="370" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="45" cy="45" r="3" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="60" cy="45" r="3" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="75" cy="45" r="3" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <text x="200" y="135" textAnchor="middle" fontSize="9" fontFamily="monospace" letterSpacing="2" fill="var(--ink-2)">1440 × 900</text>
              <text x="200" y="150" textAnchor="middle" fontSize="8" fontFamily="monospace" letterSpacing="1.5" fill="var(--ink-3)">DESKTOP · CHROMIUM</text>
              <line x1="30" y1="235" x2="370" y2="235" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
              <text x="200" y="250" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--ink-2)">⊢ 340 ⊣</text>
              <rect x="60" y="290" width="130" height="180" fill="none" stroke="currentColor" strokeWidth="1" />
              <text x="125" y="385" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="var(--ink-2)">820×1180</text>
              <text x="125" y="398" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="var(--ink-3)">TABLET</text>
              <rect x="230" y="310" width="70" height="150" fill="none" stroke="var(--accent)" strokeWidth="1" />
              <text x="265" y="385" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="var(--accent)">390×844</text>
              <text x="265" y="395" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="var(--accent)" opacity="0.7">WEBKIT</text>
              <line x1="300" y1="320" x2="360" y2="300" stroke="var(--accent)" strokeWidth="0.5" />
              <circle cx="300" cy="320" r="2" fill="var(--accent)" />
              <text x="365" y="298" fontSize="7.5" fontFamily="monospace" fill="var(--accent)" letterSpacing="1">DETAIL A</text>
            </svg>
            <div className="mt-3 pt-2 flex justify-between"
              style={{ borderTop: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
              <span>3 VIEWPORTS</span><span>REV · 07</span>
            </div>
          </div>
        </div>
      </section>

      {/* SHEET 02 · CAPABILITIES */}
      <section className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />
        <div className="vt-section-head">
          <span className="num">§ 02</span>
          <span className="ttl">schedule of capabilities</span>
          <span className="rule" />
          <span className="stamp">7 PARTS · FULLY WIRED</span>
        </div>
        <div style={{ border: '1px solid var(--rule-strong)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}>
          <div className="grid grid-cols-[80px_180px_1fr_220px] gap-0"
            style={{ borderBottom: '1px solid var(--rule-strong)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
            {['PART', 'NAME', 'DESCRIPTION', 'SPEC'].map((h, i) => (
              <div key={h} className="py-3 px-4" style={{ borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}>{h}</div>
            ))}
          </div>
          {CAPABILITIES.map((c, i) => (
            <div key={c.num} className="grid grid-cols-[80px_180px_1fr_220px] gap-0"
              style={{ borderBottom: i < CAPABILITIES.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
              <div className="py-4 px-4" style={{ borderRight: '1px solid var(--rule-soft)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.16em', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{c.num}</div>
              <div className="py-4 px-4" style={{ borderRight: '1px solid var(--rule-soft)', fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--ink-0)', textTransform: 'lowercase' }}>{c.name}</div>
              <div className="py-4 px-4" style={{ borderRight: '1px solid var(--rule-soft)', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink-1)', lineHeight: 1.5 }}>{c.desc}</div>
              <div className="py-4 px-4" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase' }}>{c.spec}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SHEET 03 · COMMISSION + FOOTER */}
      <section className="vt-sheet">
        <span className="vt-crop vt-crop--tl" /><span className="vt-crop vt-crop--tr" />
        <span className="vt-crop vt-crop--bl" /><span className="vt-crop vt-crop--br" />
        <div className="py-14 px-12 text-center" style={{ border: '1px solid var(--accent)', background: 'var(--accent-soft)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '16px', fontVariantNumeric: 'tabular-nums' }}>
            § 03 · COMMISSION
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 52px)', lineHeight: 1, letterSpacing: '-0.005em', color: 'var(--ink-0)', textTransform: 'lowercase', margin: 0 }}>
            begin the drawing set.
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--ink-1)', maxWidth: '48ch', margin: '20px auto 0', lineHeight: 1.5 }}>
            Free forever on personal projects. No credit card. Self-host with a single <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>docker compose up</code>.
          </p>
          <Link href="/register" className="vt-btn vt-btn--primary mt-8 inline-flex">
            CREATE ACCOUNT<ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Link>
        </div>
        <footer className="mt-16 pt-8"
          style={{ borderTop: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>VISIONTEST · AI</div>
            <div>SHEET TOTAL · 03</div>
            <div>CHECKED · J.S.</div>
            <div className="md:text-right">© {new Date().getFullYear()} · MIT</div>
          </div>
        </footer>
      </section>
    </div>
  );
}
