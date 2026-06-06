'use client';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
/**
 * Candidates kanban — groups candidates by stage. Read-only board for
 * now (drag-to-reorder will land in a follow-up that wires the stage
 * mutation action).
 *
 * TODO 1D.4: drag-between-columns optimistic update — depends on a
 * `updateCandidateStage(id, stage)` server action.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';

const STAGES = [
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
];

interface Candidate {
  _id: string;
  name?: string;
  email?: string;
  stage?: string;
  rating?: number;
  jobId?: string;
}

export function CandidatesKanban({
  candidates,
}: {
  candidates: Candidate[];
}) {
  const buckets = React.useMemo(() => {
    const m = new Map<string, Candidate[]>();
    for (const s of STAGES) m.set(s.key, []);
    for (const c of candidates) {
      const k = c.stage || 'applied';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [candidates]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((s) => {
        const items = buckets.get(s.key) || [];
        return (
          <div key={s.key} className="min-w-[240px] w-[240px] shrink-0">
            <Card className="p-0 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-[13px]">
                  <span>{s.label}</span>
                  <span className="rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11px] text-[var(--st-text-secondary)]">
                    {items.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] px-3 py-3 text-center text-[12px] text-[var(--st-text-secondary)]">
                    No candidates
                  </p>
                ) : (
                  items.map((c) => (
                    <Link
                      key={c._id}
                      href={`/dashboard/hrm/hr/candidates/${c._id}`}
                      className="block rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 hover:bg-[var(--st-bg-secondary)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                          {c.name || '—'}
                        </span>
                        {c.rating != null ? (
                          <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                            ★ {c.rating}
                          </span>
                        ) : null}
                      </div>
                      {c.email ? (
                        <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                          {c.email}
                        </p>
                      ) : null}
                      <div className="mt-1.5">
                        <StatusPill
                          label={c.stage || 'applied'}
                          tone={statusToTone(c.stage)}
                        />
                      </div>
                    </Link>
                  ))
                )}
              </CardBody>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
