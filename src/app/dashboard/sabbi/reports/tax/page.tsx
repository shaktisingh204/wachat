export const dynamic = 'force-dynamic';

import { Card, Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui';
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

  const anchor = sp.from || undefined;
  const { kpis, monthly, fyLabel } = await getTaxReportDeep(anchor);

  // Apply client-side filters on the monthly rows
  const filtered = monthly.filter((r) => {
    if (sp.period && !r.period.startsWith(sp.period)) return false;
    if (sp.status) {
      const s = labelTaxStatus(r);
      if (s !== sp.status) return false;
    }
    // taxType filter — currently all rows are GST; keep for future extension
    if (sp.taxType && labelTaxType(r) !== sp.taxType) return false;
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
      subtitle={`Tax collected on invoices minus tax paid on expenses · ${fyLabel}`}
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
      {/* Supplementary filter bar — URL-driven GET form */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        {/* Preserve FY range */}
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Tax type</span>
          <select
            name="taxType"
            defaultValue={sp.taxType ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          >
            <option value="">All</option>
            <option value="GST">GST</option>
            <option value="TDS">TDS</option>
            <option value="Income Tax">Income Tax</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Period (YYYY-MM)</span>
          <input
            type="month"
            name="period"
            defaultValue={sp.period ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          >
            <option value="">All</option>
            <option value="Filed">Filed</option>
            <option value="Pending">Pending</option>
            <option value="Due">Due</option>
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
      <Card className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Monthly collected vs paid</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Compare output tax against input credit each month.
          </p>
        </div>
        {monthly.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">No tax data for this FY.</div>
        ) : (
          <TaxBar data={monthly} />
        )}
      </Card>

      {/* Table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Period</Th>
                <Th className="text-[var(--st-text-secondary)]">Tax type</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Collected</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Paid</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Net</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No data for selected filters.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r) => {
                  const taxType = labelTaxType(r);
                  const taxStatus = labelTaxStatus(r);
                  return (
                    <Tr key={r.period} className="border-[var(--st-border)]">
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
                      <Td className="text-right text-[13px] text-[var(--st-status-ok)]">
                        {fmtMoney(r.collected)}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-danger)]">
                        {fmtMoney(r.paid)}
                      </Td>
                      <Td
                        className={`text-right text-[13px] font-medium ${
                          r.net >= 0 ? 'text-[var(--st-warn)]' : 'text-[var(--st-status-ok)]'
                        }`}
                      >
                        {fmtMoney(r.net)}
                      </Td>
                      <Td className="text-right">
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
