'use client';

// /design — canonical Blueprint design system reference.
// A single plate that catalogs every token, typographic specimen,
// drafting primitive, and atomic component used across VisionTest.ai.
// Bookmark this sheet; everything here is load-bearing for the UI language.

import { EditorialHero } from '@/components/shell/EditorialHero';

const SURFACES: Array<{ token: string; value: string; role: string }> = [
  { token: '--bg-0', value: '#0A1838', role: 'sheet ground' },
  { token: '--bg-1', value: '#0E1B42', role: 'card / panel' },
  { token: '--bg-2', value: '#112151', role: 'inset / hover' },
  { token: '--bg-3', value: '#0C1633', role: 'deepest inset' },
];

const INKS: Array<{ token: string; value: string; role: string }> = [
  { token: '--ink-0', value: '#C9E3EE', role: 'primary text' },
  { token: '--ink-1', value: '#A8D8E8', role: 'strong line' },
  { token: '--ink-2', value: '#6E93A8', role: 'dim / label' },
  { token: '--ink-3', value: '#415A70', role: 'ghost' },
];

const ACCENTS: Array<{ token: string; value: string; role: string }> = [
  { token: '--accent', value: '#D4A24C', role: 'revision ochre' },
  { token: '--brass', value: '#A8D8E8', role: 'secondary line' },
  { token: '--rule', value: 'rgba 22%', role: 'hairline divider' },
  { token: '--rule-strong', value: 'rgba 45%', role: 'title rule' },
];

const STATUS: Array<{ token: string; value: string; role: string }> = [
  { token: '--pass', value: '#7BB98A', role: 'approved' },
  { token: '--fail', value: '#DC3D37', role: 'rejected' },
  { token: '--warn', value: '#D4A24C', role: 'flagged' },
  { token: '--grid-major', value: 'rgba 14%', role: 'drafting grid' },
];

