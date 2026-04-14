export const dynamic = 'force-dynamic';

import { CreditCard } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Payment Report"
        subtitle="Payments received grouped by gateway / method."
        icon={CreditCard}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total collected" value={fmtMoney(total)} tone="green" />
        <StatCard label="Payments" value={String(count)} />
        <StatCard label="Gateways" value={String(rows.length)} />
      </div>

      <ClayCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-clay-ink">By gateway</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-clay-ink-muted">
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
      </ClayCard>
    </div>
  );
}
