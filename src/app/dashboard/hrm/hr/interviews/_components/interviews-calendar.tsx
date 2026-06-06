'use client';
import { fmtDate } from '@/lib/utils';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
/**
 * Interviews calendar — read-only month/week grid grouping interviews
 * by `scheduledAt` date.
 *
 * TODO 1D.4: drag-to-reschedule + click-empty-cell-creates — depends on
 * a `rescheduleInterview(id, dt)` mutation.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';

interface Interview {
  _id: string;
  candidateId?: string;
  scheduledAt?: string | Date;
  type?: string;
  result?: string;
  roundNumber?: number;
  interviewerName?: string;
}

export function InterviewsCalendar({
  interviews,
}: {
  interviews: Interview[];
}) {
  const byDate = React.useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const i of interviews) {
      if (!i.scheduledAt) continue;
      const key = new Date(i.scheduledAt).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [interviews]);

  const sortedKeys = React.useMemo(
    () => Array.from(byDate.keys()).sort(),
    [byDate],
  );

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-[14px]">
          Upcoming interviews by date
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        {sortedKeys.length === 0 ? (
          <p className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] px-3 py-6 text-center text-[13px] text-[var(--st-text-secondary)]">
            No interviews scheduled.
          </p>
        ) : (
          <ul className="space-y-3">
            {sortedKeys.map((day) => (
              <li key={day}>
                <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                  {fmtDate(day)}
                </h4>
                <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
                  {(byDate.get(day) || []).map((i) => (
                    <Link
                      key={i._id}
                      href={`/dashboard/hrm/hr/interviews/${i._id}`}
                      className="block rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 hover:bg-[var(--st-bg-secondary)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-[var(--st-text)]">
                          {i.scheduledAt
                            ? new Date(i.scheduledAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}{' '}
                          · R{i.roundNumber ?? '?'}
                        </span>
                        <StatusPill
                          label={i.result || 'pending'}
                          tone={statusToTone(i.result)}
                        />
                      </div>
                      <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                        {i.interviewerName || '—'} · {i.type || '—'}
                      </p>
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ZoruCardContent>
    </Card>
  );
}
