export const dynamic = 'force-dynamic';
import { HrDetailPage } from '../../_components/hr-detail-page';
import { getFeedback360, deleteFeedback360 } from '@/app/actions/hr.actions';
import type { HrFeedback360 } from '@/lib/hr-types';
import { fmtDate } from '@/lib/utils';
import { FeedbackChart } from '../_components/feedback-chart';

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

export default async function Feedback360DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getFeedback360()) as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-[var(--st-text-secondary)]">Review not found.</div>;

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
              value: fmtDate(row.submitted_at || row.submittedAt),
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
            { 
              label: 'Visual Breakdown', 
              value: (
                <FeedbackChart 
                  communication={row.rating_communication}
                  teamwork={row.rating_teamwork}
                  leadership={row.rating_leadership}
                  technical={row.rating_technical}
                />
              ),
              fullWidth: true
            },
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
