export const dynamic = 'force-dynamic';

import {
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { ProfitLossStackedBar } from '../_components/finance-charts';
import { getProfitLossDeep } from '@/app/actions/worksuite/reports.actions';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function ProfitLossPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const anchor = sp.from || undefined;
  const { kpis, monthly, fyLabel } = await getProfitLossDeep(anchor);

  const pageRows = monthly.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < monthly.length;

  const exportHeaders = ['Period', 'Revenue', 'COGS', 'Expense', 'Profit'];
  const exportRows = monthly.map((r) => ({
    Period: r.period,
    Revenue: r.revenue,
    COGS: r.cogs,
    Expense: r.expense,
    Profit: r.profit,
  }));

  const marginTone: 'green' | 'red' | 'amber' = kpis.marginPct >= 20 ? 'green' : kpis.marginPct >= 0 ? 'amber' : 'red';
  const netTone: 'green' | 'red' = kpis.netProfit >= 0 ? 'green' : 'red';

  return (
    <EntityListShell
      title="Profit & Loss"
      subtitle={`Revenue − COGS − OpEx by month · ${fyLabel}`}
      primaryAction={
        <FyReportToolbar
          from={sp.from}
          to={sp.to}
          exportFilename="profit-loss"
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={monthly.length} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross profit" value={fmtMoney(kpis.grossProfit)} tone="green" hint="Revenue − COGS" />
        <StatCard label="Net profit" value={fmtMoney(kpis.netProfit)} tone={netTone} hint="GP − OpEx" />
        <StatCard label="Margin" value={fmtPct(kpis.marginPct)} tone={marginTone} hint="Net / Revenue" />
        <StatCard label="EBITDA" value={fmtMoney(kpis.ebitda)} tone="blue" hint="Net + D&A est." />
      </div>

      <ZoruCard className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-zoru-ink">Stacked monthly</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Revenue stacked separately from COGS + expenses; profit as a separate bar.
          </p>
        </div>
        {monthly.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No P&L data for this FY.</div>
        ) : (
          <ProfitLossStackedBar data={monthly} />
        )}
      </ZoruCard>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Revenue</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">COGS</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Expense</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Profit</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={5} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                    No data.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.period} className="border-zoru-line">
                    <ZoruTableCell className="font-medium text-zoru-ink">{r.period}</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-success-ink">
                      {fmtMoney(r.revenue)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                      {fmtMoney(r.cogs)}
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
