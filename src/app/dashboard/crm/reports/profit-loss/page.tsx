export const dynamic = 'force-dynamic';

import {
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { ProfitLossStackedBar } from '../_components/finance-charts';
import { getProfitLossDeepDB } from '../_components/finance-data';
import { PlFilterToolbar } from './_components/pl-filter-toolbar';
import type { ProfitLossStackedRow } from '@/lib/worksuite/report-types';

const PAGE_SIZES = [10, 20, 50, 100];



export default async function ProfitLossPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    granularity?: string;
    department?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;
  const isQuarterly = (sp.granularity ?? 'monthly') === 'quarterly';

  const data = await getProfitLossDeepDB({
    fyAnchor: sp.from,
    granularity: sp.granularity ?? 'monthly',
    department: sp.department,
  });

  if (!data) return null;
  const { kpis, monthly, fyLabel } = data;

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

  const marginTone: 'green' | 'red' | 'amber' =
    kpis.marginPct >= 20 ? 'green' : kpis.marginPct >= 0 ? 'amber' : 'red';
  const netTone: 'green' | 'red' = kpis.netProfit >= 0 ? 'green' : 'red';

  return (
    <EntityListShell
      title="Profit & Loss"
      subtitle={`Revenue − COGS − OpEx by ${isQuarterly ? 'quarter' : 'month'} · ${fyLabel}`}
      primaryAction={
        <PlFilterToolbar
          from={sp.from}
          to={sp.to}
          granularity={sp.granularity ?? 'monthly'}
          department={sp.department ?? ''}
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={hasMore}
          total={monthly.length}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gross profit"
          value={fmtMoney(kpis.grossProfit)}
          tone="green"
          hint="Revenue - COGS"
        />
        <StatCard
          label="Net profit"
          value={fmtMoney(kpis.netProfit)}
          tone={netTone}
          hint="GP - OpEx"
        />
        <StatCard
          label="Margin"
          value={fmtPct(kpis.marginPct)}
          tone={marginTone}
          hint="Net / Revenue"
        />
        <StatCard
          label="EBITDA"
          value={fmtMoney(kpis.ebitda)}
          tone="blue"
          hint="Net + D&A est."
        />
      </div>

      <Card className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-zoru-ink">
            {isQuarterly ? 'Quarterly' : 'Monthly'} stacked
          </h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Revenue vs COGS + expenses; profit as a separate bar.
          </p>
        </div>
        {monthly.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-zoru-ink-muted">
            No P&L data for this FY.
          </div>
        ) : (
          <ProfitLossStackedBar data={monthly} />
        )}
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">
                  Period
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Revenue
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  COGS
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
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No data.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => {
                  // Drill-down: link period to income report filtered to that month/quarter
                  const periodHref = `/dashboard/crm/reports/income?from=${r.period.length === 7 ? `${r.period}-01` : `${r.period.split('-')[0]}-${String((Number(r.period.split('Q')[1]) - 1) * 3 + 1).padStart(2, '0')}-01`}`;
                  return (
                    <ZoruTableRow key={r.period} className="border-zoru-line">
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={periodHref}
                          label={r.period}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-success-ink">
                        {fmtMoney(r.revenue)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                        <details className="group">
                          <summary className="cursor-pointer font-medium hover:text-zoru-ink transition-colors">
                            {fmtMoney(r.cogs)}
                          </summary>
                          <div className="mt-2 text-left text-xs bg-zoru-surface rounded p-2 border border-zoru-line space-y-1">
                            {Object.keys(r.cogsDetails || {}).length === 0 ? (
                              <div className="text-zoru-ink-muted">No details</div>
                            ) : (
                              Object.entries(r.cogsDetails || {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="truncate pr-2">{k}</span>
                                  <span>{fmtMoney(v as number)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-danger-ink">
                        <details className="group">
                          <summary className="cursor-pointer font-medium hover:text-zoru-ink transition-colors">
                            {fmtMoney(r.expense)}
                          </summary>
                          <div className="mt-2 text-left text-xs bg-zoru-surface rounded p-2 border border-zoru-line space-y-1 text-zoru-ink-muted">
                            {Object.keys(r.expenseDetails || {}).length === 0 ? (
                              <div className="text-zoru-ink-muted">No details</div>
                            ) : (
                              Object.entries(r.expenseDetails || {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="truncate pr-2">{k}</span>
                                  <span>{fmtMoney(v as number)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={`text-right text-[13px] font-medium ${
                          r.profit >= 0
                            ? 'text-zoru-success-ink'
                            : 'text-zoru-danger-ink'
                        }`}
                      >
                        {fmtMoney(r.profit)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
