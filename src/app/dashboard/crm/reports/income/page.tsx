export const dynamic = 'force-dynamic';

import {
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { MonthlyTrendLine, CategoryPie } from '../_components/finance-charts';
import { getIncomeReportDeep } from '@/app/actions/worksuite/reports.actions';
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

  const anchor = sp.from || undefined;
  const { kpis, monthly, bySource, rows, fyLabel } =
    await getIncomeReportDeep(anchor);

  // Apply in-memory filters (source, client, paymentMode) over the 500-row window
  let filteredRows = rows;
  if (sp.source) {
    const s = sp.source.toLowerCase();
    filteredRows = filteredRows.filter((r) =>
      r.source.toLowerCase().includes(s),
    );
  }
  if (sp.client) {
    const c = sp.client.toLowerCase();
    filteredRows = filteredRows.filter((r) =>
      r.clientName.toLowerCase().includes(c),
    );
  }
  // paymentMode is not stored in IncomeInvoiceRow so we keep it as a UI-only param
  // for the toolbar display; it does not yet filter (add a DB field later).

  const pageRows = filteredRows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < filteredRows.length;

  const exportHeaders = [
    'Invoice #',
    'Date',
    'Client',
    'Source',
    'Total',
    'Paid',
    'Status',
  ];
  const exportRows = filteredRows.map((r) => ({
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
          total={filteredRows.length}
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
          hint="vs. prior FY"
        />
        <StatCard
          label="Top source"
          value={kpis.topSource}
          hint={fmtMoney(kpis.topSourceTotal)}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ZoruCard className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">
              Monthly trend
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Revenue recognised per month.
            </p>
          </div>
          {monthly.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">
              No income for this FY.
            </div>
          ) : (
            <MonthlyTrendLine
              data={monthly}
              color="#7ec77d"
              label="Income"
            />
          )}
        </ZoruCard>
        <ZoruCard className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">
              By source
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Top revenue sources.
            </p>
          </div>
          {bySource.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">
              No source data.
            </div>
          ) : (
            <CategoryPie data={bySource} label="Source" />
          )}
        </ZoruCard>
      </div>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">
                  Invoice
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Date
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Client
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Source
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Total
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Paid
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Status
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No invoices for this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.id} className="border-zoru-line">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/invoices/${r.id}`}
                        label={r.invoiceNumber}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {r.invoiceDate}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {r.clientName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {r.source}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                      {fmtMoney(r.total)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-success-ink">
                      {fmtMoney(r.paidAmount)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant={r.status === 'Paid' ? 'success' : 'warning'}
                      >
                        {r.status || '—'}
                      </ZoruBadge>
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
