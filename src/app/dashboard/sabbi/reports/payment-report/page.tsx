export const dynamic = 'force-dynamic';

import { Card, Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui/compat';
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

  const clientSearch = sp.client?.trim().toLowerCase() ?? '';
  
  const anchor = sp.from || undefined;
  const { kpis, mtdByDay, byMethod, rows: filtered, fyLabel } = await getPaymentReportDeep(anchor, {
    mode: sp.mode || undefined,
    client: clientSearch || undefined,
    currency: sp.currency || undefined,
    status: sp.status || undefined,
  });

  const pageRows = filtered.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < filtered.length;

  // Build monthly trend from receipt rows
  const monthlyMap = new Map<string, number>();
  for (const r of filtered) {
    const month = r.date ? r.date.slice(0, 7) : '';
    if (!month) continue;
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + r.amount);
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, total]) => ({ period, total, count: 0 }));

  const exportHeaders = ['Receipt #', 'Date', 'Client', 'Invoice', 'Method', 'Status', 'Amount'];
  const exportRows = filtered.map((r) => ({
    'Receipt #': r.receiptNumber,
    Date: r.date,
    Client: r.clientName,
    Invoice: r.invoiceNumber,
    Method: r.method,
    Status: r.isChargeback ? 'Chargeback' : 'Received',
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
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Payment mode</span>
          <select
            name="mode"
            defaultValue={sp.mode ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
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
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Client search</span>
          <input
            type="text"
            name="client"
            defaultValue={sp.client ?? ''}
            placeholder="Client name..."
            className="h-9 w-44 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Currency</span>
          <select
            name="currency"
            defaultValue={sp.currency ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          >
            <option value="">INR (default)</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          >
            <option value="">All</option>
            <option value="received">Received</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        <button
          type="submit"
          className="h-9 rounded-lg bg-[var(--st-text)] px-4 text-[13px] font-medium text-white"
        >
          Apply
        </button>
        <a
          href="?"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--st-border)] px-3 text-[13px] text-[var(--st-text-secondary)]"
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
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">MTD vs target</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
              Daily receipts compared to last 3-month average.
            </p>
          </div>
          {mtdByDay.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">No receipts this month.</div>
          ) : (
            <PaymentMtdLine data={mtdByDay} />
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">By payment method</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">Cash / card / UPI / bank breakdown.</p>
          </div>
          {byMethod.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">No payment method data.</div>
          ) : (
            <PaymentMethodBar data={byMethod} />
          )}
        </Card>
      </div>

      {/* Monthly trend line chart */}
      <Card className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Monthly receipt trend</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Total payments received per month across the fiscal year.
          </p>
        </div>
        {monthlyTrend.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">No monthly data.</div>
        ) : (
          <MonthlyTrendLine data={monthlyTrend} label="Received" color="#7ec77d" />
        )}
      </Card>

      {/* Receipt table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Receipt #</Th>
                <Th className="text-[var(--st-text-secondary)]">Date</Th>
                <Th className="text-[var(--st-text-secondary)]">Client</Th>
                <Th className="text-[var(--st-text-secondary)]">Invoice</Th>
                <Th className="text-[var(--st-text-secondary)]">Method</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Amount</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No receipts for selected filters.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r: PaymentReceiptRow) => (
                  <Tr key={r.id} className="border-[var(--st-border)]">
                    <Td>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/receipts/${r.id}`}
                        label={r.receiptNumber}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">{r.date}</Td>
                    <Td className="text-[13px] text-[var(--st-text)]">{r.clientName}</Td>
                    <Td>
                      {r.invoiceId ? (
                        <EntityRowLink
                          href={`/dashboard/crm/sales/invoices/${r.invoiceId}`}
                          label={r.invoiceNumber || 'View'}
                        />
                      ) : (
                        <span className="text-[13px] text-[var(--st-text-secondary)]">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant="secondary">{r.method}</Badge>
                    </Td>
                    <Td>
                      {r.isChargeback ? (
                        <Badge variant="destructive">Chargeback</Badge>
                      ) : (
                        <Badge variant="success">Received</Badge>
                      )}
                    </Td>
                    <Td className="text-right text-[13px] font-medium text-[var(--st-status-ok)]">
                      {fmtMoney(r.amount)}
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
