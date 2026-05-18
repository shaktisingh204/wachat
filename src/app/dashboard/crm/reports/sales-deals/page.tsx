import { ZoruCard } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
    <EntityListShell title="Sales Deals" subtitle="Deal conversion funnel by stage.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Deals" value={String(totalCount)} />
        <StatCard label="Pipeline value" value={fmtMoney(totalValue)} tone="green" />
        <StatCard label="Stages" value={String(rows.length)} />
      </div>

      <ZoruCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">By stage</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
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
      </ZoruCard>
    </EntityListShell>
  );
}
