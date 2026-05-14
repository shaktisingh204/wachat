'use client';

import * as React from 'react';
import { use } from 'react';
import type { WithId } from 'mongodb';

import { HrDetailPage } from '../../../hr/_components/hr-detail-page';
import { HrProgressCell } from '../../../hr/_components/hr-list-shell';
import { getCrmGoals, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import type { CrmGoal } from '@/lib/definitions';
import { ZoruSkeleton } from '@/components/zoruui';

type GoalRow = WithId<CrmGoal> & {
  assigneeInfo?: { firstName?: string; lastName?: string };
  cycle?: string;
  weight?: number;
  priority?: string;
  milestones?: { title: string; targetDate?: string; status?: string }[];
};

export default function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [goal, setGoal] = React.useState<GoalRow | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getCrmGoals()) as GoalRow[];
        if (!active) return;
        setGoal(list.find((r) => String(r._id) === id) ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4">
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-sm text-zoru-ink-muted">Goal not found.</div>
    );
  }

  const employee = goal.assigneeInfo
    ? `${goal.assigneeInfo.firstName ?? ''} ${goal.assigneeInfo.lastName ?? ''}`.trim()
    : '—';

  return (
    <HrDetailPage
      title={goal.title || 'Goal'}
      eyebrow="GOAL"
      status={{ label: String(goal.status ?? 'unknown') }}
      listHref="/dashboard/hrm/payroll/goal-setting"
      listLabel="Back to goals"
      editHref={`/dashboard/hrm/payroll/goal-setting/${id}/edit`}
      deleteAction={deleteCrmGoal}
      entityId={id}
      auditKind="crm_goals"
      sections={[
        {
          title: 'Overview',
          fields: [
            { label: 'Employee', value: employee },
            { label: 'Cycle', value: goal.cycle },
            { label: 'Weight', value: goal.weight ? `${goal.weight}%` : null },
            { label: 'Priority', value: goal.priority },
            {
              label: 'Target date',
              value: goal.targetDate
                ? new Date(goal.targetDate).toLocaleDateString()
                : null,
            },
            { label: 'Status', value: goal.status },
            {
              label: 'Description',
              value: goal.description,
              fullWidth: true,
            },
            {
              label: 'Progress',
              value: <HrProgressCell value={goal.progress} />,
              fullWidth: true,
            },
          ],
        },
        ...(goal.milestones && goal.milestones.length > 0
          ? [
              {
                title: 'Milestones',
                fields: goal.milestones.map((m) => ({
                  label: m.title || 'Milestone',
                  value: `${m.status ?? 'pending'}${m.targetDate ? ` — due ${new Date(m.targetDate).toLocaleDateString()}` : ''}`,
                })),
              },
            ]
          : []),
      ]}
    />
  );
}
