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
        className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2"
      >
        {/* Preserve FY range */}
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Tax type</span>
          <select
            name="taxType"
            defaultValue={sp.taxType ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All</option>
            <option value="GST">GST</option>
            <option value="TDS">TDS</option>
            <option value="Income Tax">Income Tax</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Period (YYYY-MM)</span>
          <input
            type="month"
            name="period"
            defaultValue={sp.period ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All</option>
            <option value="Filed">Filed</option>
            <option value="Pending">Pending</option>
            <option value="Due">Due</option>
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
          <h2 className="text-[16px] font-semibold text-zoru-ink">Monthly collected vs paid</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Compare output tax against input credit each month.
          </p>
        </div>
        {monthly.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No tax data for this FY.</div>
        ) : (
          <TaxBar data={monthly} />
        )}
      </Card>

      {/* Table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Tax type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Collected</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Paid</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Net</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Action</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No data for selected filters.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => {
                  const taxType = labelTaxType(r);
                  const taxStatus = labelTaxStatus(r);
                  return (
                    <ZoruTableRow key={r.period} className="border-zoru-line">
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/reports/gstr-1?period=${r.period}`}
                          label={r.period}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">{taxType}</ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={statusVariant[taxStatus]}>{taxStatus}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-success-ink">
                        {fmtMoney(r.collected)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-danger-ink">
                        {fmtMoney(r.paid)}
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={`text-right text-[13px] font-medium ${
                          r.net >= 0 ? 'text-zoru-warning-ink' : 'text-zoru-success-ink'
                        }`}
                      >
                        {fmtMoney(r.net)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <TaxSettlementButton period={r.period} taxType={taxType} amount={r.net} />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>

      <p className="text-[13px] text-zoru-ink-muted">
        For line-item compliance reports see{' '}
        <a href="/dashboard/crm/reports/gstr-1" className="text-zoru-primary underline">
          GSTR-1
        </a>{' '}
        and{' '}
        <a href="/dashboard/crm/reports/gstr-2b" className="text-zoru-primary underline">
          GSTR-2B
        </a>
        .
      </p>
    </EntityListShell>
  );
}
