'use client';

import * as React from 'react';
import { use } from 'react';

import { HrDetailPage } from '../../../hr/_components/hr-detail-page';
import {
  getCrmKpis,
  deleteCrmKpi,
  type CrmKpi,
} from '@/app/actions/crm-hr-appraisals.actions';
import type { WithId } from 'mongodb';
import { ZoruSkeleton } from '@/components/zoruui';

export default function KpiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [row, setRow] = React.useState<WithId<CrmKpi> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getCrmKpis()) as WithId<CrmKpi>[];
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
  if (!row) return <div className="text-sm text-zoru-ink-muted">KPI not found.</div>;

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
      auditKind="crm_kpis"
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
