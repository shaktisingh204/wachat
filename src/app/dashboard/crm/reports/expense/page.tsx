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
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { FyReportToolbar } from '../_components/fy-report-toolbar';
import { MonthlyTrendLine, CategoryPie } from '../_components/finance-charts';
import { getExpenseReportDeep } from '@/app/actions/worksuite/reports.actions';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function ExpenseReportPage(props: {
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
  const { kpis, monthly, byCategory, rows, fyLabel } = await getExpenseReportDeep(anchor);

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = ['Date', 'Category', 'Description', 'Reference', 'Amount', 'Tax', 'Status'];
  const exportRows = rows.map((r) => ({
    Date: r.date,
    Category: r.category,
    Description: r.description,
    Reference: r.reference,
    Amount: r.amount,
    Tax: r.taxAmount,
    Status: r.status,
  }));

  const yoyTone: 'green' | 'red' | 'default' =
    kpis.yoyChangePct > 0 ? 'red' : kpis.yoyChangePct < 0 ? 'green' : 'default';

  return (
    <EntityListShell
      title="Expense Report"
      subtitle={`Expenses by month and category · ${fyLabel}`}
      primaryAction={
        <FyReportToolbar
          from={sp.from}
          to={sp.to}
          exportFilename="expense-report"
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} total={rows.length} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total expenses (FY)" value={fmtMoney(kpis.totalFY)} tone="red" hint={fyLabel} />
        <StatCard label="This month" value={fmtMoney(kpis.thisMonth)} />
        <StatCard
          label="YoY change"
          value={fmtPct(kpis.yoyChangePct)}
          tone={yoyTone}
          hint="vs. prior FY"
        />
        <StatCard
          label="Top category"
          value={kpis.topCategory}
          hint={fmtMoney(kpis.topCategoryTotal)}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ZoruCard className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">Monthly trend</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Expense run-rate per month.</p>
          </div>
          {monthly.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No expenses for this FY.</div>
          ) : (
            <MonthlyTrendLine data={monthly} color="#d97cc4" label="Expense" />
          )}
        </ZoruCard>
        <ZoruCard className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">By category</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Where the money goes.</p>
          </div>
          {byCategory.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">No category data.</div>
          ) : (
            <CategoryPie data={byCategory} label="Category" />
          )}
        </ZoruCard>
      </div>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Reference</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Amount</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Tax</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                    No expenses for this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.id} className="border-zoru-line">
                    <ZoruTableCell className="text-[13px] text-zoru-ink">{r.date}</ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">{r.category}</ZoruTableCell>
                    <ZoruTableCell className="max-w-[280px] truncate text-[13px] text-zoru-ink-muted">
                      <EntityRowLink
                        href={`/dashboard/crm/purchases/expenses/${r.id}`}
                        label={r.description || '(no description)'}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">{r.reference || '—'}</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-danger-ink">
                      {fmtMoney(r.amount)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                      {fmtMoney(r.taxAmount)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="secondary">{r.status || '—'}</ZoruBadge>
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
