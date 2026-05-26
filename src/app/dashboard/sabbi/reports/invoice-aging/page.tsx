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
import { StatCard, fmtMoney } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { AgingStackedBar } from '../_components/finance-charts';
import { getInvoiceAgingDeep } from '@/app/actions/worksuite/reports.actions';
import type { InvoiceAgingDetailRow } from '@/lib/worksuite/report-types';

const PAGE_SIZES = [10, 20, 50, 100];

const BUCKET_ORDER = ['0-30', '31-60', '61-90', '90+'] as const;
type Bucket = (typeof BUCKET_ORDER)[number];

export default async function InvoiceAgingPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    client?: string;
    bucket?: string;
    currency?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const clientSearch = sp.client?.trim().toLowerCase() ?? '';
  const bucketFilter = sp.bucket as Bucket | undefined;

  const { kpis, byClient, rows: filtered } = await getInvoiceAgingDeep({
    client: clientSearch || undefined,
    bucket: bucketFilter,
    currency: sp.currency || undefined,
  });

  const pageRows = filtered.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < filtered.length;

  // Summary totals for filtered rows
  const totals = filtered.reduce(
    (acc, r) => {
      acc.outstanding += r.outstanding;
      if (r.bucket === '0-30') acc.current += r.outstanding;
      else if (r.bucket === '31-60') acc.d3160 += r.outstanding;
      else if (r.bucket === '61-90') acc.d6190 += r.outstanding;
      else acc.over90 += r.outstanding;
      return acc;
    },
    { outstanding: 0, current: 0, d3160: 0, d6190: 0, over90: 0 },
  );

  const exportHeaders = [
    'Invoice',
    'Client',
    'Invoice Date',
    'Due Date',
    'Days Overdue',
    'Bucket',
    'Status',
    'Outstanding',
  ];
  const exportRows = filtered.map((r) => ({
    Invoice: r.invoiceNumber,
    Client: r.clientName,
    'Invoice Date': r.invoiceDate,
    'Due Date': r.dueDate,
    'Days Overdue': r.daysOverdue,
    Bucket: r.bucket,
    Status: r.isDisputed ? 'Disputed' : 'Active',
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
        <div className="flex items-center gap-3">
          <form action={async () => {
            'use server';
            // Placeholder for sending bulk dunning emails
            console.log('Sending bulk dunning emails for 90+ days...');
          }}>
            <button
              type="submit"
              className="h-9 rounded-lg bg-zoru-danger-surface px-4 text-[13px] font-medium text-zoru-danger-ink border border-zoru-danger-border hover:bg-zoru-danger-border/20"
            >
              Send Dunning (90+)
            </button>
          </form>
          <FyReportToolbar
            from={sp.from}
            to={sp.to}
            exportFilename="invoice-aging"
            exportHeaders={exportHeaders}
            exportRows={exportRows}
          />
        </div>
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
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Client search</span>
          <input
            type="text"
            name="client"
            defaultValue={sp.client ?? ''}
            placeholder="Client name..."
            className="h-9 w-48 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Aging bucket</span>
          <select
            name="bucket"
            defaultValue={sp.bucket ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All buckets</option>
            <option value="0-30">0–30 days</option>
            <option value="31-60">31–60 days</option>
            <option value="61-90">61–90 days</option>
            <option value="90+">90+ days</option>
          </select>
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
        <StatCard label="Current (0-30)" value={fmtMoney(kpis.current)} tone="green" />
        <StatCard label="31-60 days" value={fmtMoney(kpis.d31to60)} tone="amber" />
        <StatCard label="61-90 days" value={fmtMoney(kpis.d61to90)} tone="red" />
        <StatCard
          label="90+ days"
          value={fmtMoney(kpis.over90)}
          tone="red"
          hint={`${kpis.openCount} open invoice${kpis.openCount === 1 ? '' : 's'}`}
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
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
      </Card>

      {/* Table with summary row */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Invoice</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Invoice date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Due date</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Days overdue</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Bucket</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Outstanding</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No overdue invoices matching filters.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                <>
                  {pageRows.map((r: InvoiceAgingDetailRow) => (
                    <ZoruTableRow key={r.id} className="border-zoru-line">
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/sales/invoices/${r.id}`}
                          label={r.invoiceNumber}
                        />
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
                        <Badge variant={bucketVariant[r.bucket]}>{r.bucket}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {r.isDisputed ? (
                          <Badge variant="destructive">Disputed</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-danger-ink">
                        {fmtMoney(r.outstanding)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}

                  {/* Summary totals row */}
                  <ZoruTableRow className="border-t-2 border-zoru-line bg-zoru-surface-elevated font-semibold">
                    <ZoruTableCell colSpan={3} className="text-[13px] text-zoru-ink">
                      Totals ({filtered.length} invoice{filtered.length === 1 ? '' : 's'})
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      0-30: {fmtMoney(totals.current)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                      31-60: {fmtMoney(totals.d3160)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      61-90: {fmtMoney(totals.d6190)} · 90+: {fmtMoney(totals.over90)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-bold text-zoru-danger-ink">
                      {fmtMoney(totals.outstanding)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                </>
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
