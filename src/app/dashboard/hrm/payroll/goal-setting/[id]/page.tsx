import type { WithId } from 'mongodb';

import { HrDetailPage } from '../../../hr/_components/hr-detail-page';
import { HrProgressCell } from '../../../hr/_components/hr-list-shell';
import { getCrmGoals, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import type { CrmGoal } from '@/lib/definitions';

type GoalRow = WithId<CrmGoal> & {
  assigneeInfo?: { firstName?: string; lastName?: string };
  cycle?: string;
  weight?: number;
  priority?: string;
  milestones?: { title: string; targetDate?: string; status?: string }[];
};

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getCrmGoals()) as GoalRow[];
  const goal = list.find((r) => String(r._id) === id) ?? null;

  if (!goal) {
    return (
      <div className="text-sm text-[var(--st-text-secondary)]">Goal not found.</div>
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
