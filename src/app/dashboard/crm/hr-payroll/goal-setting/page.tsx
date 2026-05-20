'use client';

/**
 * Goals — list page rebuilt to §1D.1 bar.
 *
 * Composition:
 *   <HrListShell>
 *     • KPI strip — Active · Completed · Overdue · On-track %
 *     • Status filter chips + search
 *     • Columns: employee · title · progress · target date · status
 *     • Bulk select + delete
 *
 * Form lives at /new and /[id]/edit (HrFormPage on top of EntityFormShell).
 * Server action key is `saveCrmGoal`; every FormData key it reads is preserved.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Target } from 'lucide-react';
import type { WithId } from 'mongodb';

import { getCrmGoals, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import type { CrmGoal } from '@/lib/definitions';

import {
  HrChip,
  HrDateCell,
  HrListShell,
  HrProgressCell,
  HrStatusCell,
  type HrExportColumn,
} from '../../hr/_components/hr-list-shell';

type Row = WithId<CrmGoal> & {
  assigneeInfo?: { firstName?: string; lastName?: string };
};

export default function GoalSettingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getCrmGoals()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const EXPORT_COLS: HrExportColumn<Row>[] = [
    { label: 'Employee', value: (r) => r.assigneeInfo ? `${r.assigneeInfo.firstName ?? ''} ${r.assigneeInfo.lastName ?? ''}`.trim() : '' },
    { label: 'Title', value: (r) => r.title ?? '' },
    { label: 'Status', value: (r) => r.status ?? '' },
    { label: 'Progress %', value: (r) => r.progress ?? 0 },
    { label: 'Target Date', value: (r) => r.targetDate ? new Date(r.targetDate).toISOString().slice(0, 10) : '' },
  ];

  const today = new Date();
  const kpis = React.useMemo(() => {
    const total = rows.length;
    const completed = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'completed',
    ).length;
    const active = rows.filter((r) => {
      const s = String(r.status ?? '').toLowerCase();
      return s === 'in-progress' || s === 'not-started' || s === '';
    }).length;
    const overdue = rows.filter((r) => {
      const status = String(r.status ?? '').toLowerCase();
      const isOpen = status !== 'completed' && status !== 'cancelled';
      if (!isOpen) return false;
      if (!r.targetDate) return false;
      return new Date(r.targetDate).getTime() < today.getTime();
    }).length;
    const onTrackCount = rows.filter((r) => {
      const status = String(r.status ?? '').toLowerCase();
      if (status === 'completed') return true;
      const p = Number(r.progress ?? 0);
      return p >= 50;
    }).length;
    const onTrackPct = total ? Math.round((onTrackCount / total) * 100) : 0;
    return [
      { label: 'Active', value: active, hint: 'Not yet completed' },
      { label: 'Completed', value: completed, tone: 'green' as const },
      { label: 'Overdue', value: overdue, tone: 'red' as const, hint: 'Past target date' },
      { label: 'On track %', value: `${onTrackPct}%`, hint: '≥ 50% progress or done' },
    ];
  }, [rows, today]);

  return (
    <HrListShell<Row>
      title="Goals"
      subtitle="KPI-driven goals — assign, track progress, and review outcomes per cycle."
      icon={Target}
      newHref="/dashboard/crm/hr-payroll/goal-setting/new"
      editHref={(row) => `/dashboard/crm/hr-payroll/goal-setting/${String(row._id)}/edit`}
      detailHref={(row) => `/dashboard/crm/hr-payroll/goal-setting/${String(row._id)}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'in-progress', label: 'In progress' },
        { value: 'not-started', label: 'Not started' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search goals…"
      searchPredicate={(r, q) =>
        String(r.title ?? '').toLowerCase().includes(q) ||
        String(r.description ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteCrmGoal}
      onAfterChange={refresh}
      exportColumns={EXPORT_COLS}
      exportBaseName="goal-setting"
      emptyText="No goals yet"
      columns={[
        {
          key: 'employee',
          label: 'Employee',
          render: (r) =>
            r.assigneeInfo
              ? `${r.assigneeInfo.firstName ?? ''} ${r.assigneeInfo.lastName ?? ''}`.trim() || '—'
              : '—',
        },
        {
          key: 'title',
          label: 'Title',
          render: (r) => (
            <span className="block max-w-[260px] truncate font-medium">{r.title}</span>
          ),
        },
        {
          key: 'cycle',
          label: 'Cycle',
          render: (r) => {
            const cycle = (r as unknown as { cycle?: string }).cycle;
            return cycle ? <HrChip>{cycle}</HrChip> : <span className="text-zoru-ink-muted">—</span>;
          },
        },
        {
          key: 'progress',
          label: 'Progress',
          render: (r) => <HrProgressCell value={r.progress} />,
        },
        {
          key: 'targetDate',
          label: 'Target',
          render: (r) => <HrDateCell value={r.targetDate} />,
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
