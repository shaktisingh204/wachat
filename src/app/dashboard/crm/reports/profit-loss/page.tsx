import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ReportToolbar,
  StatCard,
  fmtMoney,
} from '../_components/report-toolbar';
import { getProfitLoss } from '@/app/actions/worksuite/reports.actions';

export default async function ProfitLossPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getProfitLoss(sp.from, sp.to, 'month');

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expense: acc.expense + r.expense,
      profit: acc.profit + r.profit,
    }),
    { income: 0, expense: 0, profit: 0 },
  );

  return (
    <EntityListShell
      title="Profit & Loss"
      subtitle="Income minus expenses by month."
      primaryAction={<ReportToolbar from={sp.from} to={sp.to} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Income" value={fmtMoney(totals.income)} tone="green" />
        <StatCard label="Expense" value={fmtMoney(totals.expense)} tone="red" />
        <StatCard
          label="Net profit"
          value={fmtMoney(totals.profit)}
          tone={totals.profit >= 0 ? 'green' : 'red'}
        />
      </div>

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Income
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Expense
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Profit
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={4}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No data.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r) => (
                  <ZoruTableRow key={r.period} className="border-zoru-line">
                    <ZoruTableCell className="font-medium text-zoru-ink">
                      {r.period}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-success-ink">
                      {fmtMoney(r.income)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-danger-ink">
                      {fmtMoney(r.expense)}
                    </ZoruTableCell>
                    <ZoruTableCell
                      className={`text-right text-[13px] font-medium ${
                        r.profit >= 0 ? 'text-zoru-success-ink' : 'text-zoru-danger-ink'
                      }`}
                    >
                      {fmtMoney(r.profit)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
