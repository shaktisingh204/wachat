export const dynamic = 'force-dynamic';

import { Card, Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtPct } from '../_components/report-toolbar';
import { MonthlyTrendLine, CategoryPie } from '../_components/finance-charts';
import { getExpenseReportDeepDB } from '../_components/finance-data';
import { ExpenseFilterToolbar } from './_components/expense-filter-toolbar';

const PAGE_SIZES = [10, 20, 50, 100];

export default async function ExpenseReportPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    category?: string;
    vendor?: string;
    expenseType?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = PAGE_SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const data = await getExpenseReportDeepDB({
    fyAnchor: sp.from,
    category: sp.category,
    vendor: sp.vendor,
    expenseType: sp.expenseType,
    page,
    limit,
  });

  if (!data) return null;
  const { kpis, monthly, byCategory, rows: pageRows, totalCount, fyLabel } = data;

  const hasMore = page * limit < totalCount;

  const exportHeaders = [
    'Date',
    'Category',
    'Description',
    'Reference',
    'Amount',
    'Tax',
    'Status',
  ];
  const exportRows = pageRows.map((r) => ({
    Date: r.date,
    Category: r.category,
    Description: r.description,
    Reference: r.reference,
    Amount: r.amount,
    Tax: r.taxAmount,
    Status: r.status,
  }));

  const yoyTone: 'green' | 'red' | 'default' =
    kpis.yoyChangePct > 0
      ? 'red'
      : kpis.yoyChangePct < 0
        ? 'green'
        : 'default';

  return (
    <EntityListShell
      title="Expense Report"
      subtitle={`Expenses by month and category · ${fyLabel}`}
      primaryAction={
        <ExpenseFilterToolbar
          from={sp.from}
          to={sp.to}
          category={sp.category ?? ''}
          vendor={sp.vendor ?? ''}
          expenseType={sp.expenseType ?? ''}
          exportHeaders={exportHeaders}
          exportRows={exportRows}
        />
      }
      pagination={
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={hasMore}
          total={totalCount}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total expenses (FY)"
          value={fmtMoney(kpis.totalFY)}
          tone="red"
          hint={fyLabel}
        />
        <StatCard label="This month" value={fmtMoney(kpis.thisMonth)} />
        <StatCard
          label="YoY change"
          value={fmtPct(kpis.yoyChangePct)}
          tone={yoyTone}
          hint={`Last YTD: ${fmtMoney((kpis as any).lastYtdTotal || 0)}`}
        />
        <StatCard
          label="Top category"
          value={kpis.topCategory}
          hint={fmtMoney(kpis.topCategoryTotal)}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Monthly trend
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
              Expense run-rate per month.
            </p>
          </div>
          {monthly.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              No expenses for this FY.
            </div>
          ) : (
            <MonthlyTrendLine
              data={monthly}
              color="#d97cc4"
              label="Expense"
            />
          )}
        </Card>
        <Card className="p-6">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              By category
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
              Where the money goes.
            </p>
          </div>
          {byCategory.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              No category data.
            </div>
          ) : (
            <CategoryPie data={byCategory} label="Category" />
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">
                  Date
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Category
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Description
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Reference
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Amount
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Tax
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Status
                </Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No expenses for this range.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r) => (
                  <Tr key={r.id} className="border-[var(--st-border)]">
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.date}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.category}
                    </Td>
                    <Td className="max-w-[280px] truncate text-[13px] text-[var(--st-text-secondary)]">
                      <EntityRowLink
                        href={`/dashboard/crm/purchases/expenses/${r.id}`}
                        label={r.description || '(no description)'}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.reference || '—'}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-danger)]">
                      {fmtMoney(r.amount)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                      {fmtMoney(r.taxAmount)}
                    </Td>
                    <Td>
                      <Badge variant="secondary">
                        {r.status || '—'}
                      </Badge>
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
