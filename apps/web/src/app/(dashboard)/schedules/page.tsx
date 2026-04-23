'use client';

// Schedules — Sheet · Almanac.
// Cron-fired runs as a ruled register. Each row = name, cron in mono,
// timezone, last-fire, next-fire, enabled rev-stamp.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesApi, Schedule } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Play } from 'lucide-react';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function SchedulesPage() {
  const { project } = useCurrentProject();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    cron: '0 2 * * *',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules', project?.id],
    queryFn: () => schedulesApi.list(project!.id),
    enabled: !!project?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; cron: string; timezone: string }) =>
      schedulesApi.create({ ...data, projectId: project!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setCreateOpen(false);
      setNewSchedule({ name: '', cron: '0 2 * * *', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      toast.success('Schedule created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create schedule'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.run(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule triggered');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to trigger schedule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete schedule'),
  });

  function describeCron(cron: string): string {
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;
    const [min, hour, dom, month, dow] = parts;
    if (dom === '*' && month === '*' && dow === '*') {
      return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    if (dom === '*' && month === '*' && dow !== '*') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[parseInt(dow)] || dow} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    return cron;
  }

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  if (!project) {
    return (
      <VtStage width="wide">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>§ no project</div>
        <h1
          className="vt-display mb-6"
          style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
        >
          Pick a <em>project</em> —<br /> before the almanac fires.
        </h1>
        <p className="text-[17px]" style={{ color: 'var(--ink-1)' }}>
          Schedules are scoped to a project. Open the project switcher in
          the top-left.
        </p>
      </VtStage>
    );
  }

  const scheduleList = (schedules || []) as Schedule[];
  const activeCt = scheduleList.filter((s) => s.isActive).length;
  const pausedCt = scheduleList.length - activeCt;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="S · ALMANAC"
        eyebrow="§ 01 · CADENCE"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            runs by the <em>clock</em>.
          </>
        }
        lead={
          'Cron-timed firings of a test, a suite, a scan. Every firing opens a ledger entry under Runs. Nothing in the almanac executes silently — this is the schedule of schedules.'
        }
        actions={
          <button onClick={() => setCreateOpen(true)} className="vt-btn vt-btn--primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            NEW SCHEDULE
          </button>
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">REGISTER</span>
            <span className="v big">schedules of cron</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-SCH-{String(scheduleList.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div>
            <span className="k">TOTAL</span>
            <span className="v">{String(scheduleList.length).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">ACTIVE</span>
            <span className="v" style={{ color: activeCt > 0 ? 'var(--pass)' : 'var(--ink-0)' }}>
              {String(activeCt).padStart(3, '0')}
            </span>
          </div>
          <div>
            <span className="k">PAUSED</span>
            <span className="v">{String(pausedCt).padStart(3, '0')}</span>
          </div>
          <div className="span2">
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
          <div>
            <span className="k">TZ · DEFAULT</span>
            <span className="v">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        </div>

        {/* Almanac register */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ 02</span>
            <span className="ttl">schedule register</span>
            <span className="rule" />
            <span className="stamp">ENTRY · NAME · CRON · NEXT · STATE</span>
          </div>

          {isLoading ? (
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
              — READING ALMANAC —
            </div>
          ) : !scheduleList.length ? (
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
                no schedules on file.
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
                File a cron line and a timezone. Every firing will produce a
                run, and every run will produce a plate.
              </p>
              <div className="mt-8 flex justify-center">
                <button onClick={() => setCreateOpen(true)} className="vt-btn vt-btn--primary">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  FILE FIRST SCHEDULE
                </button>
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
                className="grid grid-cols-[80px_1fr_200px_180px_140px_130px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['ENTRY', 'NAME · CADENCE', 'CRON', 'NEXT FIRE', 'STATE', 'ACT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 5 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 5 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {scheduleList.map((schedule, i) => (
                <div
                  key={schedule.id}
                  className="grid grid-cols-[80px_1fr_200px_180px_140px_130px] gap-0"
                  style={{
                    borderBottom: i < scheduleList.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
                  }}
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
                    S-{String(i + 1).padStart(3, '0')}
                  </div>
                  <div
                    className="py-3 px-4"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        color: 'var(--ink-0)',
                        textTransform: 'lowercase',
                      }}
                    >
                      {schedule.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                        marginTop: '3px',
                      }}
                    >
                      {describeCron(schedule.cron)} · {schedule.timezone}
                    </div>
                    {schedule.lastRunAt && (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9.5px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-2)',
                          marginTop: '3px',
                        }}
                      >
                        LAST · {new Date(schedule.lastRunAt).toISOString().slice(0, 16).replace('T', ' ')}
                      </div>
                    )}
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {schedule.cron}
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.1em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {schedule.nextRunAt
                      ? new Date(schedule.nextRunAt).toISOString().slice(0, 16).replace('T', ' ')
                      : '— · PENDING'}
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate(schedule.id)}
                      className={schedule.isActive ? 'vt-rev-stamp vt-rev-stamp--pass' : 'vt-rev-stamp'}
                      style={{ fontSize: '9.5px', padding: '3px 10px', cursor: 'pointer' }}
                    >
                      {schedule.isActive ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </div>
                  <div className="py-3 px-4 flex justify-end items-center gap-2">
                    <button
                      type="button"
                      aria-label="Run now"
                      onClick={() => runMutation.mutate(schedule.id)}
                      disabled={runMutation.isPending}
                      className="w-7 h-7 flex items-center justify-center transition-colors"
                      style={{ border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent)';
                        e.currentTarget.style.borderColor = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--ink-2)';
                        e.currentTarget.style.borderColor = 'var(--rule)';
                      }}
                    >
                      <Play className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => deleteMutation.mutate(schedule.id)}
                      className="w-7 h-7 flex items-center justify-center transition-colors"
                      style={{ border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--fail)';
                        e.currentTarget.style.borderColor = 'var(--fail)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--ink-2)';
                        e.currentTarget.style.borderColor = 'var(--rule)';
                      }}
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
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
          <span>SHEET · ALMANAC</span>
          <span>ENTRIES · {String(scheduleList.length).padStart(3, '0')}</span>
          <span>CHECKED · VT</span>
        </footer>
      </EditorialHero>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}>
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              new schedule
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
              FILE AS S-xxx · CRON-FIRED
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block">
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: '6px',
                }}
              >
                NAME
              </span>
              <input
                value={newSchedule.name}
                onChange={(e) => setNewSchedule((s) => ({ ...s, name: e.target.value }))}
                placeholder="NIGHTLY REGRESSION"
                className="vt-input"
                style={{ width: '100%' }}
              />
            </label>
            <label className="block">
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: '6px',
                }}
              >
                CRON EXPRESSION
              </span>
              <input
                value={newSchedule.cron}
                onChange={(e) => setNewSchedule((s) => ({ ...s, cron: e.target.value }))}
                placeholder="0 2 * * *"
                className="vt-input"
                style={{ width: '100%' }}
              />
              <span
                className="block mt-2"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                — {describeCron(newSchedule.cron)} · {newSchedule.timezone}
              </span>
            </label>
            <label className="block">
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                  marginBottom: '6px',
                }}
              >
                TIMEZONE
              </span>
              <input
                value={newSchedule.timezone}
                onChange={(e) => setNewSchedule((s) => ({ ...s, timezone: e.target.value }))}
                placeholder="AMERICA/NEW_YORK"
                className="vt-input"
                style={{ width: '100%' }}
              />
            </label>
          </div>
          <DialogFooter>
            <button onClick={() => setCreateOpen(false)} className="vt-btn vt-btn--ghost">
              CANCEL
            </button>
            <button
              onClick={() => createMutation.mutate(newSchedule)}
              disabled={!newSchedule.name || !newSchedule.cron || createMutation.isPending}
              className="vt-btn vt-btn--primary"
            >
              {createMutation.isPending ? 'FILING…' : 'FILE SCHEDULE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VtStage>
  );
}
