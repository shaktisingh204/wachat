'use client';

/**
 * Surveys — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Active · Completed · Avg response rate · Total responses.
 * Server actions preserved: getSurveys / deleteSurvey.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Gauge } from 'lucide-react';

import { getSurveys, deleteSurvey } from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';

import {
  HrChip,
  HrDateCell,
  HrListShell,
  HrStatusCell,
} from '../_components/hr-list-shell';

type Row = HrSurvey & {
  _id: string;
  type?: string;
  target?: string;
  anonymous?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  deadline?: string | Date;
  targetCount?: number;
};

export default function SurveysPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getSurveys()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'active' || String(r.status ?? '').toLowerCase() === 'open',
    ).length;
    const closed = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'closed',
    ).length;
    let responses = 0;
    let rateSum = 0;
    let rateN = 0;
    for (const r of rows) {
      const got = Number(r.responsesCount) || 0;
      responses += got;
      const target = Number(r.targetCount) || 0;
      if (target > 0) {
        rateSum += got / target;
        rateN += 1;
      }
    }
    const avgRate = rateN ? Math.round((rateSum / rateN) * 100) : 0;
    return [
      { label: 'Total', value: total },
      { label: 'Active', value: active, tone: 'green' as const },
      { label: 'Closed', value: closed, tone: 'red' as const },
      { label: 'Avg response rate', value: `${avgRate}%`, hint: 'Across targeted surveys' },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="Surveys"
      subtitle="Pulse, engagement, exit, and onboarding surveys."
      icon={Gauge}
      newHref="/dashboard/hrm/hr/surveys/new"
      editHref={(r) => `/dashboard/hrm/hr/surveys/${r._id}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/surveys/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'draft', label: 'Draft' },
        { value: 'active', label: 'Active' },
        { value: 'closed', label: 'Closed' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search surveys…"
      searchPredicate={(r, q) =>
        String(r.title ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteSurvey}
      onAfterChange={refresh}
      emptyText="No surveys yet"
      columns={[
        {
          key: 'title',
          label: 'Title',
          render: (r) => (
            <span className="block max-w-[260px] truncate font-medium">{r.title}</span>
          ),
        },
        {
          key: 'type',
          label: 'Type',
          render: (r) => (r.type ? <HrChip>{r.type}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>),
        },
        {
          key: 'audience',
          label: 'Audience',
          render: (r) => (r.target ? <HrChip>{r.target}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>),
        },
        {
          key: 'questions',
          label: 'Qs',
          render: (r) => (
            <span className="tabular-nums">{Array.isArray(r.questions) ? r.questions.length : 0}</span>
          ),
        },
        {
          key: 'responses',
          label: 'Responses',
          render: (r) => {
            const got = Number(r.responsesCount) || 0;
            const target = Number(r.targetCount) || 0;
            const pct = target ? Math.round((got / target) * 100) : null;
            return (
              <span className="tabular-nums text-[var(--st-text)]">
                {got}
                {target ? <span className="text-[var(--st-text-secondary)]"> / {target}</span> : null}
                {pct !== null ? (
                  <span className="ml-1 text-[11px] text-[var(--st-text-secondary)]">({pct}%)</span>
                ) : null}
              </span>
            );
          },
        },
        {
          key: 'deadline',
          label: 'Deadline',
          render: (r) => <HrDateCell value={r.deadline ?? r.endDate} />,
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => <HrStatusCell value={String(r.status ?? '')} />,
        },
      ]}
    />
  );
}
