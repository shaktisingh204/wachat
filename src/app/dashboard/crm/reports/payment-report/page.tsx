export const dynamic = 'force-dynamic';

import {
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Badge,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtDays } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { PaymentMtdLine, PaymentMethodBar, MonthlyTrendLine } from '../_components/finance-charts';
import { getPaymentReportDeep } from '@/app/actions/worksuite/reports.actions';
import type { PaymentReceiptRow } from '@/lib/worksuite/report-types';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function PaymentReportPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    mode?: string;
    client?: string;
    currency?: string;
    status?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const anchor = sp.from || undefined;
  const { kpis, mtdByDay, byMethod, rows, fyLabel } = await getPaymentReportDeep(anchor);

  // Apply client-side filters on receipt rows
  const clientSearch = sp.client?.trim().toLowerCase() ?? '';
  const filtered: PaymentReceiptRow[] = rows.filter((r) => {
    if (sp.mode && r.method.toLowerCase() !== sp.mode.toLowerCase()) return false;
    if (clientSearch && !r.clientName.toLowerCase().includes(clientSearch)) return false;
    return true;
  });

  const pageRows = filtered.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < filtered.length;

  // Build monthly trend from receipt rows
  const monthlyMap = new Map<string, number>();
  for (const r of rows) {
    const month = r.date ? r.date.slice(0, 7) : '';
    if (!month) continue;
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + r.amount);
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, total]) => ({ period, total, count: 0 }));

  const exportHeaders = ['Receipt #', 'Date', 'Client', 'Invoice', 'Method', 'Amount'];
  const exportRows = filtered.map((r) => ({
    'Receipt #': r.receiptNumber,
    Date: r.date,
    Client: r.clientName,
    Invoice: r.invoiceNumber,
    Method: r.method,
    Amount: r.amount,
  }));

  const dsoTone: 'green' | 'amber' | 'red' =
    kpis.avgDsoDays === 0
      ? 'green'
      : kpis.avgDsoDays <= 30
        ? 'green'
        : kpis.avgDsoDays <= 60
          ? 'amber'
          : 'red';

  return (
    <EntityListShell
      title="Payment Report"
      subtitle={`Receivables, MTD collections and DSO · ${fyLabel}`}
      primaryAction={
        <FyReportToolbar
          from={sp.from}
          to={sp.to}
          exportFilename="payment-report"
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={filtered.length} />}
    >
      {/* Filter row */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2"
      >
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Payment mode</span>
          <select
            name="mode"
            defaultValue={sp.mode ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All modes</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Client search</span>
          <input
            type="text"
            name="client"
            defaultValue={sp.client ?? ''}
            placeholder="Client name..."
            className="h-9 w-44 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Currency</span>
          <select
            name="currency"
            defaultValue={sp.currency ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">INR (default)</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All</option>
            <option value="received">Received</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground"
        >
          Apply
        </button>
        <a
          href="?"
          className="inline-flex h-9 items-center rounded-lg border border-zoru-line px-3 text-[13px] text-zoru-ink-muted"
        >
          Reset
        </a>
      </form>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received MTD" value={fmtMoney(kpis.receivedMtd)} tone="green" hint="this month" />
        <StatCard label="Pending receipts" value={fmtMoney(kpis.pendingReceipts)} tone="amber" hint="outstanding total" />
        <StatCard label="Overdue" value={fmtMoney(kpis.overdueAmount)} tone="red" hint="past due date" />
        <StatCard label="Avg DSO" value={fmtDays(kpis.avgDsoDays)} tone={dsoTone} hint="days sales outstanding" />
      </div>

      {/* Charts row: MTD trend + method bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">MTD vs target</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Daily receipts compared to last 3-month average.
            </p>
          </div>
          {mtdByDay.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No receipts this month.</div>
          ) : (
            <PaymentMtdLine data={mtdByDay} />
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">By payment method</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Cash / card / UPI / bank breakdown.</p>
          </div>
          {byMethod.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No payment method data.</div>
          ) : (
            <PaymentMethodBar data={byMethod} />
          )}
        </Card>
      </div>

      {/* Monthly trend line chart */}
      <Card className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-zoru-ink">Monthly receipt trend</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Total payments received per month across the fiscal year.
          </p>
        </div>
        {monthlyTrend.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No monthly data.</div>
        ) : (
          <MonthlyTrendLine data={monthlyTrend} label="Received" color="#7ec77d" />
        )}
      </Card>

      {/* Receipt table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Receipt #</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Invoice</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Method</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Amount</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No receipts for selected filters.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r: PaymentReceiptRow) => (
                  <ZoruTableRow key={r.id} className="border-zoru-line">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/receipts/${r.id}`}
                        label={r.receiptNumber}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">{r.date}</ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">{r.clientName}</ZoruTableCell>
                    <ZoruTableCell>
                      {r.invoiceId ? (
                        <EntityRowLink
                          href={`/dashboard/crm/sales/invoices/${r.invoiceId}`}
                          label={r.invoiceNumber || 'View'}
                        />
                      ) : (
                        <span className="text-[13px] text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant="secondary">{r.method}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-success-ink">
                      {fmtMoney(r.amount)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
