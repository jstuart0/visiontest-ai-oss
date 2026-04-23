'use client';

// Masks — Sheet · Redaction index.
// A register of concealed regions on plates. Each mask = ruled row with
// the test it belongs to, region coordinates in mono, and reason.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { useSortableTable } from '@/hooks/useSortableTable';
import { testsApi, type Test } from '@/lib/api';
import { MaskEditor } from '@/components/visual/MaskEditor';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function MasksPage() {
  const { project } = useCurrentProject();
  const [search, setSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const { sortData } = useSortableTable<Test>();

  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['tests', project?.id],
    queryFn: () => testsApi.list(project!.id),
    enabled: !!project?.id,
  });

  const filteredTests = sortData(
    tests?.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())) || [],
    { name: (t) => t.name }
  );

  const handleEditMasks = (test: Test) => {
    setSelectedTest(test);
    setShowEditor(true);
  };

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const testCt = tests?.length ?? 0;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="M · REDACTIONS"
        eyebrow="§ 01 · OCCLUSIONS"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            the <em>redaction</em> index.
          </>
        }
        lead={
          'Registered rectangles the camera should not compare. Timestamps, avatars, ad slots, counters — anything that changes for reasons that are not regressions. One entry per masked region, filed against its parent test.'
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">REGISTER</span>
            <span className="v big">ignore regions</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-MSK-{String(testCt).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div className="span2">
            <span className="k">TESTS · SCOPE</span>
            <span className="v">{String(testCt).padStart(3, '0')} ON FILE</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div>
            <span className="k">PROJECT</span>
            <span className="v">{(project?.slug || project?.name || '—').toString().toUpperCase()}</span>
          </div>
          <div>
            <span className="k">CHECKED</span>
            <span className="v">VT</span>
          </div>
        </div>

        {/* Legend */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl">legend · what counts as a mask</span>
            <span className="rule" />
            <span className="stamp">REFERENCE</span>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0"
            style={{
              border: '1px solid var(--rule-strong)',
              background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
            }}
          >
            <div
              className="p-6"
              style={{ borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule-soft)' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  marginBottom: '8px',
                }}
              >
                DEF · MASK
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                A rectangle drawn on a baseline plate that says &ldquo;ignore these
                pixels.&rdquo; The diff engine skips the region for SSIM, LPIPS, and
                DINOv2 comparisons.
              </p>
            </div>
            <div className="p-6" style={{ borderBottom: '1px solid var(--rule-soft)' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  marginBottom: '8px',
                }}
              >
                USE · CASES
              </div>
              <ul
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--ink-1)',
                  lineHeight: 1.6,
                  margin: 0,
                  paddingLeft: 0,
                  listStyle: 'none',
                }}
              >
                <li>· DYNAMIC · DATES · TIMES · COUNTERS</li>
                <li>· THIRD-PARTY · ADS · CHAT · WIDGETS</li>
                <li>· IDENTITY · AVATARS · USERNAMES</li>
                <li>· MOTION · CAROUSELS · LOADERS</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Search */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 03</span>
            <span className="ttl">filter · tests</span>
            <span className="rule" />
            <span className="stamp">{String(filteredTests.length).padStart(2, '0')} OF {String(testCt).padStart(2, '0')}</span>
          </div>
          <div className="relative max-w-[420px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--ink-2)' }}
              strokeWidth={1.5}
            />
            <input
              type="search"
              placeholder="SEARCH · TESTS"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vt-input"
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
        </section>

        {/* Register */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 04</span>
            <span className="ttl">register of redactions</span>
            <span className="rule" />
            <span className="stamp">ENTRY · TEST · MASKS · ACT</span>
          </div>

          {testsLoading ? (
            <div
              className="p-12 text-center"
              style={{
                border: '1px dashed var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              — READING TESTS —
            </div>
          ) : filteredTests.length === 0 ? (
            <div
              className="p-12 text-center"
              style={{
                border: '1px dashed var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
              }}
            >
              <div
                className="vt-kicker"
                style={{ color: 'var(--ink-2)', justifyContent: 'center' }}
              >
                PLATE EMPTY
              </div>
              <h3
                className="mt-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(22px, 2.5vw, 32px)',
                  color: 'var(--ink-0)',
                  textTransform: 'lowercase',
                }}
              >
                {search ? 'no tests match.' : 'no tests on file.'}
              </h3>
              <p
                className="mt-3 mx-auto"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  maxWidth: '52ch',
                  color: 'var(--ink-1)',
                  lineHeight: 1.5,
                }}
              >
                {search
                  ? 'Clear the filter, or widen the search.'
                  : 'Author a test before filing redactions against it.'}
              </p>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[90px_1fr_160px_130px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['ENTRY', 'TEST', 'MASKS', 'ACT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 3 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 3 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {filteredTests.map((test, i) => (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => handleEditMasks(test)}
                  className="grid grid-cols-[90px_1fr_160px_130px] gap-0 text-left w-full group"
                  style={{
                    borderBottom: i < filteredTests.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    transition: 'background var(--dur-quick) var(--ease-out)',
                    animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      'color-mix(in oklab, var(--bg-2) 35%, transparent)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="py-3 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.14em',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    M-{String(i + 1).padStart(3, '0')}
                  </div>
                  <div
                    className="py-3 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                      }}
                    >
                      {test.name}
                    </div>
                    {test.description && (
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '12px',
                          color: 'var(--ink-2)',
                          marginTop: '2px',
                        }}
                      >
                        {test.description}
                      </div>
                    )}
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                    }}
                  >
                    <span className="vt-chip" style={{ fontSize: '9.5px', padding: '3px 8px' }}>
                      OPEN · REGISTER
                    </span>
                  </div>
                  <div className="py-3 px-4 flex justify-end items-center gap-2">
                    <span
                      className="inline-flex items-center gap-2 transition-colors"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <Edit className="w-3 h-3" strokeWidth={1.5} />
                      EDIT
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Colophon */}
        <footer
          className="pt-6 flex justify-between gap-4 flex-wrap"
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
          <span>SHEET · REDACTIONS</span>
          <span>TESTS · {String(testCt).padStart(3, '0')}</span>
          <span>CHECKED · VT</span>
        </footer>
      </EditorialHero>

      {/* Mask editor dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent
          className="max-h-[90vh] overflow-hidden"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--rule-strong)',
            maxWidth: '56rem',
          }}
        >
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              redact · {selectedTest?.name}
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              DRAW RECTANGLES · IGNORE REGIONS
            </DialogDescription>
          </DialogHeader>
          {selectedTest && project && (
            <MaskEditor
              projectId={project.id}
              testId={selectedTest.id}
              onClose={() => setShowEditor(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </VtStage>
  );
}
