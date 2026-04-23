'use client';

// /design — canonical reference for the Darkroom / Editorial design system.
// Bookmark for designers/engineers. Every token, typographic scale,
// primitive component, and status pattern lives here with a label.

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, CheckCircle2, XCircle, AlertCircle, Clock, Plus, ArrowRight } from 'lucide-react';

export default function DesignReferencePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="max-w-[1320px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      {/* Masthead */}
      <header className="pb-7 border-b mb-16 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Design · Reference</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(44px, 6vw, 84px)', lineHeight: 0.96 }}>
            The <em>Darkroom</em> / Editorial<br />system.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '58ch' }}>
            Two themes, one language. Fraunces for display, Instrument Sans
            for body, Fragment Mono for data. Film grain and safelight on
            patinated black; bone paper and cadmium red for daylight.
          </p>
        </div>
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'darkroom' ? 'editorial' : 'darkroom')}
            className="vt-btn"
          >
            {theme === 'darkroom' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'darkroom' ? 'Switch to Editorial' : 'Switch to Darkroom'}
          </button>
        )}
      </header>

      {/* ── Palette ─────────────────────────────── */}
      <Section kicker="§ 01" title="Palette" lead="Semantic tokens — the same component adapts to both themes by swapping these values. Never hardcode a color.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Swatch name="--bg-0" role="Page background" v="var(--bg-0)" />
          <Swatch name="--bg-1" role="Card / panel" v="var(--bg-1)" />
          <Swatch name="--bg-2" role="Inset / hover" v="var(--bg-2)" />
          <Swatch name="--bg-3" role="Input raised" v="var(--bg-3)" />
          <Swatch name="--ink-0" role="Primary text" v="var(--ink-0)" />
          <Swatch name="--ink-1" role="Secondary" v="var(--ink-1)" />
          <Swatch name="--ink-2" role="Mute" v="var(--ink-2)" />
          <Swatch name="--rule" role="Border / rule" v="var(--rule)" />
          <Swatch name="--accent" role="Safelight / cadmium" v="var(--accent)" />
          <Swatch name="--brass" role="Metadata / italic" v="var(--brass)" />
          <Swatch name="--pass" role="Phosphor / forest" v="var(--pass)" />
          <Swatch name="--fail" role="Kodak red / maroon" v="var(--fail)" />
        </div>
      </Section>

      {/* ── Typography ─────────────────────────────── */}
      <Section kicker="§ 02" title="Typography" lead="Three families, every theme. Hierarchy is made with optical size and italics, not with extra weight.">
        <div className="space-y-10">
          <TypeSample label="Display · opsz 144 · weight 300" family="var(--font-display)" style={{ fontSize: '84px', fontVariationSettings: '"opsz" 144', fontWeight: 300, lineHeight: 0.95, letterSpacing: '-0.035em' }}>
            Watch every <em style={{ color: 'var(--accent)' }}>change.</em>
          </TypeSample>
          <TypeSample label="Display · opsz 72 · italic" family="var(--font-display)" style={{ fontSize: '44px', fontVariationSettings: '"opsz" 72', fontStyle: 'italic', fontWeight: 350, lineHeight: 1.1 }}>
            A darkroom for your <em>interface</em>.
          </TypeSample>
          <TypeSample label="Display · opsz 24 · italic lede" family="var(--font-display)" style={{ fontSize: '22px', fontVariationSettings: '"opsz" 24', fontStyle: 'italic', color: 'var(--ink-1)' }}>
            Every step is evidence; every goal, a hypothesis.
          </TypeSample>
          <TypeSample label="Body · Instrument Sans · 16px" family="var(--font-body)" style={{ fontSize: '16px', lineHeight: 1.55, color: 'var(--ink-0)' }}>
            VisionTest runs your user stories as real browser sessions,
            photographs every step, and tells you what changed.
          </TypeSample>
          <TypeSample label="Mono · Fragment Mono · 13px" family="var(--font-mono-feature)" style={{ fontSize: '13px', letterSpacing: '0.02em', color: 'var(--ink-1)' }}>
            exec 01HXAMPLE····xxxxxxxxxxxxxxxxxx · 4.23s · chromium · main
          </TypeSample>
          <TypeSample label="Eyebrow · mono · uppercase" style={{}}>
            <span className="vt-eyebrow">Chapter I · The Darkroom</span>
          </TypeSample>
          <TypeSample label="Kicker · mono · brass" style={{}}>
            <span className="vt-kicker" style={{ color: 'var(--brass)' }}>§ Run · 2026-04-22 · chromium · main</span>
          </TypeSample>
        </div>
      </Section>

      {/* ── Buttons ─────────────────────────────── */}
      <Section kicker="§ 03" title="Buttons" lead=".vt-btn for secondary, .vt-btn--primary for the single focal action, .vt-btn--ghost for in-flow tertiary.">
        <div className="flex items-center gap-3 flex-wrap">
          <button className="vt-btn vt-btn--primary">
            <Plus className="w-4 h-4" />
            Primary
          </button>
          <button className="vt-btn">
            Secondary
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="vt-btn vt-btn--ghost">Ghost</button>
          <button className="vt-btn" disabled style={{ opacity: 0.5 }}>
            Disabled
          </button>
        </div>
      </Section>

      {/* ── Chips ─────────────────────────────── */}
      <Section kicker="§ 04" title="Status chips" lead="Used for run status, scan tree rows, goal verdicts. Tone is conveyed via tint + dot glow, never via emoji.">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="vt-chip">default</span>
          <span className="vt-chip vt-chip--accent"><CheckCircle2 className="w-3.5 h-3.5" />accent</span>
          <span className="vt-chip vt-chip--pass"><span className="vt-dot" />passed</span>
          <span className="vt-chip vt-chip--fail"><span className="vt-dot" />failed</span>
          <span className="vt-chip vt-chip--warn"><AlertCircle className="w-3.5 h-3.5" />warning</span>
          <span className="vt-chip vt-breathe"><Clock className="w-3.5 h-3.5" />running</span>
        </div>
      </Section>

      {/* ── Input ─────────────────────────────── */}
      <Section kicker="§ 05" title="Inputs" lead=".vt-input is a hairline-bottom-rule input. No box, no rounded corners. The placeholder is italic serif to feel hand-set.">
        <div className="max-w-xl">
          <input className="vt-input" placeholder="https://your-site.com" />
        </div>
      </Section>

      {/* ── Panel ─────────────────────────────── */}
      <Section kicker="§ 06" title="Panels" lead=".vt-panel frames content; .vt-panel--inset sits on a darker surface. Used sparingly — most content stands on rules alone.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="vt-panel">
            <div className="vt-kicker mb-3" style={{ color: 'var(--brass)' }}>sample</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 360, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              Login, <em style={{ color: 'var(--accent)' }}>happy path</em>
            </h3>
            <p className="mt-3 text-[14.5px]" style={{ color: 'var(--ink-1)' }}>
              Sits inside a .vt-panel. No drop shadow, just a hairline border
              and generous padding.
            </p>
          </div>
          <div className="vt-panel vt-panel--inset">
            <div className="vt-kicker mb-3" style={{ color: 'var(--brass)' }}>inset</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 360, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              Goal <em style={{ color: 'var(--accent)' }}>verdict</em>
            </h3>
            <p className="mt-3 text-[14.5px]" style={{ color: 'var(--ink-1)' }}>
              Uses --bg-2 to sit recessed inside a container surface.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Rules ─────────────────────────────── */}
      <Section kicker="§ 07" title="Rules & ornaments" lead="Hairline division, not outline boxes. The ornament ◈ is the signature mid-section break.">
        <div className="space-y-8">
          <div className="vt-rule" />
          <div className="vt-ornament">◈</div>
          <div className="vt-rule--strong" />
        </div>
      </Section>

      {/* ── Motion ─────────────────────────────── */}
      <Section kicker="§ 08" title="Motion" lead="Slow reveals, safelight breathing. No bouncy easings. No parallax. Never more than 420ms for entrances.">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="vt-panel flex items-center gap-3">
            <span className="vt-dot vt-breathe" style={{ color: 'var(--accent)', width: 14, height: 14 }} />
            <span className="vt-kicker">vt-breathe</span>
          </div>
          <div className="vt-panel flex items-center gap-3 vt-reveal">
            <span className="vt-dot" style={{ color: 'var(--pass)', width: 10, height: 10 }} />
            <span className="vt-kicker">vt-reveal</span>
          </div>
        </div>
      </Section>

      {/* Colophon */}
      <footer
        className="mt-24 pt-6 border-t vt-mono text-[11px] tracking-[0.14em] uppercase flex justify-between gap-4 flex-wrap"
        style={{ borderColor: 'var(--rule)', color: 'var(--ink-2)' }}
      >
        <span>Design system · {mounted ? (theme || 'darkroom') : 'darkroom'}</span>
        <span>Fraunces · Instrument Sans · Fragment Mono</span>
      </footer>
    </div>
  );
}

