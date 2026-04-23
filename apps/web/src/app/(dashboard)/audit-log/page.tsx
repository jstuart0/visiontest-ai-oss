'use client';

// Audit log — the press record.
// Designed as a linear typewriter printout: each entry is a single
// line of the ledger, with the timestamp on the left (tabular mono)
// and the action sentence composed from actor + verb + object.
// No cards. No icons. Just typography — which is what a log is.

import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { useCurrentProject } from '@/hooks/useProject';
import { ScrollText } from 'lucide-react';

export default function AuditLogPage() {
  const { project } = useCurrentProject();
  const orgId = project?.orgId;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', orgId],
    queryFn: () => organizationsApi.auditLog(orgId!, { limit: '100' }),
    enabled: !!orgId,
  });

  const logs: any[] = data?.data || data || [];

  if (!orgId) {
    return (
      <div className="max-w-[860px] mx-auto px-6 md:px-12 py-10">
        <div className="vt-kicker mb-3" style={{ color: 'var(--accent)' }}>
          § audit log
        </div>
        <p className="vt-italic" style={{ fontSize: '20px', color: 'var(--ink-1)' }}>
          Select a project to view its organization&apos;s audit log.
        </p>
      </div>
    );
  }

  // Group by date for the press-record structure: each day gets its
  // own banner.
  const grouped = new Map<string, any[]>();
  for (const l of logs) {
    const d = new Date(l.createdAt);
    const key = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(l);
  }

  return (
    <div className="max-w-[960px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      {/* Newspaper masthead — intentionally cold, dateline above title */}
      <header className="pb-7 border-b-2 mb-14" style={{ borderColor: 'var(--ink-0)' }}>
        <div className="vt-kicker mb-4" style={{ color: 'var(--ink-2)' }}>
          § Audit log · All actions, all time
        </div>
        <h1
          className="vt-display"
          style={{ fontSize: 'clamp(44px, 6vw, 76px)', lineHeight: 0.97 }}
        >
          The <em>record</em>.
        </h1>
        <p
          className="mt-4 vt-italic"
          style={{
            fontVariationSettings: '"opsz" 24',
            fontSize: '17px',
            color: 'var(--ink-1)',
            maxWidth: '56ch',
          }}
        >
          Every action, every actor, every resource — a printed page for
          when someone asks &ldquo;who changed that?&rdquo;
        </p>
      </header>

      {isLoading ? (
        <div className="vt-italic" style={{ color: 'var(--ink-2)' }}>
          Loading the record…
        </div>
      ) : logs.length === 0 ? (
        <div className="py-20 text-center" style={{ color: 'var(--ink-2)' }}>
          <ScrollText className="w-8 h-8 mx-auto mb-5" strokeWidth={1} />
          <p
            className="vt-italic"
            style={{
              fontVariationSettings: '"opsz" 36',
              fontSize: '22px',
              color: 'var(--ink-1)',
            }}
          >
            No entries yet. The record starts the next time someone changes
            anything.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {Array.from(grouped.entries()).map(([day, entries]) => (
            <section key={day}>
              <div className="flex items-baseline gap-5 mb-4 pb-2 border-b" style={{ borderColor: 'var(--rule)' }}>
                <span
                  className="vt-italic"
                  style={{
                    fontVariationSettings: '"opsz" 72',
                    fontWeight: 340,
                    fontSize: '28px',
                    letterSpacing: '-0.01em',
                    color: 'var(--ink-0)',
                  }}
                >
                  {day}
                </span>
                <span
                  className="ml-auto vt-kicker"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              <ol className="m-0 p-0 list-none">
                {entries.map((log: any, i: number) => (
                  <li
                    key={log.id}
                    className="grid gap-6 py-3 border-b"
                    style={{
                      gridTemplateColumns: '96px 1fr',
                      borderColor: 'var(--rule-soft)',
                      animation: `vt-reveal var(--dur-reveal) ${i * 20}ms var(--ease-out) both`,
                    }}
                  >
                    <span
                      className="vt-mono text-[12px] tabular-nums pt-0.5"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {new Date(log.createdAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })}
                    </span>

                    <div>
                      <div className="text-[15px] leading-[1.5]" style={{ color: 'var(--ink-0)' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle: 'italic',
                            fontVariationSettings: '"opsz" 24',
                            color: 'var(--brass)',
                          }}
                        >
                          {log.user?.name || log.user?.email || 'System'}
                        </span>{' '}
                        <span style={{ color: 'var(--ink-1)' }}>
                          {verbFor(log.action)}
                        </span>{' '}
                        <span style={{ color: 'var(--ink-0)' }}>
                          {log.resource}
                          {log.resourceId ? ` #${log.resourceId.slice(0, 8)}` : ''}
                        </span>
                      </div>
                      {log.details && (
                        <pre
                          className="mt-1 vt-mono text-[11.5px] whitespace-pre-wrap"
                          style={{ color: 'var(--ink-2)', fontSize: '11.5px' }}
                        >
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details).slice(0, 200)}
                        </pre>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// Turn an ACTION string into a short natural verb phrase for the press
// record. Keeps the recordline readable as a sentence.
function verbFor(action: string): string {
  const a = (action || '').toLowerCase();
  const MAP: Record<string, string> = {
    create: 'created',
    created: 'created',
    update: 'updated',
    updated: 'updated',
    delete: 'deleted',
    deleted: 'deleted',
    approve: 'approved',
    approved: 'approved',
    reject: 'rejected',
    rejected: 'rejected',
    login: 'signed in to',
    logout: 'signed out of',
  };
  for (const k of Object.keys(MAP)) {
    if (a.includes(k)) return MAP[k];
  }
  return `performed ${a.replace(/_/g, ' ')} on`;
}
