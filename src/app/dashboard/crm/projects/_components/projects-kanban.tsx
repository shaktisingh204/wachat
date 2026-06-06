'use client';

import { Badge } from '@/components/sabcrm/20ui/compat';
import * as React from 'react';
import Link from 'next/link';

import {
  fmtDate,
  fmtMoney,
  type ProjectRow,
} from './projects-table';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'not started', label: 'Not Started' },
  { value: 'in progress', label: 'In Progress' },
  { value: 'on hold', label: 'On Hold' },
  { value: 'finished', label: 'Finished' },
  { value: 'canceled', label: 'Canceled' },
];

export function ProjectsKanban({ rows }: { rows: ProjectRow[] }) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, ProjectRow[]>();
    for (const o of STATUS_OPTIONS) map.set(o.value, []);
    for (const r of rows) {
      const k = (r.status || 'not started').toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }, [rows]);

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-3">
      {STATUS_OPTIONS.map((stage) => {
        const cards = grouped.get(stage.value) ?? [];
        return (
          <div
            key={stage.value}
            className="flex w-[280px] shrink-0 flex-col gap-2"
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[12px] font-medium uppercase tracking-wider text-zoru-ink-muted">
                {stage.label}
              </span>
              <Badge variant="secondary">{cards.length}</Badge>
            </header>
            <div className="flex flex-col gap-2">
              {cards.map((p) => (
                <Link
                  key={p._id}
                  href={`/dashboard/crm/projects/${p._id}`}
                  className="block rounded-md border border-zoru-line bg-zoru-surface p-3 text-[13px] transition hover:border-zoru-primary"
                >
                  <p className="font-medium text-zoru-ink">{p.name}</p>
                  {p.clientName ? (
                    <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                      {p.clientName}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-zoru-ink-muted">
                    <span>
                      {fmtMoney(
                        Number(p.projectBudget ?? p.budget) || null,
                        p.currency ?? 'INR',
                      )}
                    </span>
                    <span>{fmtDate(p.deadline ?? p.endDate)}</span>
                  </div>
                </Link>
              ))}
              {cards.length === 0 ? (
                <p className="rounded-md border border-dashed border-zoru-line p-3 text-center text-[11.5px] text-zoru-ink-muted">
                  No projects
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
