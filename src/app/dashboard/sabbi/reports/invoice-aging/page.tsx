export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  Button,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
  type BadgeTone,
  type BadgeStyleKind,
} from '@/components/sabcrm/20ui';
import { FileWarning } from 'lucide-react';
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

// Radix Select cannot use an empty-string item value, so the "all"/"default"
// rows submit a sentinel that the page treats as "no filter".
const BUCKET_ALL = 'all';
const CURRENCY_DEFAULT = 'INR';

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
  const rawBucket = sp.bucket && sp.bucket !== BUCKET_ALL ? sp.bucket : undefined;
  const bucketFilter = rawBucket as Bucket | undefined;
  const rawCurrency =
    sp.currency && sp.currency !== CURRENCY_DEFAULT ? sp.currency : undefined;

  const { kpis, byClient, rows: filtered } = await getInvoiceAgingDeep({
    client: clientSearch || undefined,
    bucket: bucketFilter,
    currency: rawCurrency,
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

  // Aging buckets carry meaning through tone (taste rule: colour = status only).
  const bucketBadge: Record<string, { tone: BadgeTone; kind: BadgeStyleKind }> = {
    '0-30': { tone: 'success', kind: 'soft' },
    '31-60': { tone: 'warning', kind: 'soft' },
    '61-90': { tone: 'danger', kind: 'soft' },
    '90+': { tone: 'danger', kind: 'solid' },
  };

  return (
    <EntityListShell
      title="Invoice Aging"
      subtitle="Outstanding receivables grouped by days past due."
      primaryAction={
        <div className="flex items-center gap-3">
          <form
            action={async () => {
              'use server';
              // Placeholder for sending bulk dunning emails
              console.log('Sending bulk dunning emails for 90+ days...');
            }}
          >
            <Button type="submit" variant="danger" size="sm">
              Send Dunning (90+)
            </Button>
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
        className="flex flex-wrap items-end gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5"
      >
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <Field label="Client search" className="w-48">
          <Input
            type="text"
            name="client"
            inputSize="sm"
            defaultValue={sp.client ?? ''}
            placeholder="Client name"
          />
        </Field>

        <Field label="Aging bucket">
          <Select name="bucket" defaultValue={sp.bucket || BUCKET_ALL}>
            <SelectTrigger aria-label="Aging bucket">
              <SelectValue placeholder="All buckets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BUCKET_ALL}>All buckets</SelectItem>
              <SelectItem value="0-30">0-30 days</SelectItem>
              <SelectItem value="31-60">31-60 days</SelectItem>
              <SelectItem value="61-90">61-90 days</SelectItem>
              <SelectItem value="90+">90+ days</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Currency">
          <Select name="currency" defaultValue={sp.currency || CURRENCY_DEFAULT}>
            <SelectTrigger aria-label="Currency">
              <SelectValue placeholder="INR (default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CURRENCY_DEFAULT}>INR (default)</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Button type="submit" variant="primary" size="sm">
          Apply
        </Button>
        <Link
          href="?"
          className="inline-flex h-9 items-center px-1 text-[13px] text-[var(--st-text-secondary)] underline-offset-4 hover:text-[var(--st-text)] hover:underline"
        >
          Reset
        </Link>
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
      <Card padding="lg">
        <CardHeader>
          <CardTitle>By client</CardTitle>
          <CardDescription>
            Top 10 clients by outstanding amount across aging buckets.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {byClient.length === 0 ? (
            <EmptyState
              icon={FileWarning}
              title="No outstanding invoices"
              description="Receivables are fully settled for this period."
            />
          ) : (
            <AgingStackedBar data={byClient.slice(0, 10)} />
          )}
        </CardBody>
      </Card>

      {/* Table with summary row */}
      <Card padding="none">
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
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
                  <Td colSpan={8} className="p-0">
                    <EmptyState
                      icon={FileWarning}
                      size="sm"
                      title="No overdue invoices"
                      description="Nothing matches the current filters."
                    />
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
                        <Badge
                          tone={bucketBadge[r.bucket]?.tone ?? 'neutral'}
                          kind={bucketBadge[r.bucket]?.kind ?? 'soft'}
                        >
                          {r.bucket}
                        </Badge>
                      </Td>
                      <Td>
                        {r.isDisputed ? (
                          <Badge tone="danger">Disputed</Badge>
                        ) : (
                          <Badge tone="neutral">Active</Badge>
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
                      61-90: {fmtMoney(totals.d6190)} - 90+: {fmtMoney(totals.over90)}
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
