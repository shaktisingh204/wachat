export const dynamic = 'force-dynamic';

import { Card, Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui/compat';
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
              className="h-9 rounded-lg bg-[var(--st-danger-soft)] px-4 text-[13px] font-medium text-[var(--st-danger)] border border-[var(--st-danger)] hover:bg-[var(--st-danger)]/20"
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
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Client search</span>
          <input
            type="text"
            name="client"
            defaultValue={sp.client ?? ''}
            placeholder="Client name..."
            className="h-9 w-48 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Aging bucket</span>
          <select
            name="bucket"
            defaultValue={sp.bucket ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          >
            <option value="">All buckets</option>
            <option value="0-30">0–30 days</option>
            <option value="31-60">31–60 days</option>
            <option value="61-90">61–90 days</option>
            <option value="90+">90+ days</option>
          </select>
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
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">By client</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Top 10 clients by outstanding amount across aging buckets.
          </p>
        </div>
        {byClient.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">No outstanding invoices.</div>
        ) : (
          <AgingStackedBar data={byClient.slice(0, 10)} />
        )}
      </Card>

      {/* Table with summary row */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Invoice</Th>
                <Th className="text-[var(--st-text-secondary)]">Client</Th>
                <Th className="text-[var(--st-text-secondary)]">Invoice date</Th>
                <Th className="text-[var(--st-text-secondary)]">Due date</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Days overdue</Th>
                <Th className="text-[var(--st-text-secondary)]">Bucket</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Outstanding</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={8}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No overdue invoices matching filters.
                  </Td>
                </Tr>
              ) : (
                <>
                  {pageRows.map((r: InvoiceAgingDetailRow) => (
                    <Tr key={r.id} className="border-[var(--st-border)]">
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/sales/invoices/${r.id}`}
                          label={r.invoiceNumber}
                        />
                      </Td>
                      <Td>
                        {r.accountId ? (
                          <EntityRowLink
                            href={`/dashboard/crm/sales-crm/accounts/${r.accountId}`}
                            label={r.clientName}
                          />
                        ) : (
                          <span className="text-[13px] text-[var(--st-text)]">{r.clientName}</span>
                        )}
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text-secondary)]">{r.invoiceDate}</Td>
                      <Td className="text-[13px] text-[var(--st-text-secondary)]">{r.dueDate}</Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">{r.daysOverdue}</Td>
                      <Td>
                        <Badge variant={bucketVariant[r.bucket]}>{r.bucket}</Badge>
                      </Td>
                      <Td>
                        {r.isDisputed ? (
                          <Badge variant="destructive">Disputed</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </Td>
                      <Td className="text-right text-[13px] font-medium text-[var(--st-danger)]">
                        {fmtMoney(r.outstanding)}
                      </Td>
                    </Tr>
                  ))}

                  {/* Summary totals row */}
                  <Tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg)] font-semibold">
                    <Td colSpan={3} className="text-[13px] text-[var(--st-text)]">
                      Totals ({filtered.length} invoice{filtered.length === 1 ? '' : 's'})
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      0-30: {fmtMoney(totals.current)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                      31-60: {fmtMoney(totals.d3160)}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      61-90: {fmtMoney(totals.d6190)} · 90+: {fmtMoney(totals.over90)}
                    </Td>
                    <Td className="text-right text-[13px] font-bold text-[var(--st-danger)]">
                      {fmtMoney(totals.outstanding)}
                    </Td>
                  </Tr>
                </>
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
