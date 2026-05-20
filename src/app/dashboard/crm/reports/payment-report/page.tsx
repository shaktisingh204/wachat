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
import { StatCard, fmtMoney, fmtDays } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { PaymentMtdLine, PaymentMethodBar } from '../_components/finance-charts';
import { getPaymentReportDeep } from '@/app/actions/worksuite/reports.actions';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function PaymentReportPage(props: {
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
  const { kpis, mtdByDay, byMethod, rows, fyLabel } = await getPaymentReportDeep(anchor);

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = ['Receipt #', 'Date', 'Client', 'Invoice', 'Method', 'Amount'];
  const exportRows = rows.map((r) => ({
    'Receipt #': r.receiptNumber,
    Date: r.date,
    Client: r.clientName,
    Invoice: r.invoiceNumber,
    Method: r.method,
    Amount: r.amount,
  }));

  const dsoTone: 'green' | 'amber' | 'red' =
    kpis.avgDsoDays === 0 ? 'green' : kpis.avgDsoDays <= 30 ? 'green' : kpis.avgDsoDays <= 60 ? 'amber' : 'red';

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
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={rows.length} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received MTD" value={fmtMoney(kpis.receivedMtd)} tone="green" hint="this month" />
        <StatCard label="Pending receipts" value={fmtMoney(kpis.pendingReceipts)} tone="amber" hint="outstanding total" />
        <StatCard label="Overdue" value={fmtMoney(kpis.overdueAmount)} tone="red" hint="past due date" />
        <StatCard label="Avg DSO" value={fmtDays(kpis.avgDsoDays)} tone={dsoTone} hint="days sales outstanding" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ZoruCard className="p-6">
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
        </ZoruCard>

        <ZoruCard className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">By payment method</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Cash / card / UPI / bank breakdown.</p>
          </div>
          {byMethod.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No payment method data.</div>
          ) : (
            <PaymentMethodBar data={byMethod} />
          )}
        </ZoruCard>
      </div>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
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
                  <ZoruTableCell colSpan={6} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                    No receipts for this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.id} className="border-zoru-line">
                    <ZoruTableCell>
                      <EntityRowLink href={`/dashboard/crm/sales/receipts/${r.id}`} label={r.receiptNumber} />
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
                      <ZoruBadge variant="secondary">{r.method}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-success-ink">
                      {fmtMoney(r.amount)}
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
