import { fmtDate } from '@/lib/utils';
import { HrDetailPage } from '../../_components/hr-detail-page';
import { getOneOnOnes, deleteOneOnOne } from '@/app/actions/hr.actions';
import type { HrOneOnOne } from '@/lib/hr-types';

type Row = HrOneOnOne & {
  _id: string;
  scheduled_date?: string | Date;
  managerName?: string;
  manager_id?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  meetingLink?: string;
  location?: string;
  actionItems?: string;
  mood?: string;
  discussionPoints?: string;
};

export default async function OneOnOneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getOneOnOnes()) as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-zoru-ink-muted">1:1 not found.</div>;

  const scheduled = row.scheduled_date ?? row.scheduledAt;
  const duration = row.duration_minutes ?? row.durationMinutes;
  const actionItems = (row.actionItems ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <HrDetailPage
      title={`1:1 · ${row.managerName ?? row.manager_id ?? 'Manager'}`}
      eyebrow="1-ON-1"
      status={{ label: String(row.status ?? 'scheduled') }}
      listHref="/dashboard/hrm/hr/one-on-ones"
      listLabel="Back to 1:1s"
      editHref={`/dashboard/hrm/hr/one-on-ones/${id}/edit`}
      deleteAction={deleteOneOnOne}
      entityId={id}
      sections={[
        {
          title: 'Meeting',
          fields: [
            { label: 'Manager', value: row.managerName ?? row.manager_id },
            { label: 'Employee', value: String(row.employeeId ?? '—') },
            {
              label: 'Scheduled',
              value: scheduled ? fmtDate(scheduled, true) : null,
            },
            {
              label: 'Duration',
              value: duration ? `${duration} minutes` : null,
            },
            { label: 'Mood', value: row.mood },
            { label: 'Meeting link', value: row.meetingLink },
            { label: 'Location', value: row.location },
          ],
        },
        {
          title: 'Discussion',
          fields: [
            { label: 'Agenda', value: row.agenda, fullWidth: true },
            { label: 'Notes', value: row.notes, fullWidth: true },
            { label: 'Discussion points', value: row.discussionPoints, fullWidth: true },
          ],
        },
        {
          title: `Action items (${actionItems.length})`,
          fields:
            actionItems.length > 0
              ? actionItems.map((item, i) => ({
                  label: `#${i + 1}`,
                  value: (
                    <label className="inline-flex items-start gap-2">
                      <input
                        type="checkbox"
                        disabled
                        className="mt-1 h-3.5 w-3.5"
                      />
                      <span>{item}</span>
                    </label>
                  ),
                  fullWidth: true,
                }))
              : [{ label: '—', value: 'No action items recorded.', fullWidth: true }],
        },
      ]}
    />
  );
}
