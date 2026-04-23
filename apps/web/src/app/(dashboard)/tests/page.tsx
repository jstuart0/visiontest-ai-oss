'use client';

// Tests list — Blueprint / schedule-of-parts.
//
// Metaphor: tests are engineered parts. This page is the parts inventory
// for the current project. Each row is a part with an ID (T-XXX), a
// lowercase display name, a goal, an environment, a last-run stamp, and
// a revision. All chrome is ruled, sharp-edged, mono-labelled.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Play,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { EditorialHero } from '@/components/shell/EditorialHero';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { useSortableTable } from '@/hooks/useSortableTable';
import { testsApi, type Test, type Platform } from '@/lib/api';
import { PlatformFilter, PlatformBadge } from '@/components/devices/PlatformFilter';
import { toast } from 'sonner';

// -----------------------------------------------------------------------
// Status → rev-stamp variant. Last-run status is shown as the revision
// stamp on each row (pass = green, fail = red, otherwise ochre/default).
// -----------------------------------------------------------------------
type StatusKey = 'passed' | 'failed' | 'flaky' | 'running' | 'pending';
const STATUS_META: Record<
  StatusKey,
  { label: string; variant: '' | '--pass' | '--reject' | '--warn' }
> = {
  passed: { label: 'PASS', variant: '--pass' },
  failed: { label: 'FAIL', variant: '--reject' },
  flaky: { label: 'FLAKY', variant: '--warn' },
  running: { label: 'ACTIVE', variant: '' },
  pending: { label: 'DRAFT', variant: '' },
};

function normalizeStatus(s: string | undefined | null): StatusKey {
  const k = (s || '').toLowerCase();
  if (k === 'passed' || k === 'pass') return 'passed';
  if (k === 'failed' || k === 'fail') return 'failed';
  if (k === 'flaky') return 'flaky';
  if (k === 'running') return 'running';
  return 'pending';
}

// Turn a UUID / cuid into a stable short PART id: T-### via djb2 hash.
function partId(id: string): string {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  const n = (h % 900) + 100; // 100..999
  return `T-${n}`;
}