export default function DesignReferencePage() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <>
      <EditorialHero
        title={<>design <span style={{ color: 'var(--accent)' }}>·</span> system</>}
        lead="Blueprint. Navy ground, chalk linework, ochre revisions, red rejects. One plate, every token and primitive used across the product."
        sheet="99 OF 99"
        revision={<>REV · 02 · CHECKED · J.S.</>}
        eyebrow="§ REFERENCE · BLUEPRINT"
        width="wide"
      >
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* § 01 · TOKENS                                                   */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <Section num="§ 01" title="tokens" stamp="4 GROUPS · 16 VARS">
          <p className="mt-1 mb-8" style={lead}>
            Every colour referenced by a component is one of these tokens. Never hardcode a hex.
            Surfaces deepen inward (bg-0 → bg-3); ink lightens outward (ink-0 → ink-3). The ochre
            accent is reserved for active revisions and single focal actions.
          </p>

          <TokenGrid heading="Surfaces · the stock" rows={SURFACES} />
          <TokenGrid heading="Ink · chalk line values" rows={INKS} />
          <TokenGrid heading="Accent · ochre + chalk" rows={ACCENTS} />
          <TokenGrid heading="Status · verdicts" rows={STATUS} />
        </Section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* § 02 · TYPOGRAPHY                                               */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <Section num="§ 02" title="typography" stamp="4 FAMILIES · TAB NUMS">
          <p className="mt-1 mb-8" style={lead}>
            Four typefaces, each with one job. Display for page titles, body for prose, mono for
            labels / data / ruled metadata, hand for sparing revision marks. Hierarchy comes from
            size and optical context, not weight.
          </p>

          <div className="space-y-10">
            <TypeSpecimen
              label="display · var(--font-display)"
              meta="Major Mono Display · 88 / 0.96 · lowercase · -0.01em"
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(44px, 7vw, 88px)',
                  lineHeight: 0.96,
                  letterSpacing: '-0.01em',
                  textTransform: 'lowercase',
                  color: 'var(--ink-0)',
                }}
              >
                visiontest<span style={{ color: 'var(--accent)' }}>·</span>ai
              </span>
            </TypeSpecimen>

            <TypeSpecimen
              label="body · var(--font-body)"
              meta="Space Grotesk · 16 / 1.6 · regular"
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  lineHeight: 1.6,
                  color: 'var(--ink-1)',
                  maxWidth: '60ch',
                }}
              >
                Every interface is a schematic. VisionTest.ai captures your pages as precise plates,
                compares them against the approved baseline, and redlines the deltas the way an
                engineer marks up a drawing set — with intention, not noise.
              </p>
            </TypeSpecimen>

            <TypeSpecimen
              label="mono · var(--font-mono)"
              meta="JetBrains Mono · 13 · tabular · 0.16em"
            >
              <div
                className="vt-mono"
                style={{
                  fontSize: '13px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-1)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                VT-SCH-0041-A · REV 02 · 2026.04.23 · CHROMIUM · 1440×0900 · 4.82s
              </div>
            </TypeSpecimen>

            <TypeSpecimen
              label="hand · var(--font-hand)"
              meta="Caveat · 22 · ochre · rev notes only"
            >
              <span className="vt-annotation">see detail A — header rule changed 1px → 0.5px</span>
            </TypeSpecimen>

            <TypeSpecimen label="labels · utilities" meta=".vt-eyebrow · .vt-kicker · .vt-leader">
              <div className="space-y-4">
                <div className="vt-eyebrow">§ eyebrow · section marker</div>
                <div className="vt-kicker">kicker · metadata row</div>
                <div className="vt-leader">leader · detail a</div>
              </div>
            </TypeSpecimen>
          </div>
        </Section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* § 03 · DRAFTING PRIMITIVES                                      */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <Section num="§ 03" title="drafting primitives" stamp="SIGNATURE MARKS">
          <p className="mt-1 mb-8" style={lead}>
            The signature marks that make a VisionTest plate recognisable. Use them sparingly;
            they are the frame of a drawing, not decoration.
          </p>

          {/* title block */}
          <PrimitiveLabel name=".vt-title-block" role="sheet metadata grid" />
          <div className="vt-title-block mb-12">
            <div className="span2">
              <span className="k">project</span>
              <span className="v big">visiontest · ai</span>
            </div>
            <div className="span2">
              <span className="k">plate</span>
              <span className="v">VT-SCH-0041-A</span>
            </div>
            <div>
              <span className="k">sheet</span>
              <span className="v">99 / 99</span>
            </div>
            <div>
              <span className="k">scale</span>
              <span className="v">1 : 1</span>
            </div>
            <div className="span2">
              <span className="k">title</span>
              <span className="v big">design system reference</span>
            </div>
            <div className="span2">
              <span className="k">drawn</span>
              <span className="v">j. stuart · {today}</span>
            </div>
            <div>
              <span className="k">checked</span>
              <span className="v">j.s.</span>
            </div>
            <div>
              <span className="k">rev</span>
              <span className="v" style={{ color: 'var(--accent)' }}>02</span>
            </div>
          </div>

          {/* revision stamps */}
          <PrimitiveLabel name=".vt-rev-stamp" role="three variants" />
          <div className="flex items-center gap-4 flex-wrap mb-12">
            <span className="vt-rev-stamp">REV · 02 · {today}</span>
            <span className="vt-rev-stamp vt-rev-stamp--pass">APPROVED · J.S.</span>
            <span className="vt-rev-stamp vt-rev-stamp--reject">REJECT · SEE NOTE</span>
          </div>

          {/* section head */}
          <PrimitiveLabel name=".vt-section-head" role="numbered plate head" />
          <div className="mb-12" style={{ marginTop: '-16px' }}>
            <div className="vt-section-head" style={{ margin: '24px 0 0' }}>
              <span className="num">§ XX</span>
              <span className="ttl">sample section head</span>
              <span className="rule" />
              <span className="stamp">STAMP · META</span>
            </div>
          </div>

          {/* dimension callout */}
          <PrimitiveLabel name=".vt-dim-h" role="dimension callout" />
          <div
            className="mb-12"
            style={{
              border: '1px solid var(--rule)',
              padding: '28px 40px',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div className="vt-dim-h">
              <span className="tick-l" />
              <span className="v">1440</span>
              <span className="tick-r" />
            </div>
          </div>

          {/* crop marks */}
          <PrimitiveLabel name=".vt-crop --tl/--tr/--bl/--br" role="sheet corner marks" />
          <div
            className="mb-12"
            style={{
              position: 'relative',
              height: '200px',
              border: '1px solid var(--rule)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <span className="vt-crop vt-crop--tl" />
            <span className="vt-crop vt-crop--tr" />
            <span className="vt-crop vt-crop--bl" />
            <span className="vt-crop vt-crop--br" />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              SAMPLE SHEET · 4 CROP MARKS
            </div>
          </div>

          {/* annotation */}
          <PrimitiveLabel name=".vt-annotation" role="handwritten rev note" />
          <div
            style={{
              border: '1px dashed var(--rule)',
              padding: '20px 24px',
              background: 'color-mix(in oklab, var(--bg-1) 30%, transparent)',
            }}
          >
            <span className="vt-annotation">
              header rule 1px → 0.5px — see detail A, reviewer concurs
            </span>
          </div>
        </Section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* § 04 · ATOMS                                                    */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <Section num="§ 04" title="atoms" stamp="CHIPS · BUTTONS · INPUT · PANEL">
          <p className="mt-1 mb-8" style={lead}>
            The smallest composable pieces. Every product screen is built from these — no bespoke
            one-off controls.
          </p>

          <PrimitiveLabel name=".vt-chip" role="four status variants" />
          <div className="flex items-center gap-3 flex-wrap mb-10">
            <span className="vt-chip">default</span>
            <span className="vt-chip vt-chip--accent">
              <span className="vt-dot" />
              accent
            </span>
            <span className="vt-chip vt-chip--pass">
              <span className="vt-dot" />
              passed
            </span>
            <span className="vt-chip vt-chip--fail">
              <span className="vt-dot" />
              failed
            </span>
            <span className="vt-chip vt-chip--warn">
              <span className="vt-dot" />
              warn
            </span>
          </div>

          <PrimitiveLabel name=".vt-btn" role="primary · default · ghost · disabled" />
          <div className="flex items-center gap-3 flex-wrap mb-10">
            <button type="button" className="vt-btn vt-btn--primary">PRIMARY</button>
            <button type="button" className="vt-btn">DEFAULT</button>
            <button type="button" className="vt-btn vt-btn--ghost">GHOST</button>
            <button type="button" className="vt-btn" disabled style={{ opacity: 0.45 }}>
              DISABLED
            </button>
          </div>

          <PrimitiveLabel name=".vt-input" role="hairline-rule field" />
          <div className="max-w-xl mb-10">
            <input
              className="vt-input"
              placeholder="https://your-site.com"
              aria-label="sample input"
            />
          </div>

          <PrimitiveLabel name=".vt-panel · .vt-panel--inset" role="framed content surface" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div className="vt-panel">
              <div className="vt-kicker mb-3">sample · default</div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  lineHeight: 1.1,
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                }}
              >
                login · <span style={{ color: 'var(--accent)' }}>happy path</span>
              </h3>
              <p
                className="mt-3"
                style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink-1)' }}
              >
                Sits on --bg-1. Hairline border, no shadow, no rounded corners.
              </p>
            </div>
            <div className="vt-panel vt-panel--inset">
              <div className="vt-kicker mb-3">sample · inset</div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  lineHeight: 1.1,
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                }}
              >
                goal · <span style={{ color: 'var(--accent)' }}>verdict</span>
              </h3>
              <p
                className="mt-3"
                style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--ink-1)' }}
              >
                Sits on --bg-2 to sit recessed inside a container panel.
              </p>
            </div>
          </div>

          <PrimitiveLabel name=".vt-rule · .vt-ornament" role="dividers" />
          <div className="space-y-6">
            <div className="vt-rule" />
            <div className="vt-rule--dashed" />
            <div className="vt-rule--strong" />
            <div className="vt-ornament">◈</div>
          </div>
        </Section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* § 05 · SAMPLE COMPOSITION                                       */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <Section num="§ 05" title="sample composition" stamp="FIG. 1 · HOW THEY SIT TOGETHER">
          <p className="mt-1 mb-8" style={lead}>
            A miniature hero showing how atoms compose into a plate. Title block on the left,
            orthographic figure on the right, status chips along the bottom rail.
          </p>

          <div
            className="relative"
            style={{
              border: '1px solid var(--rule-strong)',
              padding: '40px 44px 28px',
              background: 'color-mix(in oklab, var(--bg-1) 45%, transparent)',
            }}
          >
            <span className="vt-crop vt-crop--tl" />
            <span className="vt-crop vt-crop--tr" />
            <span className="vt-crop vt-crop--bl" />
            <span className="vt-crop vt-crop--br" />

            <div
              className="flex items-center gap-4 mb-6 flex-wrap"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>FIG. 1 · HERO</span>
              <span className="flex-1 min-w-[40px]" style={{ height: '1px', background: 'var(--ink-3)' }} />
              <span className="vt-rev-stamp">REV · 02 · {today}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-10 items-start">
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(32px, 4vw, 52px)',
                    lineHeight: 0.98,
                    letterSpacing: '-0.01em',
                    textTransform: 'lowercase',
                    color: 'var(--ink-0)',
                    margin: 0,
                  }}
                >
                  visual regression<br />
                  <span style={{ color: 'var(--accent)' }}>drafted</span>{' '}
                  <span style={{ color: 'var(--ink-2)' }}>—</span> redlined.
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '15px',
                    color: 'var(--ink-1)',
                    maxWidth: '52ch',
                    lineHeight: 1.55,
                    marginTop: '20px',
                  }}
                >
                  Every deploy is a revision. Capture plates, diff against the approved baseline,
                  and ship the deltas with an engineer&apos;s stamp.
                </p>

                <div className="flex items-center gap-3 flex-wrap mt-6">
                  <button type="button" className="vt-btn vt-btn--primary">SCAN IN 60s</button>
                  <button type="button" className="vt-btn">SIGN IN</button>
                </div>

                <div className="flex items-center gap-3 flex-wrap mt-8">
                  <span className="vt-chip vt-chip--pass"><span className="vt-dot" />32 passed</span>
                  <span className="vt-chip vt-chip--fail"><span className="vt-dot" />3 failed</span>
                  <span className="vt-chip vt-chip--warn"><span className="vt-dot" />1 warn</span>
                  <span className="vt-chip">4.82s</span>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--rule)',
                  padding: '12px',
                  background: 'color-mix(in oklab, var(--bg-3) 50%, transparent)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                    paddingBottom: '8px',
                    marginBottom: '8px',
                    borderBottom: '1px solid var(--rule)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>DETAIL A</span>
                  <span>1 : 4</span>
                </div>
                <svg viewBox="0 0 240 260" className="w-full h-auto" style={{ color: 'var(--ink-1)' }}>
                  {/* desktop viewport */}
                  <rect x="14" y="14" width="212" height="130" fill="none" stroke="currentColor" strokeWidth="1" />
                  <line x1="14" y1="34" x2="226" y2="34" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
                  <circle cx="24" cy="24" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <circle cx="32" cy="24" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <circle cx="40" cy="24" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <text
                    x="120"
                    y="82"
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="monospace"
                    letterSpacing="1.5"
                    fill="var(--ink-2)"
                  >
                    1440 × 900
                  </text>
                  <text
                    x="120"
                    y="95"
                    textAnchor="middle"
                    fontSize="7"
                    fontFamily="monospace"
                    letterSpacing="1"
                    fill="var(--ink-3)"
                  >
                    DESKTOP
                  </text>

                  {/* dashed separator */}
                  <line
                    x1="14"
                    y1="158"
                    x2="226"
                    y2="158"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />

                  {/* mobile · highlighted in ochre */}
                  <rect
                    x="40"
                    y="172"
                    width="54"
                    height="76"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1"
                  />
                  <text
                    x="67"
                    y="213"
                    textAnchor="middle"
                    fontSize="7"
                    fontFamily="monospace"
                    fill="var(--accent)"
                    letterSpacing="1"
                  >
                    390×844
                  </text>

                  {/* tablet */}
                  <rect
                    x="120"
                    y="172"
                    width="86"
                    height="76"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <text
                    x="163"
                    y="213"
                    textAnchor="middle"
                    fontSize="7"
                    fontFamily="monospace"
                    fill="var(--ink-2)"
                    letterSpacing="1"
                  >
                    820×1180
                  </text>

                  {/* leader */}
                  <line x1="94" y1="182" x2="118" y2="166" stroke="var(--accent)" strokeWidth="0.5" />
                  <circle cx="94" cy="182" r="1.5" fill="var(--accent)" />
                  <text
                    x="122"
                    y="164"
                    fontSize="7"
                    fontFamily="monospace"
                    fill="var(--accent)"
                    letterSpacing="1"
                  >
                    A
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </Section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Footer                                                          */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <footer
          className="mt-16 pt-8"
          style={{
            borderTop: '1px solid var(--rule)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>VISIONTEST · AI</div>
            <div>SHEET 99 / 99</div>
            <div>REV · 02 · {today}</div>
            <div className="md:text-right">CHECKED · J.S. · MIT</div>
          </div>
        </footer>
      </EditorialHero>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/* Internals                                                             */
/* ───────────────────────────────────────────────────────────────────── */

const lead: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '15px',
  lineHeight: 1.55,
  color: 'var(--ink-1)',
  maxWidth: '64ch',
};

function Section({
  num,
  title,
  stamp,
  children,
}: {
  num: string;
  title: string;
  stamp: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-4">
      <div className="vt-section-head" style={{ margin: '56px 0 20px' }}>
        <span className="num">{num}</span>
        <span className="ttl">{title}</span>
        <span className="rule" />
        <span className="stamp">{stamp}</span>
      </div>
      {children}
    </section>
  );
}

function TokenGrid({
  heading,
  rows,
}: {
  heading: string;
  rows: Array<{ token: string; value: string; role: string }>;
}) {
  return (
    <div className="mb-12">
      <div
        className="flex items-center gap-4 mb-4"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{heading}</span>
        <span className="flex-1" style={{ height: '1px', background: 'var(--rule)' }} />
        <span>{rows.length} · VARS</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rows.map((r) => (
          <Swatch key={r.token} token={r.token} value={r.value} role={r.role} />
        ))}
      </div>
    </div>
  );
}

