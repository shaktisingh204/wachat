import { fmtDate, fmtINR } from '@/lib/utils';
import { Card } from '@/components/zoruui';
import {
  Award } from 'lucide-react';

import { HrDetailPage } from '../../_components/hr-detail-page';
import { getRecognitions,
  deleteRecognition } from '@/app/actions/hr.actions';
import type { HrRecognition } from '@/lib/hr-types';

type Row = HrRecognition & {
  _id: string;
  title?: string;
  fromEmail?: string;
  anonymous?: string;
  approvedBy?: string;
  linkedValue?: string;
  monetaryReward?: number;
  currency?: string;
};

export default async function RecognitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getRecognitions()) as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-zoru-ink-muted">Recognition not found.</div>;

  return (
    <HrDetailPage
      title={row.title || `${row.type} for ${String(row.employeeId ?? '')}`}
      eyebrow="RECOGNITION"
      status={{
        label: row.visibility ?? 'team',
        tone: row.visibility === 'public' ? 'green' : 'neutral',
      }}
      listHref="/dashboard/hrm/hr/recognition"
      listLabel="Back to recognition"
      editHref={`/dashboard/hrm/hr/recognition/${id}/edit`}
      deleteAction={deleteRecognition}
      entityId={id}
      rightRail={
        <Card className="p-4">
          <div className="flex items-center gap-2 text-zoru-ink">
            <Award className="h-5 w-5 text-zoru-warning-ink" />
            <span className="text-sm font-medium">Celebration card</span>
          </div>
          <div className="mt-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-amber-700">
              {row.type}
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-900">
              {row.points ? `${row.points} pts` : '—'}
            </p>
            {row.monetaryReward != null ? (
              <p className="mt-0.5 text-xs text-amber-800">
                {fmtINR(row.monetaryReward, row.currency)}
              </p>
            ) : null}
          </div>
        </Card>
      }
      sections={[
        {
          title: 'Recognition',
          fields: [
            { label: 'Recipient', value: String(row.employeeId ?? '—') },
            { label: 'Type', value: row.type },
            { label: 'Category', value: row.category },
            { label: 'Linked value', value: row.linkedValue },
            {
              label: 'Awarded',
              value: row.givenAt ? fmtDate(row.givenAt) : null,
            },
            { label: 'Message', value: row.message, fullWidth: true },
          ],
        },
        {
          title: 'Awarded by',
          fields: [
            { label: 'From', value: row.anonymous === 'yes' ? 'Anonymous' : row.fromName },
            { label: 'Email', value: row.anonymous === 'yes' ? '—' : row.fromEmail },
            { label: 'Approved by', value: row.approvedBy },
          ],
        },
      ]}
    />
  );
}