// Ruled segmented control — one filter row. No chips, no pills.
function RuledSegmented<T extends string | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex items-stretch"
      style={{ border: '1px solid var(--rule)', background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)' }}
    >
      <div
        className="px-3 py-2 shrink-0"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          borderRight: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {label}
      </div>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value) || `__${i}`}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-2 transition-colors"
            style={{
              borderRight: i < options.length - 1 ? '1px solid var(--rule)' : 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: active ? 'var(--bg-0)' : 'var(--ink-1)',
              background: active ? 'var(--accent)' : 'transparent',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<StatusKey | null>(null);
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);
  const [entityStatus, setEntityStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [deleteTest, setDeleteTest] = useState<Test | null>(null);
  const { sortColumn, sortDirection, handleSort, sortData } = useSortableTable<Test>();

  const { data: tests, isLoading } = useQuery({
    queryKey: ['tests', project?.id, { search, status: statusFilter, platform: platformFilter }],
    queryFn: () =>
      testsApi.list(project!.id, {
        search: search || undefined,
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
      } as any),
    enabled: !!project?.id,
  });

  const runMutation = useMutation({
    mutationFn: (testId: string) => testsApi.run(project!.id, testId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Run queued — redirecting to live view…');
      router.push(`/executions/${data.id}`);
    },
    onError: (error: { message: string }) => toast.error(error.message || 'Could not run part'),
  });

  const deleteMutation = useMutation({
    mutationFn: (testId: string) => testsApi.delete(project!.id, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests', project?.id] });
      toast.success('Part removed from schedule');
      setDeleteTest(null);
    },
    onError: (error: { message: string }) => toast.error(error.message || 'Could not remove part'),
  });

  const filteredBase = sortData(tests || [], {
    name: (t) => t.name,
    status: (t) => t.status,
    lastRun: (t) => t.lastRun,
    flakyScore: (t) => t.flakyScore ?? null,
  });

  const filteredTests = filteredBase.filter((t) => {
    if (entityStatus === 'active' && t.status === 'DISABLED') return false;
    if (entityStatus === 'disabled' && t.status !== 'DISABLED') return false;
    if (statusFilter) return normalizeStatus(t.lastStatus) === statusFilter;
    return true;
  });

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  // Column header with sort marker
  const SortHead = ({
    column,
    label,
    className,
  }: {
    column: 'name' | 'status' | 'lastRun' | 'flakyScore';
    label: string;
    className?: string;
  }) => {
    const active = sortColumn === column;
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className={`w-full text-left flex items-center gap-1.5 py-3 px-4 ${className || ''}`}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: active ? 'var(--accent)' : 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {label}
        {active &&
          (sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3" strokeWidth={1.5} />
          ) : (
            <ArrowDown className="w-3 h-3" strokeWidth={1.5} />
          ))}
      </button>
    );
  };

  return (
    <EditorialHero
      width="wide"
      sheet="02 · PARTS INVENTORY"
      eyebrow={`§ ${isoDate} · ${project?.name || 'NO PROJECT'}`}
      revision={<>REV · {String(filteredTests.length).padStart(3, '0')} · PARTS</>}
      title={
        <>
          schedule of <em>parts</em>.
        </>
      }
      lead={
        <>
          Every test is an engineered part. Draft one, revise it, stamp it,
          run it. This sheet lists every part currently commissioned against
          the project under test.
        </>
      }
      actions={
        <>
          <Link href="/scan/new" className="vt-btn">
            SCAN PROJECT
          </Link>
          <Link href="/tests/new" className="vt-btn vt-btn--primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            DRAFT PART
          </Link>
        </>
      }
    >
      {/* --- FILTER STRIP ------------------------------------------------ */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div
          className="flex items-stretch"
          style={{ border: '1px solid var(--rule)', minWidth: '280px', flex: '1 1 280px', maxWidth: '420px' }}
        >
          <div
            className="px-3 flex items-center shrink-0"
            style={{
              borderRight: '1px solid var(--rule)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <Search className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
            QUERY
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search part name or goal…"
            className="vt-input"
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        <RuledSegmented<'all' | 'active' | 'disabled'>
          label="STATE"
          value={entityStatus}
          onChange={setEntityStatus}
          options={[
            { value: 'all', label: 'ALL' },
            { value: 'active', label: 'ACTIVE' },
            { value: 'disabled', label: 'DISABLED' },
          ]}
        />

        <RuledSegmented<StatusKey | null>
          label="LAST RUN"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: null, label: 'ANY' },
            { value: 'passed', label: 'PASS' },
            { value: 'failed', label: 'FAIL' },
            { value: 'flaky', label: 'FLAKY' },
            { value: 'pending', label: 'DRAFT' },
          ]}
        />

        <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />
      </div>

      {/* --- SCHEDULE OF PARTS TABLE ------------------------------------ */}
      <div
        style={{
          border: '1px solid var(--rule-strong)',
          background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
        }}
      >
        {/* Table head — ruled, mono, uppercase */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '90px minmax(200px, 1.4fr) minmax(220px, 2fr) 140px 180px 100px 120px',
            borderBottom: '1px solid var(--rule-strong)',
          }}
        >
          <SortHead column="name" label="PART" />
          <SortHead
            column="name"
            label="NAME"
            className=""
          />
          <div
            className="py-3 px-4"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              borderLeft: '1px solid var(--rule-soft)',
            }}
          >
            GOAL
          </div>
          <div
            className="py-3 px-4"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              borderLeft: '1px solid var(--rule-soft)',
            }}
          >
            ENV
          </div>
          <SortHead
            column="lastRun"
            label="LAST RUN"
            className=""
          />
          <SortHead column="flakyScore" label="REV" />
          <div
            className="py-3 px-4 text-right"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              borderLeft: '1px solid var(--rule-soft)',
            }}
          >
            ACT.
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div
            className="py-16 text-center"
            style={{
              border: '1px dashed var(--rule)',
              margin: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <span className="vt-breathe">loading parts schedule…</span>
          </div>
        ) : filteredTests.length === 0 ? (
          <div
            className="m-4 py-20 px-8 text-center"
            style={{
              border: '1px dashed var(--rule-strong)',
            }}
          >
            <div
              className="vt-kicker mb-4"
              style={{ color: 'var(--ink-2)', justifyContent: 'center', display: 'flex' }}
            >
              · · · empty schedule · · ·
            </div>
            <div
              className="vt-display"
              style={{
                fontSize: 'clamp(22px, 3vw, 32px)',
                color: 'var(--ink-1)',
                marginBottom: '8px',
              }}
            >
              no parts drafted <span style={{ color: 'var(--accent)' }}>·</span> start a revision
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-2)',
                maxWidth: '52ch',
                margin: '0 auto 20px',
                lineHeight: 1.5,
              }}
            >
              Describe the journey as prose. We compile it into steps with
              confidence badges. Ship the first baseline when the run passes.
            </p>
            <Link href="/tests/new" className="vt-btn vt-btn--primary inline-flex">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              DRAFT FIRST PART
            </Link>
          </div>
        ) : (
          filteredTests.map((test, idx) => {
            const status = normalizeStatus(test.lastStatus);
            const meta = STATUS_META[status];
            const disabled = test.status === 'DISABLED';
            return (
              <div
                key={test.id}
                className="grid group"
                style={{
                  gridTemplateColumns: '90px minmax(200px, 1.4fr) minmax(220px, 2fr) 140px 180px 100px 120px',
                  borderBottom:
                    idx < filteredTests.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                  transition: 'background var(--dur-quick)',
                  background: 'transparent',
                  opacity: disabled ? 0.55 : 1,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-2)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                {/* PART */}
                <div
                  className="py-4 px-4 flex items-center"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    letterSpacing: '0.14em',
                    color: 'var(--accent)',
                    fontVariantNumeric: 'tabular-nums',
                    borderRight: '1px solid var(--rule-soft)',
                  }}
                >
                  {partId(test.id)}
                </div>

                {/* NAME */}
                <div
                  className="py-4 px-4"
                  style={{ borderRight: '1px solid var(--rule-soft)' }}
                >
                  <Link
                    href={`/tests/${test.id}`}
                    className="inline-flex items-baseline gap-2 transition-colors"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '17px',
                      color: 'var(--ink-0)',
                      textTransform: 'lowercase',
                      letterSpacing: '0.01em',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = 'var(--accent)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = 'var(--ink-0)')
                    }
                  >
                    {test.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <PlatformBadge platform={test.platform} />
                    {test.deviceProfile && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9.5px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-2)',
                        }}
                      >
                        · {test.deviceProfile.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* GOAL / description */}
                <div
                  className="py-4 px-4"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--ink-1)',
                    lineHeight: 1.5,
                  }}
                >
                  {test.description || (
                    <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>
                      — no goal recorded —
                    </span>
                  )}
                </div>

                {/* ENVIRONMENT */}
                <div
                  className="py-4 px-4 flex items-center"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10.5px',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-1)',
                  }}
                >
                  {(test.platform || 'WEB').toString()}
                </div>

                {/* LAST RUN */}
                <div
                  className="py-4 px-4 flex flex-col gap-1.5"
                  style={{ borderRight: '1px solid var(--rule-soft)' }}
                >
                  <span className={`vt-rev-stamp ${meta.variant ? `vt-rev-stamp${meta.variant}` : ''}`}>
                    {meta.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      color: 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {test.lastRun
                      ? new Date(test.lastRun).toISOString().slice(0, 16).replace('T', ' ')
                      : '——  ——'}
                  </span>
                </div>

                {/* REVISION (flaky score proxy) */}
                <div
                  className="py-4 px-4 flex items-center"
                  style={{
                    borderRight: '1px solid var(--rule-soft)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    color: 'var(--ink-1)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {test.flakyScore !== undefined && test.flakyScore !== null ? (
                    <span style={{ color: test.flakyScore > 50 ? 'var(--fail)' : test.flakyScore > 20 ? 'var(--warn)' : 'var(--ink-1)' }}>
                      {String(test.flakyScore).padStart(2, '0')}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-3)' }}>—</span>
                  )}
                </div>

                {/* ACTIONS */}
                <div className="py-3 px-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => runMutation.mutate(test.id)}
                    disabled={runMutation.isPending}
                    className="transition-colors"
                    title="Run"
                    style={{
                      border: '1px solid var(--rule)',
                      background: 'transparent',
                      padding: '6px 8px',
                      color: 'var(--ink-1)',
                      cursor: 'pointer',
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
                    <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        style={{
                          border: '1px solid var(--rule)',
                          background: 'transparent',
                          padding: '6px 8px',
                          color: 'var(--ink-1)',
                          cursor: 'pointer',
                        }}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/tests/${test.id}`)}>
                        <Edit className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                        EDIT
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                        DUPLICATE
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTest(test)}
                        style={{ color: 'var(--fail)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                        REMOVE
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}

        {/* Schedule footer — sheet stamp */}
        {!isLoading && filteredTests.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderTop: '1px solid var(--rule-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>
              {filteredTests.length} OF {tests?.length || 0} PARTS · {entityStatus.toUpperCase()}
            </span>
            <span>CHECKED · {isoDate}</span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTest} onOpenChange={() => setDeleteTest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className="vt-display"
              style={{ fontSize: '28px', color: 'var(--ink-0)', textTransform: 'lowercase' }}
            >
              remove <em style={{ color: 'var(--fail)', fontStyle: 'normal' }}>part</em>?
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-1)',
              }}
            >
              Part{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {deleteTest && partId(deleteTest.id)}
              </span>{' '}
              <em style={{ color: 'var(--ink-0)' }}>
                &quot;{deleteTest?.name}&quot;
              </em>{' '}
              will be struck from the schedule. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteTest(null)}
              className="vt-btn"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => deleteTest && deleteMutation.mutate(deleteTest.id)}
              disabled={deleteMutation.isPending}
              className="vt-btn"
              style={{
                background: 'var(--fail)',
                borderColor: 'var(--fail)',
                color: 'var(--bg-0)',
              }}
            >
              {deleteMutation.isPending ? 'STRIKING…' : 'STRIKE FROM SCHEDULE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorialHero>
  );
}
