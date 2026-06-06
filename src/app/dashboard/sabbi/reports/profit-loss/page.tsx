import React, { Suspense } from 'react';

import { Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { ProfitLossStackedBar } from '../_components/finance-charts';
import { getProfitLossDeepDB } from '../_components/finance-data';
import { PlFilterToolbar } from './_components/pl-filter-toolbar';
import ReportsLoading from '../loading';

const PAGE_SIZES = [10, 20, 50, 100];

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    granularity?: string;
    department?: string;
  }>;
}

/* ─── Server Container ────────────────────────────────────────────── */

async function ProfitLossContainer({
  searchParams,
}: {
  searchParams: Awaited<PageProps['searchParams']>;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = PAGE_SIZES.includes(Number(searchParams.limit)) ? Number(searchParams.limit) : 20;
  const isQuarterly = (searchParams.granularity ?? 'monthly') === 'quarterly';

  const data = await getProfitLossDeepDB({
    fyAnchor: searchParams.from,
    granularity: searchParams.granularity ?? 'monthly',
    department: searchParams.department,
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
          from={searchParams.from}
          to={searchParams.to}
          granularity={searchParams.granularity ?? 'monthly'}
          department={searchParams.department ?? ''}
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
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
            {isQuarterly ? 'Quarterly' : 'Monthly'} stacked
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Revenue vs COGS + expenses; profit as a separate bar.
          </p>
        </div>
        {monthly.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
            No P&L data for this FY.
          </div>
        ) : (
          <ProfitLossStackedBar data={monthly} />
        )}
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">
                  Period
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Revenue
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  COGS
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Expense
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Profit
                </Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No data.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r) => {
                  const periodHref = `/dashboard/sabbi/reports/income?from=${r.period.length === 7 ? `${r.period}-01` : `${r.period.split('-')[0]}-${String((Number(r.period.split('Q')[1]) - 1) * 3 + 1).padStart(2, '0')}-01`}`;
                  return (
                    <Tr key={r.period} className="border-[var(--st-border)]">
                      <Td className="font-medium text-[var(--st-text)]">
                        <EntityRowLink
                          href={periodHref}
                          label={r.period}
                        />
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-status-ok)]">
                        {fmtMoney(r.revenue)}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                        <details className="group">
                          <summary className="cursor-pointer font-medium hover:text-[var(--st-text)] transition-colors">
                            {fmtMoney(r.cogs)}
                          </summary>
                          <div className="mt-2 text-left text-xs bg-[var(--st-bg-secondary)] rounded p-2 border border-[var(--st-border)] space-y-1">
                            {Object.keys(r.cogsDetails || {}).length === 0 ? (
                              <div className="text-[var(--st-text-secondary)]">No details</div>
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
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-danger)]">
                        <details className="group">
                          <summary className="cursor-pointer font-medium hover:text-[var(--st-text)] transition-colors">
                            {fmtMoney(r.expense)}
                          </summary>
                          <div className="mt-2 text-left text-xs bg-[var(--st-bg-secondary)] rounded p-2 border border-[var(--st-border)] space-y-1 text-[var(--st-text-secondary)]">
                            {Object.keys(r.expenseDetails || {}).length === 0 ? (
                              <div className="text-[var(--st-text-secondary)]">No details</div>
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
                      </Td>
                      <Td
                        className={`text-right text-[13px] font-medium ${
                          r.profit >= 0
                            ? 'text-[var(--st-status-ok)]'
                            : 'text-[var(--st-danger)]'
                        }`}
                      >
                        {fmtMoney(r.profit)}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}

export default async function ProfitLossPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  return (
    <Suspense fallback={<ReportsLoading />}>
      <ProfitLossContainer searchParams={sp} />
    </Suspense>
  );
}
