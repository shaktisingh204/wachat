export const dynamic = 'force-dynamic';

import { Target } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  StatCard,
  BarRow,
  fmtMoney,
} from '../_components/report-toolbar';
import { getDealFunnel } from '@/app/actions/worksuite/reports.actions';

export default async function SalesDealsReportPage() {
  const rows = await getDealFunnel();

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Sales Deals"
        subtitle="Deal conversion funnel by stage."
        icon={Target}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Deals" value={String(totalCount)} />
        <StatCard label="Pipeline value" value={fmtMoney(totalValue)} tone="green" />
        <StatCard label="Stages" value={String(rows.length)} />
      </div>

      <ClayCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-clay-ink">By stage</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-clay-ink-muted">
            No deals.
          </div>
        ) : (
          rows.map((r) => (
            <BarRow
              key={r.stage}
              label={`${r.stage} — ${fmtMoney(r.value)}`}
              value={r.count}
              max={maxCount}
              rightLabel={`${r.count}`}
              tone="obsidian"
            />
          ))
        )}
      </ClayCard>
    </div>
  );
}
