'use client';

import * as React from 'react';
import { use } from 'react';

import { HrDetailPage } from '../../_components/hr-detail-page';
import { getSurveys, deleteSurvey } from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';
import { ZoruSkeleton } from '@/components/zoruui';

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

export default function SurveyDetailPage({
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
        const list = (await getSurveys()) as Row[];
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
  if (!row) return <div className="text-sm text-zoru-ink-muted">Survey not found.</div>;

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
      auditKind="hr_surveys"
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
              value: row.startDate ? new Date(row.startDate).toLocaleDateString() : null,
            },
            {
              label: 'End date',
              value: row.endDate ? new Date(row.endDate).toLocaleDateString() : null,
            },
            {
              label: 'Deadline',
              value: row.deadline ? new Date(row.deadline).toLocaleDateString() : null,
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
                      <p className="text-sm text-zoru-ink">{q.prompt}</p>
                      <p className="mt-0.5 text-[11px] text-zoru-ink-muted">
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
