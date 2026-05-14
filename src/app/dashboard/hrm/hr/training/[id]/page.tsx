'use client';

import * as React from 'react';
import { use } from 'react';

import { HrDetailPage } from '../../_components/hr-detail-page';
import {
  getTrainingPrograms,
  deleteTrainingProgram,
} from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';
import { ZoruSkeleton } from '@/components/zoruui';

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

export default function TrainingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [row, setRow] = React.useState<Row | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getTrainingPrograms()) as Row[];
        if (!active) return;
        setRow(list.find((r) => String(r._id) === id) ?? null);
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
      auditKind="hr_training_programs"
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
              value: row.startDate ? new Date(row.startDate).toLocaleDateString() : null,
            },
            {
              label: 'End',
              value: row.endDate ? new Date(row.endDate).toLocaleDateString() : null,
            },
            { label: 'Duration (hours)', value: row.durationHours },
            {
              label: 'Registration deadline',
              value: row.registrationDeadline
                ? new Date(row.registrationDeadline).toLocaleDateString()
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
                  ? `${row.currency ?? ''} ${row.costPerParticipant}`.trim()
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
