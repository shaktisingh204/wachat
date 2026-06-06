import { Star } from 'lucide-react';

import { HrDetailPage } from '../../../hr/_components/hr-detail-page';
import {
  getCrmAppraisalReviews,
  deleteCrmAppraisalReview,
} from '@/app/actions/crm-hr-appraisals.actions';

type Row = {
  _id: string;
  employeeId?: string;
  reviewerId?: string;
  reviewDate?: string | Date;
  status?: string;
  cycle?: string;
  strengths?: string;
  areasForImprovement?: string;
  reviewerComments?: string;
  employeeInfo?: { firstName?: string; lastName?: string };
  reviewerInfo?: { name?: string };
  ratings?: Record<string, number>;
};

function StarRow({ label, value }: { label: string; value?: number }) {
  const n = Math.round(Math.min(5, Math.max(0, value ?? 0)));
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i <= n ? 'fill-[var(--st-text-secondary)] text-[var(--st-text-secondary)]' : 'fill-transparent text-[var(--st-border)]'}`}
          />
        ))}
      </div>
      <span className="text-[12px] tabular-nums text-[var(--st-text-secondary)]">
        {value !== undefined && value !== null ? Number(value).toFixed(1) : '—'} · {label}
      </span>
    </div>
  );
}

export default async function AppraisalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getCrmAppraisalReviews()) as unknown as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-[var(--st-text-secondary)]">Review not found.</div>;

  const emp = row.employeeInfo
    ? `${row.employeeInfo.firstName ?? ''} ${row.employeeInfo.lastName ?? ''}`.trim()
    : '—';
  const ratings = row.ratings ?? {};
  const ratingPairs: { key: string; label: string }[] = [
    { key: 'qualityOfWork', label: 'Quality of work' },
    { key: 'communication', label: 'Communication' },
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'problemSolving', label: 'Problem solving' },
    { key: 'punctuality', label: 'Punctuality' },
  ];

  return (
    <HrDetailPage
      title={`Review · ${emp}`}
      eyebrow="APPRAISAL"
      status={{ label: String(row.status ?? 'Scheduled') }}
      listHref="/dashboard/hrm/payroll/appraisal-reviews"
      listLabel="Back to appraisals"
      editHref={`/dashboard/hrm/payroll/appraisal-reviews/${id}/edit`}
      deleteAction={deleteCrmAppraisalReview}
      entityId={id}
      sections={[
        {
          title: 'Participants',
          fields: [
            { label: 'Employee', value: emp },
            { label: 'Reviewer', value: row.reviewerInfo?.name },
            { label: 'Cycle', value: row.cycle },
            {
              label: 'Review date',
              value: row.reviewDate
                ? new Date(row.reviewDate).toLocaleDateString()
                : null,
            },
          ],
        },
        {
          title: 'Ratings',
          fields: ratingPairs.map(({ key, label }) => ({
            label,
            value: <StarRow label={label} value={ratings[key]} />,
          })),
        },
        {
          title: 'Qualitative',
          fields: [
            { label: 'Strengths', value: row.strengths, fullWidth: true },
            {
              label: 'Areas for improvement',
              value: row.areasForImprovement,
              fullWidth: true,
            },
            {
              label: 'Reviewer comments',
              value: row.reviewerComments,
              fullWidth: true,
            },
          ],
        },
      ]}
    />
  );
}
