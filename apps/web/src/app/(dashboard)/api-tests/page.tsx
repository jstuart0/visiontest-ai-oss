'use client';

// API Tests — Sheet · Contract probes.
// A ruled register of endpoints. Each row = endpoint (mono), method chip,
// assertion count, last-run status rev-stamp.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Plus,
  Search,
  Zap,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

interface ApiTestItem {
  id: string;
  name: string;
  description: string | null;
  protocol: string;
  method: string;
  urlTemplate: string;
  status: string;
  tags: string[];
  _count?: { assertions: number; executions: number };
  lastExecution?: {
    id: string;
    status: string;
    durationMs: number | null;
    passedAssertions: number;
    failedAssertions: number;
    createdAt: string;
  } | null;
}

export default function ApiTestsPage() {
  const { project } = useCurrentProject();
  const [tests, setTests] = useState<ApiTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (project?.id) {
      loadTests();
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, protocolFilter]);

  async function loadTests() {
    setLoading(true);
    try {
      const params: Record<string, string> = { projectId: project!.id };
      if (protocolFilter !== 'all') params.protocol = protocolFilter;
      const data = await api.get<any>('/api-tests', params);
      setTests(data || []);
    } catch (error) {
      console.error('Failed to load API tests:', error);
      setTests([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api.get('/api-tests/stats/summary', { projectId: project!.id });
      setStats(data);
    } catch (error) {
      console.error('Failed to load API test stats:', error);
    }
  }

  async function handleRun(testId: string) {
    try {
      await api.post<any>(`/api-tests/${testId}/run`);
      await loadTests();
    } catch (error) {
      console.error('Failed to run API test:', error);
    }
  }

  const filtered = tests.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.urlTemplate.toLowerCase().includes(search.toLowerCase())
  );

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="A · CONTRACT PROBES"
        eyebrow="§ 01 · CONTRACTS"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            does it <em>still</em> return what you asked for?
          </>
        }
        lead={
          'REST and GraphQL probes filed against the endpoints your UI depends on. Each probe is a part: method, URL template, a stack of assertions, a last-run status. Run them alongside visual tests to catch breakage above and below the surface.'
        }
        actions={
          <Link href="/api-tests/new" className="vt-btn vt-btn--primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            NEW PROBE
          </Link>
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">REGISTER</span>
            <span className="v big">api contracts</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-API-{String(tests.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div>
            <span className="k">FILED</span>
            <span className="v">{String(stats?.totalApiTests ?? tests.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">ACTIVE</span>
            <span className="v">{String(stats?.activeApiTests ?? 0).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">PASS · 7D</span>
            <span
              className="v"
              style={{
                color:
                  (stats?.apiPassRate ?? 0) >= 95
                    ? 'var(--pass)'
                    : (stats?.apiPassRate ?? 0) >= 80
                      ? 'var(--warn)'
                      : 'var(--fail)',
              }}
            >
              {stats?.apiPassRate ?? 0}%
            </span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div>
            <span className="k">RUNS · 7D</span>
            <span className="v">{String(stats?.recentExecutions ?? 0).padStart(3, '0')}</span>
          </div>
        </div>

        {/* Stats plate */}
        {stats && (
          <section>
            <div className="vt-section-head">
              <span className="num">§ 02</span>
              <span className="ttl">fig. 1 · contract vitals</span>
              <span className="rule" />
              <span className="stamp">LAST 7 DAYS</span>
            </div>
            <div
              className="grid grid-cols-2 md:grid-cols-4"
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <StatCell
                label="TOTAL PROBES"
                value={stats.totalApiTests}
                unit="FILED"
                borderRight
              />
              <StatCell label="ACTIVE" value={stats.activeApiTests} unit="LIVE" borderRight />
              <StatCell
                label="PASS RATE"
                value={`${stats.apiPassRate}`}
                unit="% ± 7D"
                borderRight
                accent={stats.apiPassRate >= 95}
              />
              <StatCell label="RECENT RUNS" value={stats.recentExecutions} unit="FIRED" />
            </div>
          </section>
        )}

        {/* Filters */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ {stats ? '03' : '02'}</span>
            <span className="ttl">filter · probes</span>
            <span className="rule" />
            <span className="stamp">{String(filtered.length).padStart(2, '0')} OF {String(tests.length).padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-[420px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: 'var(--ink-2)' }}
                strokeWidth={1.5}
              />
              <input
                placeholder="SEARCH · PROBES"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="vt-input"
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>
            <Select value={protocolFilter} onValueChange={setProtocolFilter}>
              <SelectTrigger className="vt-input" style={{ width: '180px', textAlign: 'left' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}
              >
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="REST">REST</SelectItem>
                <SelectItem value="GRAPHQL">GraphQL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Probe register */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ {stats ? '04' : '03'}</span>
            <span className="ttl">schedule of probes</span>
            <span className="rule" />
            <span className="stamp">ENTRY · METHOD · URL · ASSERT · LAST</span>
          </div>

          {loading ? (
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
              — READING PROBES —
            </div>
          ) : filtered.length === 0 ? (
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
                no probes on file.
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
                File a probe against an endpoint and stack assertions on top.
                Every fired probe lands in Runs with its own ledger line.
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/api-tests/new" className="vt-btn vt-btn--primary">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  FILE FIRST PROBE
                </Link>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div
                className="grid grid-cols-[80px_90px_1fr_110px_150px_110px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['ENTRY', 'METHOD', 'PROBE · URL', 'ASSERT', 'LAST RUN', 'ACT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 5 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 3 || i === 5 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {filtered.map((test, i) => (
                <div
                  key={test.id}
                  className="grid grid-cols-[80px_90px_1fr_110px_150px_110px] gap-0 group"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--rule-soft)' : 'none',
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
                    className="py-3 px-4 flex items-center"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.14em',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    A-{String(i + 1).padStart(3, '0')}
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <MethodChip protocol={test.protocol} method={test.method} />
                  </div>
                  <Link
                    href={`/api-tests/${test.id}`}
                    className="py-3 px-4 block"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <div
                      className="transition-colors"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-0)')}
                    >
                      {test.name}
                    </div>
                    <div
                      className="truncate"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        letterSpacing: '0.06em',
                        color: 'var(--ink-2)',
                        marginTop: '3px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {test.urlTemplate}
                    </div>
                    {test.tags.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {test.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="vt-chip"
                            style={{ fontSize: '8.5px', padding: '2px 6px' }}
                          >
                            {tag.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                  <div
                    className="py-3 px-4 text-right flex items-center justify-end"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(test._count?.assertions ?? 0).padStart(2, '0')} ASSERT
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    {test.lastExecution ? (
                      <StatusStamp
                        status={test.lastExecution.status}
                        durationMs={test.lastExecution.durationMs}
                      />
                    ) : (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-2)',
                        }}
                      >
                        — PENDING
                      </span>
                    )}
                  </div>
                  <div className="py-3 px-4 flex justify-end items-center">
                    <button
                      type="button"
                      onClick={() => handleRun(test.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
                      style={{
                        border: '1px solid var(--rule)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent)';
                        e.currentTarget.style.borderColor = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--ink-1)';
                        e.currentTarget.style.borderColor = 'var(--rule)';
                      }}
                    >
                      <Zap className="w-3 h-3" strokeWidth={1.5} />
                      FIRE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
          <span>SHEET · CONTRACT PROBES</span>
          <span>PROBES · {String(tests.length).padStart(3, '0')}</span>
          <span>CHECKED · VT</span>
        </footer>
      </EditorialHero>
    </VtStage>
  );
}

/* ── primitives ── */

function StatCell({
  label,
  value,
  unit,
  borderRight,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  unit: string;
  borderRight?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="p-5"
      style={{
        borderRight: borderRight ? '1px solid var(--rule-soft)' : 'none',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginBottom: '8px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3vw, 40px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--pass)' : 'var(--ink-0)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            color: 'var(--ink-2)',
            marginLeft: '8px',
            textTransform: 'uppercase',
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function MethodChip({ protocol, method }: { protocol: string; method: string }) {
  const label = protocol === 'GRAPHQL' ? 'GQL' : method;
  const cls =
    method === 'GET'
      ? 'vt-chip vt-chip--pass'
      : method === 'DELETE'
        ? 'vt-chip vt-chip--fail'
        : method === 'POST' || method === 'PUT' || method === 'PATCH'
          ? 'vt-chip vt-chip--accent'
          : 'vt-chip';
  return (
    <span className={cls} style={{ fontSize: '9.5px', padding: '3px 8px' }}>
      {label}
    </span>
  );
}

function StatusStamp({
  status,
  durationMs,
}: {
  status: string;
  durationMs: number | null;
}) {
  const cls =
    status === 'PASSED'
      ? 'vt-rev-stamp vt-rev-stamp--pass'
      : status === 'FAILED' || status === 'ERROR' || status === 'TIMEOUT'
        ? 'vt-rev-stamp vt-rev-stamp--reject'
        : 'vt-rev-stamp';
  return (
    <div className="flex flex-col gap-1">
      <span className={cls} style={{ fontSize: '9px', padding: '3px 8px' }}>
        {status}
      </span>
      {durationMs !== null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.1em',
            color: 'var(--ink-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {durationMs}MS
        </span>
      )}
    </div>
  );
}
