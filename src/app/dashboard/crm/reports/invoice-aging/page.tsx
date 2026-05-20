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
import { StatCard, fmtMoney } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { AgingStackedBar } from '../_components/finance-charts';
import { getInvoiceAgingDeep } from '@/app/actions/worksuite/reports.actions';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function InvoiceAgingPage(props: {
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

  const { kpis, byClient, rows } = await getInvoiceAgingDeep();

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = [
    'Invoice',
    'Client',
    'Invoice Date',
    'Due Date',
    'Days Overdue',
    'Bucket',
    'Outstanding',
  ];
  const exportRows = rows.map((r) => ({
    Invoice: r.invoiceNumber,
    Client: r.clientName,
    'Invoice Date': r.invoiceDate,
    'Due Date': r.dueDate,
    'Days Overdue': r.daysOverdue,
    Bucket: r.bucket,
    Outstanding: r.outstanding,
  }));

  const bucketVariant: Record<string, 'success' | 'warning' | 'danger' | 'destructive'> = {
    '0-30': 'success',
    '31-60': 'warning',
    '61-90': 'danger',
    '90+': 'destructive',
  };

  return (
    <EntityListShell
      title="Invoice Aging"
      subtitle="Outstanding receivables grouped by days past due."
      primaryAction={
        <FyReportToolbar
          from={sp.from}
          to={sp.to}
          exportFilename="invoice-aging"
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={rows.length} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current (0–30)" value={fmtMoney(kpis.current)} tone="green" />
        <StatCard label="31–60 days" value={fmtMoney(kpis.d31to60)} tone="amber" />
        <StatCard label="61–90 days" value={fmtMoney(kpis.d61to90)} tone="red" />
        <StatCard
          label="90+ days"
          value={fmtMoney(kpis.over90)}
          tone="red"
          hint={`${kpis.openCount} open invoice${kpis.openCount === 1 ? '' : 's'}`}
        />
      </div>

      <ZoruCard className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-zoru-ink">By client</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Top 10 clients by outstanding amount across aging buckets.
          </p>
        </div>
        {byClient.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No outstanding invoices.</div>
        ) : (
          <AgingStackedBar data={byClient.slice(0, 10)} />
        )}
      </ZoruCard>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Invoice</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Invoice date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Due date</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Days overdue</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Bucket</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Outstanding</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                    No overdue invoices.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.id} className="border-zoru-line">
                    <ZoruTableCell>
                      <EntityRowLink href={`/dashboard/crm/sales/invoices/${r.id}`} label={r.invoiceNumber} />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {r.accountId ? (
                        <EntityRowLink
                          href={`/dashboard/crm/sales-crm/accounts/${r.accountId}`}
                          label={r.clientName}
                        />
                      ) : (
                        <span className="text-[13px] text-zoru-ink">{r.clientName}</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">{r.invoiceDate}</ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">{r.dueDate}</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">{r.daysOverdue}</ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={bucketVariant[r.bucket]}>{r.bucket}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-danger-ink">
                      {fmtMoney(r.outstanding)}
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
