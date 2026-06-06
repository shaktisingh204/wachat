import { fmtDate } from '@/lib/utils';
import { HrDetailPage } from '../../_components/hr-detail-page';
import { getSurveys, deleteSurvey } from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';

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

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getSurveys()) as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-[var(--st-text-secondary)]">Survey not found.</div>;

  const questions = (row.questions ?? []) as { prompt: string; type: string; required?: string }[];
  const got = Number(row.responsesCount) || 0;
  const target = Number(row.targetCount) || 0;

  return (
    <HrDetailPage
      title={row.title || 'Survey'}
      eyebrow="SURVEY"
      status={{ label: String(row.status ?? 'draft') }}
      listHref="/dashboard/hrm/hr/surveys"
      listLabel="Back to surveys"
      editHref={`/dashboard/hrm/hr/surveys/${id}/edit`}
      deleteAction={deleteSurvey}
      entityId={id}
      sections={[
        {
          title: 'Survey',
          fields: [
            { label: 'Type', value: row.type },
            { label: 'Audience', value: row.target },
            { label: 'Anonymous', value: row.anonymous === 'yes' ? 'Yes' : 'No' },
            { label: 'Status', value: row.status },
            { label: 'Description', value: row.description, fullWidth: true },
          ],
        },
        {
          title: 'Schedule & responses',
          fields: [
            {
              label: 'Start date',
              value: row.startDate ? fmtDate(row.startDate) : null,
            },
            {
              label: 'End date',
              value: row.endDate ? fmtDate(row.endDate) : null,
            },
            {
              label: 'Deadline',
              value: row.deadline ? fmtDate(row.deadline) : null,
            },
            {
              label: 'Responses',
              value: target
                ? `${got} / ${target} (${Math.round((got / target) * 100)}%)`
                : String(got),
            },
          ],
        },
        {
          title: `Questions (${questions.length})`,
          fields:
            questions.length > 0
              ? questions.map((q, i) => ({
                  label: `Q${i + 1}`,
                  value: (
                    <div>
                      <p className="text-sm text-[var(--st-text)]">{q.prompt}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        {q.type}
                        {q.required === 'yes' ? ' · required' : ''}
                      </p>
                    </div>
                  ),
                  fullWidth: true,
                }))
              : [{ label: '—', value: 'No questions configured yet.', fullWidth: true }],
        },
      ]}
    />
  );
}
