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
  Button,
  Field,
  Input,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { TaxBar } from '../_components/finance-charts';
import { getTaxReportDeep } from '@/app/actions/worksuite/reports.actions';
import { TaxSettlementButton } from './_components/tax-settlement-button';
import type { TaxMonthlyRow } from '@/lib/worksuite/report-types';

const PAGE_SIZES = [10, 20, 50, 100];

// Sentinel for the "All" Select option. Radix Select cannot use an empty-string
// value, so we round-trip a sentinel through the URL and treat it as no filter.
const ALL = '__all';

type TaxType = 'GST' | 'TDS' | 'Income Tax' | '';
type TaxStatus = 'Filed' | 'Pending' | 'Due' | '';

function labelTaxType(row: TaxMonthlyRow): TaxType {
  return (row.taxType as TaxType) || 'GST';
}

function labelTaxStatus(row: TaxMonthlyRow): TaxStatus {
  if (row.net <= 0) return 'Filed';
  if (row.net > 0 && row.collected > 0) return 'Pending';
  return 'Due';
}

export default async function TaxReportPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    taxType?: string;
    period?: string;
    status?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  // Normalize Select sentinels to empty (no filter).
  const taxTypeFilter = sp.taxType && sp.taxType !== ALL ? sp.taxType : '';
  const statusFilter = sp.status && sp.status !== ALL ? sp.status : '';

  const anchor = sp.from || undefined;
  const { kpis, monthly, fyLabel } = await getTaxReportDeep(anchor);

  // Apply client-side filters on the monthly rows.
  const filtered = monthly.filter((r) => {
    if (sp.period && !r.period.startsWith(sp.period)) return false;
    if (statusFilter) {
      const s = labelTaxStatus(r);
      if (s !== statusFilter) return false;
    }
    // taxType filter: currently all rows are GST; keep for future extension.
    if (taxTypeFilter && labelTaxType(r) !== taxTypeFilter) return false;
    return true;
  });

  const pageRows = filtered.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < filtered.length;

  const exportHeaders = ['Period', 'Tax Type', 'Status', 'Collected', 'Paid', 'Net'];
  const exportRows = filtered.map((r) => ({
    Period: r.period,
    'Tax Type': labelTaxType(r),
    Status: labelTaxStatus(r),
    Collected: r.collected,
    Paid: r.paid,
    Net: r.net,
  }));

  const netTone: 'green' | 'amber' | 'red' =
    kpis.netLiability === 0 ? 'green' : kpis.netLiability > 0 ? 'amber' : 'red';

  const statusVariant: Record<TaxStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
    Filed: 'success',
    Pending: 'warning',
    Due: 'danger',
    '': 'secondary',
  };

  return (
    <EntityListShell
      title="Tax Report"
      subtitle={`Tax collected on invoices minus tax paid on expenses. ${fyLabel}`}
      primaryAction={
        <FyReportToolbar
          from={sp.from}
          to={sp.to}
          exportFilename="tax-report"
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={filtered.length} />}
    >
      {/* Supplementary filter bar, URL-driven GET form. */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        {/* Preserve FY range. */}
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <Field label="Tax type">
          <Select name="taxType" defaultValue={sp.taxType || ALL}>
            <SelectTrigger aria-label="Tax type">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="GST">GST</SelectItem>
              <SelectItem value="TDS">TDS</SelectItem>
              <SelectItem value="Income Tax">Income Tax</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Period (YYYY-MM)">
          <Input type="month" name="period" defaultValue={sp.period ?? ''} inputSize="sm" />
        </Field>

        <Field label="Status">
          <Select name="status" defaultValue={sp.status || ALL}>
            <SelectTrigger aria-label="Status">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="Filed">Filed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Due">Due</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Button type="submit" variant="primary" size="sm">
          Apply
        </Button>
        <Link
          href="?"
          className="inline-flex h-8 items-center rounded-[var(--st-radius)] px-2 text-[13px] text-[var(--st-text-secondary)] underline-offset-2 hover:text-[var(--st-text)] hover:underline"
        >
          Reset
        </Link>
      </form>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tax collected"
          value={fmtMoney(kpis.taxCollected)}
          tone="green"
          hint="Output GST / VAT"
        />
        <StatCard
          label="Tax paid"
          value={fmtMoney(kpis.taxPaid)}
          tone="red"
          hint="Input credit"
        />
        <StatCard
          label="Net liability"
          value={fmtMoney(kpis.netLiability)}
          tone={netTone}
          hint="Collected - Paid"
        />
        <StatCard
          label="Pending filings"
          value={String(kpis.pendingFilings)}
          tone={kpis.pendingFilings > 0 ? 'amber' : 'green'}
          hint="Drafts + due"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly collected vs paid</CardTitle>
          <CardDescription>Compare output tax against input credit each month.</CardDescription>
        </CardHeader>
        <CardBody>
          {monthly.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No tax data for this FY"
              description="Once invoices and expenses are recorded, the monthly trend appears here."
            />
          ) : (
            <TaxBar data={monthly} />
          )}
        </CardBody>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th>Period</Th>
                <Th>Tax type</Th>
                <Th>Status</Th>
                <Th align="right">Collected</Th>
                <Th align="right">Paid</Th>
                <Th align="right">Net</Th>
                <Th align="right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr>
                  <Td colSpan={7}>
                    <EmptyState
                      size="sm"
                      title="No data for selected filters"
                      description="Try widening the period or clearing the status filter."
                    />
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r) => {
                  const taxType = labelTaxType(r);
                  const taxStatus = labelTaxStatus(r);
                  return (
                    <Tr key={r.period}>
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/sabbi/reports/gstr-1?period=${r.period}`}
                          label={r.period}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">{taxType}</Td>
                      <Td>
                        <Badge variant={statusVariant[taxStatus]}>{taxStatus}</Badge>
                      </Td>
                      <Td align="right" className="text-[13px] text-[var(--st-status-ok)]">
                        {fmtMoney(r.collected)}
                      </Td>
                      <Td align="right" className="text-[13px] text-[var(--st-danger)]">
                        {fmtMoney(r.paid)}
                      </Td>
                      <Td
                        align="right"
                        className={`text-[13px] font-medium ${
                          r.net >= 0 ? 'text-[var(--st-warn)]' : 'text-[var(--st-status-ok)]'
                        }`}
                      >
                        {fmtMoney(r.net)}
                      </Td>
                      <Td align="right">
                        <TaxSettlementButton period={r.period} taxType={taxType} amount={r.net} />
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <p className="text-[13px] text-[var(--st-text-secondary)]">
        For line-item compliance reports see{' '}
        <a href="/dashboard/sabbi/reports/gstr-1" className="text-[var(--st-text)] underline">
          GSTR-1
        </a>{' '}
        and{' '}
        <a href="/dashboard/sabbi/reports/gstr-2b" className="text-[var(--st-text)] underline">
          GSTR-2B
        </a>
        .
      </p>
    </EntityListShell>
  );
}
