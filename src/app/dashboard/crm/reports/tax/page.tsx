export const dynamic = 'force-dynamic';

import {
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { TaxBar } from '../_components/finance-charts';
import { getTaxReportDeep } from '@/app/actions/worksuite/reports.actions';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function TaxReportPage(props: {
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
  const { kpis, monthly, fyLabel } = await getTaxReportDeep(anchor);

  const pageRows = monthly.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < monthly.length;

  const exportHeaders = ['Period', 'Collected', 'Paid', 'Net'];
  const exportRows = monthly.map((r) => ({
    Period: r.period,
    Collected: r.collected,
    Paid: r.paid,
    Net: r.net,
  }));

  const netTone: 'green' | 'amber' | 'red' =
    kpis.netLiability === 0 ? 'green' : kpis.netLiability > 0 ? 'amber' : 'red';

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
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={monthly.length} />}
    >
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
          hint="Collected − Paid"
        />
        <StatCard
          label="Pending filings"
          value={String(kpis.pendingFilings)}
          tone={kpis.pendingFilings > 0 ? 'amber' : 'green'}
          hint="Drafts + due"
        />
      </div>

      <ZoruCard className="p-6">
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
      </ZoruCard>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Collected</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Paid</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Net</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={4} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                    No data.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.period} className="border-zoru-line">
                    <ZoruTableCell className="font-medium text-zoru-ink">{r.period}</ZoruTableCell>
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
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

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
