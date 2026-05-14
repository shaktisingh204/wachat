'use client';

import * as React from 'react';
import { use } from 'react';

import { HrDetailPage } from '../../_components/hr-detail-page';
import { getFeedback360, deleteFeedback360 } from '@/app/actions/hr.actions';
import type { HrFeedback360 } from '@/lib/hr-types';
import { ZoruSkeleton } from '@/components/zoruui';

type Row = HrFeedback360 & {
  _id: string;
  reviewer_id?: string;
  reviewee_id?: string;
  type?: string;
  period?: string;
  status?: string;
  submitted_at?: string | Date;
  feedback?: string;
  rating_communication?: number;
  rating_teamwork?: number;
  rating_leadership?: number;
  rating_technical?: number;
};

export default function Feedback360DetailPage({
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
        const list = (await getFeedback360()) as Row[];
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
  if (!row) return <div className="text-sm text-zoru-ink-muted">Review not found.</div>;

  return (
    <HrDetailPage
      title={`360° Feedback · ${row.reviewee_id ?? row.employeeId ?? ''}`}
      eyebrow="360° FEEDBACK"
      status={{ label: String(row.status ?? 'pending') }}
      listHref="/dashboard/hrm/hr/feedback-360"
      listLabel="Back to feedback"
      editHref={`/dashboard/hrm/hr/feedback-360/${id}/edit`}
      deleteAction={deleteFeedback360}
      entityId={id}
      sections={[
        {
          title: 'Participants',
          fields: [
            { label: 'Reviewer', value: row.reviewer_id ?? row.reviewerName },
            { label: 'Reviewee', value: row.reviewee_id ?? String(row.employeeId ?? '—') },
            { label: 'Type', value: row.type ?? row.reviewerType },
            { label: 'Period', value: row.period },
            { label: 'Status', value: row.status },
            {
              label: 'Submitted',
              value: row.submitted_at
                ? new Date(row.submitted_at).toLocaleDateString()
                : row.submittedAt
                  ? new Date(row.submittedAt).toLocaleDateString()
                  : null,
            },
          ],
        },
        {
          title: 'Ratings',
          fields: [
            { label: 'Communication', value: row.rating_communication ?? '—' },
            { label: 'Teamwork', value: row.rating_teamwork ?? '—' },
            { label: 'Leadership', value: row.rating_leadership ?? '—' },
            { label: 'Technical', value: row.rating_technical ?? '—' },
            { label: 'Overall', value: row.rating ?? '—' },
          ],
        },
        {
          title: 'Qualitative',
          fields: [
            { label: 'Feedback', value: row.feedback, fullWidth: true },
            { label: 'Strengths', value: row.strengths, fullWidth: true },
            { label: 'Improvements', value: row.improvements, fullWidth: true },
          ],
        },
      ]}
    />
  );
}
