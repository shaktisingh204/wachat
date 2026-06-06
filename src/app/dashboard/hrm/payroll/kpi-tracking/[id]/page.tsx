import type { WithId } from 'mongodb';

import { HrDetailPage } from '../../../hr/_components/hr-detail-page';
import {
  getCrmKpis,
  deleteCrmKpi,
  type CrmKpi,
} from '@/app/actions/crm-hr-appraisals.actions';

export default async function KpiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getCrmKpis()) as WithId<CrmKpi>[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-[var(--st-text-secondary)]">KPI not found.</div>;

  const achievement =
    row.target_value > 0
      ? Math.round((row.actual_value / row.target_value) * 100)
      : 0;

  return (
    <HrDetailPage
      title={row.kpi_name}
      eyebrow="KPI"
      status={{ label: String(row.status ?? 'on-track') }}
      listHref="/dashboard/hrm/payroll/kpi-tracking"
      listLabel="Back to KPIs"
      editHref={`/dashboard/hrm/payroll/kpi-tracking/${id}/edit`}
      deleteAction={deleteCrmKpi}
      entityId={id}
      sections={[
        {
          title: 'Definition',
          fields: [
            { label: 'Employee', value: row.employee_id },
            { label: 'Period', value: row.period },
            { label: 'Unit', value: row.unit },
          ],
        },
        {
          title: 'Performance',
          fields: [
            {
              label: 'Target',
              value: `${row.target_value} ${row.unit ?? ''}`.trim(),
            },
            {
              label: 'Actual',
              value: `${row.actual_value} ${row.unit ?? ''}`.trim(),
            },
            { label: 'Achievement', value: `${achievement}%` },
            { label: 'Status', value: row.status },
          ],
        },
      ]}
    />
  );
}
