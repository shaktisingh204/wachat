export const dynamic = 'force-dynamic';

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
  EmptyState,
} from '@/components/sabcrm/20ui';
import { Receipt } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtDays } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { PaymentMtdLine, PaymentMethodBar, MonthlyTrendLine } from '../_components/finance-charts';
import { PaymentReportFilters } from './_components/payment-report-filters';
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
      subtitle={`Receivables, MTD collections and DSO, ${fyLabel}`}
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
      <PaymentReportFilters
        mode={sp.mode}
        client={sp.client}
        currency={sp.currency}
        status={sp.status}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received MTD" value={fmtMoney(kpis.receivedMtd)} tone="green" hint="this month" />
        <StatCard label="Pending receipts" value={fmtMoney(kpis.pendingReceipts)} tone="amber" hint="outstanding total" />
        <StatCard label="Overdue" value={fmtMoney(kpis.overdueAmount)} tone="red" hint="past due date" />
        <StatCard label="Avg DSO" value={fmtDays(kpis.avgDsoDays)} tone={dsoTone} hint="days sales outstanding" />
      </div>

      {/* Charts row: MTD trend + method bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>MTD vs target</CardTitle>
            <CardDescription>Daily receipts compared to last 3-month average.</CardDescription>
          </CardHeader>
          <CardBody>
            {mtdByDay.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Receipt}
                title="No receipts this month"
                description="Collections this month will plot here."
              />
            ) : (
              <PaymentMtdLine data={mtdByDay} />
            )}
          </CardBody>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>By payment method</CardTitle>
            <CardDescription>Cash, card, UPI and bank breakdown.</CardDescription>
          </CardHeader>
          <CardBody>
            {byMethod.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Receipt}
                title="No payment method data"
                description="Method-wise totals will appear here."
              />
            ) : (
              <PaymentMethodBar data={byMethod} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Monthly trend line chart */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Monthly receipt trend</CardTitle>
          <CardDescription>Total payments received per month across the fiscal year.</CardDescription>
        </CardHeader>
        <CardBody>
          {monthlyTrend.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Receipt}
              title="No monthly data"
              description="Receipts grouped by month will appear here."
            />
          ) : (
            <MonthlyTrendLine data={monthlyTrend} label="Received" color="#7ec77d" />
          )}
        </CardBody>
      </Card>

      {/* Receipt table */}
      <Card padding="none">
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th>Receipt #</Th>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Invoice</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th align="right">Amount</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr>
                  <Td colSpan={7}>
                    <EmptyState
                      size="sm"
                      icon={Receipt}
                      title="No receipts for selected filters"
                      description="Adjust the filters above to see payment receipts."
                    />
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r: PaymentReceiptRow) => (
                  <Tr key={r.id}>
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
                        <span className="text-[13px] text-[var(--st-text-secondary)]">-</span>
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
                    <Td align="right" className="text-[13px] font-medium text-[var(--st-status-ok)]">
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
