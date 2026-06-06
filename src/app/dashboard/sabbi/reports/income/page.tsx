export const dynamic = 'force-dynamic';

import { Card, Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { MonthlyTrendLine, CategoryPie } from '../_components/finance-charts';
import { getIncomeReportDeepDB } from '../_components/finance-data';
import { IncomeFilterToolbar } from './_components/income-filter-toolbar';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function IncomeReportPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    source?: string;
    client?: string;
    paymentMode?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const data = await getIncomeReportDeepDB({
    fyAnchor: sp.from,
    source: sp.source,
    client: sp.client,
    page,
    limit,
  });

  if (!data) return null;
  const { kpis, monthly, bySource, rows: pageRows, totalCount, fyLabel } = data;

  const hasMore = page * limit < totalCount;

  const exportHeaders = [
    'Invoice #',
    'Date',
    'Client',
    'Source',
    'Total',
    'Paid',
    'Status',
  ];
  const exportRows = pageRows.map((r) => ({
    'Invoice #': r.invoiceNumber,
    Date: r.invoiceDate,
    Client: r.clientName,
    Source: r.source,
    Total: r.total,
    Paid: r.paidAmount,
    Status: r.status,
  }));

  const yoyTone: 'green' | 'red' | 'default' =
    kpis.yoyChangePct > 0
      ? 'green'
      : kpis.yoyChangePct < 0
        ? 'red'
        : 'default';

  return (
    <EntityListShell
      title="Income Report"
      subtitle={`Revenue from paid and partially paid invoices · ${fyLabel}`}
      primaryAction={
        <IncomeFilterToolbar
          from={sp.from}
          to={sp.to}
          source={sp.source ?? ''}
          client={sp.client ?? ''}
          paymentMode={sp.paymentMode ?? ''}
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={hasMore}
          total={totalCount}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total income (FY)"
          value={fmtMoney(kpis.totalFY)}
          tone="green"
          hint={fyLabel}
        />
        <StatCard label="This month" value={fmtMoney(kpis.thisMonth)} />
        <StatCard
          label="YoY change"
          value={fmtPct(kpis.yoyChangePct)}
          tone={yoyTone}
          hint={`Last YTD: ${fmtMoney((kpis as any).lastYtdTotal || 0)}`}
        />
        <StatCard
          label="Top source"
          value={kpis.topSource}
          hint={fmtMoney(kpis.topSourceTotal)}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Monthly trend
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
              Revenue recognised per month.
            </p>
          </div>
          {monthly.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              No income for this FY.
            </div>
          ) : (
            <MonthlyTrendLine
              data={monthly}
              color="#7ec77d"
              label="Income"
            />
          )}
        </Card>
        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              By source
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
              Top revenue sources.
            </p>
          </div>
          {bySource.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              No source data.
            </div>
          ) : (
            <CategoryPie data={bySource} label="Source" />
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">
                  Invoice
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Date
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Client
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Source
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Total
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Paid
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Status
                </Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No invoices for this range.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r) => (
                  <Tr key={r.id} className="border-[var(--st-border)]">
                    <Td>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/invoices/${r.id}`}
                        label={r.invoiceNumber}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.invoiceDate}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.clientName}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.source}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.total)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-status-ok)]">
                      {fmtMoney(r.paidAmount)}
                    </Td>
                    <Td>
                      <Badge
                        variant={r.status === 'Paid' ? 'success' : 'warning'}
                      >
                        {r.status || '—'}
                      </Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
