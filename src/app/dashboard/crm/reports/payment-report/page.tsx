import { ZoruCard } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ReportToolbar,
  StatCard,
  BarRow,
  fmtMoney,
} from '../_components/report-toolbar';
import { getPaymentsByGateway } from '@/app/actions/worksuite/reports.actions';

export default async function PaymentReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getPaymentsByGateway(sp.from, sp.to);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const count = rows.reduce((s, r) => s + r.count, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <EntityListShell
      title="Payment Report"
      subtitle="Payments received grouped by gateway / method."
      primaryAction={<ReportToolbar from={sp.from} to={sp.to} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total collected" value={fmtMoney(total)} tone="green" />
        <StatCard label="Payments" value={String(count)} />
        <StatCard label="Gateways" value={String(rows.length)} />
      </div>

      <ZoruCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">By gateway</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            No payments recorded.
          </div>
        ) : (
          rows.map((r) => (
            <BarRow
              key={r.gateway}
              label={`${r.gateway} (${r.count})`}
              value={r.total}
              max={max}
              rightLabel={fmtMoney(r.total)}
              tone="rose"
            />
          ))
        )}
      </ZoruCard>
    </EntityListShell>
  );
}
