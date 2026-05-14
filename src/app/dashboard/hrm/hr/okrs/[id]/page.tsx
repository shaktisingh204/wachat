import { HrDetailPage } from '../../_components/hr-detail-page';
import { HrProgressCell } from '../../_components/hr-list-shell';
import { getOkrs, deleteOkr } from '@/app/actions/hr.actions';
import type { HrOkr } from '@/lib/hr-types';

type Row = HrOkr & {
  _id: string;
  title?: string;
  type?: string;
  due_date?: string | Date;
  progress?: number;
};

export default async function OkrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getOkrs()) as Row[];
  const okr = list.find((r) => String(r._id) === id) ?? null;

  if (!okr) {
    return <div className="text-sm text-zoru-ink-muted">OKR not found.</div>;
  }

  const krs = (okr.keyResults ?? []) as { description: string; progress?: number; target?: string; status?: string }[];

  return (
    <HrDetailPage
      title={okr.title ?? okr.objective ?? 'OKR'}
      eyebrow="OKR"
      status={{ label: String(okr.status ?? 'unknown') }}
      listHref="/dashboard/hrm/hr/okrs"
      listLabel="Back to OKRs"
      editHref={`/dashboard/hrm/hr/okrs/${id}/edit`}
      deleteAction={deleteOkr}
      entityId={id}
      sections={[
        {
          title: 'Overview',
          fields: [
            { label: 'Period', value: okr.quarter },
            { label: 'Type', value: okr.type },
            { label: 'Status', value: okr.status },
            {
              label: 'Due date',
              value: okr.due_date ? new Date(okr.due_date).toLocaleDateString() : null,
            },
            {
              label: 'Overall progress',
              value: <HrProgressCell value={okr.progress} />,
              fullWidth: true,
            },
          ],
        },
        {
          title: `Key results (${krs.length})`,
          fields:
            krs.length > 0
              ? krs.map((kr, i) => ({
                  label: `KR-${i + 1}: ${kr.description ?? '—'}`,
                  value: (
                    <div className="space-y-1">
                      <HrProgressCell value={kr.progress} />
                      <p className="text-xs text-zoru-ink-muted">
                        Target: {kr.target ?? '—'} · Status: {kr.status ?? '—'}
                      </p>
                    </div>
                  ),
                  fullWidth: true,
                }))
              : [{ label: 'No key results', value: '—', fullWidth: true }],
        },
      ]}
    />
  );
}