function Section({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-20">
      <div className="vt-editorial mb-10">
        <div>
          <div className="vt-kicker mb-3" style={{ color: 'var(--brass)' }}>{kicker}</div>
          <h2 className="vt-display" style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', letterSpacing: '-0.018em', lineHeight: 1.04 }}>
            {title}
          </h2>
        </div>
        {lead && (
          <p
            className="self-end pb-2 text-[15.5px] leading-[1.55]"
            style={{ color: 'var(--ink-1)', maxWidth: '48ch' }}
          >
            {lead}
          </p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Swatch({ name, role, v }: { name: string; role: string; v: string }) {
  return (
    <div>
      <div
        aria-hidden
        className="aspect-[5/3] border"
        style={{
          background: v,
          borderColor: 'var(--rule)',
          boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--ink-0) 3%, transparent)',
        }}
      />
      <div className="mt-2 vt-mono text-[11px]" style={{ color: 'var(--ink-0)' }}>{name}</div>
      <div className="vt-mono text-[10.5px] tracking-[0.1em]" style={{ color: 'var(--ink-2)' }}>{role}</div>
    </div>
  );
}

function TypeSample({
  label,
  family,
  style,
  children,
}: {
  label: string;
  family?: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-8 items-baseline">
      <div className="vt-kicker pt-2" style={{ color: 'var(--ink-2)' }}>
        {label}
      </div>
      <div style={{ fontFamily: family, ...style }}>{children}</div>
    </div>
  );
}