function Swatch({ token, value, role }: { token: string; value: string; role: string }) {
  return (
    <div>
      <div
        aria-hidden
        style={{
          aspectRatio: '5 / 3',
          background: `var(${token})`,
          border: '1px solid var(--rule)',
          boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--ink-0) 4%, transparent)',
        }}
      />
      <div
        className="mt-2 vt-mono"
        style={{
          fontSize: '11px',
          letterSpacing: '0.08em',
          color: 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {token}
      </div>
      <div
        className="vt-mono"
        style={{
          fontSize: '10px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginTop: '2px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {role}
      </div>
      <div
        className="vt-mono"
        style={{
          fontSize: '10px',
          letterSpacing: '0.06em',
          color: 'var(--ink-3)',
          marginTop: '2px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TypeSpecimen({
  label,
  meta,
  children,
}: {
  label: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 md:gap-10 items-start"
      style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: '24px' }}
    >
      <div>
        <div
          className="vt-mono"
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {label}
        </div>
        <div
          className="vt-mono mt-2"
          style={{
            fontSize: '10px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {meta}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function PrimitiveLabel({ name, role }: { name: string; role: string }) {
  return (
    <div
      className="flex items-center gap-4 mb-4"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ color: 'var(--accent)' }}>{name}</span>
      <span className="flex-1" style={{ height: '1px', background: 'var(--rule)' }} />
      <span style={{ color: 'var(--ink-2)' }}>{role}</span>
    </div>
  );
}
