import { fmtDate, fmtINR } from '@/lib/utils';
import { HrDetailPage } from '../../_components/hr-detail-page';
import {
  getTrainingPrograms,
  deleteTrainingProgram,
} from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';

type Row = HrTrainingProgram & {
  _id: string;
  format?: string;
  trainer?: string;
  trainerEmail?: string;
  durationHours?: number;
  maxParticipants?: number;
  venue?: string;
  meetingLink?: string;
  costPerParticipant?: number;
  currency?: string;
  registrationDeadline?: string | Date;
  materialsUrl?: string;
  feedbackFormUrl?: string;
};

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getTrainingPrograms()) as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-zoru-ink-muted">Program not found.</div>;

  return (
    <HrDetailPage
      title={row.name || 'Training program'}
      eyebrow="TRAINING"
      status={{ label: String(row.status ?? 'draft') }}
      listHref="/dashboard/hrm/hr/training"
      listLabel="Back to training"
      editHref={`/dashboard/hrm/hr/training/${id}/edit`}
      deleteAction={deleteTrainingProgram}
      entityId={id}
      sections={[
        {
          title: 'Overview',
          fields: [
            { label: 'Mode', value: row.format },
            { label: 'Trainer', value: row.trainer },
            { label: 'Trainer email', value: row.trainerEmail },
            { label: 'Status', value: row.status },
            { label: 'Description', value: row.description, fullWidth: true },
          ],
        },
        {
          title: 'Schedule',
          fields: [
            {
              label: 'Start',
              value: row.startDate ? fmtDate(row.startDate) : null,
            },
            {
              label: 'End',
              value: row.endDate ? fmtDate(row.endDate) : null,
            },
            { label: 'Duration (hours)', value: row.durationHours },
            {
              label: 'Registration deadline',
              value: row.registrationDeadline
                ? fmtDate(row.registrationDeadline)
                : null,
            },
            { label: 'Max participants', value: row.maxParticipants },
          ],
        },
        {
          title: 'Logistics & cost',
          fields: [
            { label: 'Venue', value: row.venue },
            { label: 'Meeting link', value: row.meetingLink },
            {
              label: 'Cost per participant',
              value:
                row.costPerParticipant != null
                  ? fmtINR(row.costPerParticipant, row.currency)
                  : null,
            },
            { label: 'Materials URL', value: row.materialsUrl },
            { label: 'Feedback form URL', value: row.feedbackFormUrl },
          ],
        },
      ]}
    />
  );
}
