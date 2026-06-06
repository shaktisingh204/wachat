'use client';

import { Card } from '@/components/sabcrm/20ui/compat';
import * as React from 'react';
import Link from 'next/link';

import { statusToTone } from '@/components/crm/status-pill';
import { fmtDate, type ProjectRow } from './projects-table';

export function ProjectsGantt({ rows }: { rows: ProjectRow[] }) {
  const withDates = React.useMemo(
    () =>
      rows.filter((r) => {
        const s = r.startDate;
        const e = r.deadline ?? r.endDate;
        if (!s || !e) return false;
        const sd = new Date(s as string | Date);
        const ed = new Date(e as string | Date);
        return !Number.isNaN(sd.getTime()) && !Number.isNaN(ed.getTime());
      }),
    [rows],
  );

  const { min, max, span } = React.useMemo(() => {
    if (withDates.length === 0) return { min: 0, max: 0, span: 1 };
    let mn = Number.POSITIVE_INFINITY;
    let mx = Number.NEGATIVE_INFINITY;
    for (const r of withDates) {
      const s = new Date(r.startDate as string | Date).getTime();
      const e = new Date((r.deadline ?? r.endDate) as string | Date).getTime();
      if (s < mn) mn = s;
      if (e > mx) mx = e;
    }
    return { min: mn, max: mx, span: Math.max(1, mx - mn) };
  }, [withDates]);

  if (withDates.length === 0) {
    return (
      <Card className="p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
        No projects have both a start date and a deadline — set dates to see a
        timeline view.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-4">
      <div className="mb-3 flex items-center justify-between text-[11.5px] text-[var(--st-text-secondary)]">
        <span>{new Date(min).toLocaleDateString()}</span>
        <span>{new Date(max).toLocaleDateString()}</span>
      </div>
      <div className="flex flex-col gap-2">
        {withDates.map((p) => {
          const s = new Date(p.startDate as string | Date).getTime();
          const e = new Date((p.deadline ?? p.endDate) as string | Date).getTime();
          const left = ((s - min) / span) * 100;
          const width = Math.max(2, ((e - s) / span) * 100);
          const tone = statusToTone(p.status || '');
          const colorClass =
            tone === 'green'
              ? 'bg-[var(--st-text)]'
              : tone === 'amber'
                ? 'bg-[var(--st-text)]'
                : tone === 'red'
                  ? 'bg-[var(--st-text)]'
                  : tone === 'blue'
                    ? 'bg-[var(--st-text)]'
                    : 'bg-[var(--st-text-secondary)]';
          return (
            <div key={p._id} className="flex items-center gap-3">
              <Link
                href={`/dashboard/crm/projects/${p._id}`}
                className="w-44 shrink-0 truncate text-[12.5px] text-[var(--st-text)] hover:underline"
                title={p.name}
              >
                {p.name}
              </Link>
              <div className="relative h-5 flex-1 rounded bg-[var(--st-bg-muted)]">
                <div
                  className={`absolute top-0 h-5 rounded ${colorClass}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${fmtDate(p.startDate)} → ${fmtDate(p.deadline ?? p.endDate)}`}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
                {Number(p.completionPercent ?? p.progress ?? 0)}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
