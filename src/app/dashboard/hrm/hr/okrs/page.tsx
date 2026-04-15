'use client';

import { Target } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import { getOkrs, saveOkr, deleteOkr } from '@/app/actions/hr.actions';
import type { HrOkr } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  'on-track': 'green',
  'at-risk': 'amber',
  'off-track': 'red',
  completed: 'blue',
  // legacy
  draft: 'neutral',
  'in-progress': 'blue',
  achieved: 'green',
  missed: 'red',
};

function ProgressBar({ value }: { value: unknown }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-clay-border">
        <div
          className="h-full rounded-full bg-clay-amber"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] tabular-nums text-clay-ink-muted">{pct}%</span>
    </div>
  );
}

export default function OkrsPage() {
  return (
    <HrEntityPage<HrOkr & { _id: string }>
      title="OKRs"
      subtitle="Objectives and key results — track individual, team, and company goals."
      icon={Target}
      singular="OKR"
      basePath="/dashboard/hrm/hr/okrs"
      getAllAction={getOkrs as any}
      saveAction={saveOkr}
      deleteAction={deleteOkr}
      columns={[
        {
          key: 'title',
          label: 'Title',
          render: (row) => (
            <span className="block max-w-[220px] truncate font-medium">
              {(row as any).title || (row as any).objective || '—'}
            </span>
          ),
        },
        {
          key: 'type',
          label: 'Type',
          render: (row) => {
            const t = (row as any).type;
            return t ? (
              <ClayBadge tone={t === 'company' ? 'blue' : t === 'team' ? 'amber' : 'neutral'}>
                {t}
              </ClayBadge>
            ) : (
              <span className="text-clay-ink-muted">—</span>
            );
          },
        },
        {
          key: 'due_date',
          label: 'Due Date',
          render: (row) => {
            const d = (row as any).due_date;
            if (!d) return <span className="text-clay-ink-muted">—</span>;
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? '—' : parsed.toISOString().slice(0, 10);
          },
        },
        {
          key: 'progress',
          label: 'Progress',
          render: (row) => <ProgressBar value={(row as any).progress} />,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
