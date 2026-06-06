'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Button,
} from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtNumber } from '../_components/report-toolbar';
import type { TopProductDeepRow } from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface Props {
  rows: TopProductDeepRow[];
  page: number;
  limit: number;
  from?: string;
  to?: string;
  category: string;
  minQuantity: number;
}

const HEADERS = [
  'Rank',
  'Product',
  'Category',
  'Units sold',
  'Revenue',
  'Avg price',
];

export function TopProductsReport({
  rows,
  page,
  limit,
  from,
  to,
  category,
  minQuantity,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [categoryInput, setCategoryInput] = React.useState(category || '');
  const [minQtyInput, setMinQtyInput] = React.useState(
    String(minQuantity || ''),
  );

  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const top = rows[0];

  // Derived: unique categories for a best-category KPI
  const categoryRevMap = new Map<string, number>();
  for (const r of rows) {
    categoryRevMap.set(
      r.category,
      (categoryRevMap.get(r.category) ?? 0) + r.revenue,
    );
  }
  const bestCategory = [...categoryRevMap.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? '—';

  const chartData = rows.slice(0, 10).map((r) => ({
    name:
      r.productName.length > 20
        ? `${r.productName.slice(0, 18)}…`
        : r.productName,
    revenue: Math.round(r.revenue),
    units: r.units,
  }));

  const exportRows = React.useMemo(
    () =>
      rows.map((r, i) => ({
        Rank: i + 1,
        Product: r.productName,
        Category: r.category,
        'Units sold': r.units,
        Revenue: r.revenue,
        'Avg price': Math.round(r.avgPrice),
      })),
    [rows],
  );

  const onCsv = React.useCallback(
    () =>
      downloadCsv(`top-products-${dateStamp()}.csv`, HEADERS, exportRows),
    [exportRows],
  );

  const onXlsx = React.useCallback(
    () =>
      downloadXlsx(
        `top-products-${dateStamp()}.xlsx`,
        HEADERS,
        exportRows,
        'Top Products',
      ),
    [exportRows],
  );

  const pushFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (categoryInput) params.set('category', categoryInput);
    else params.delete('category');
    if (minQtyInput) params.set('minQty', minQtyInput);
    else params.delete('minQty');
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;

  const productHref = (name: string) =>
    `/dashboard/crm/products?q=${encodeURIComponent(name)}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter row */}
      <form
        onSubmit={pushFilters}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Category
          </span>
          <input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-32 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Min units
          </span>
          <input
            type="number"
            min={0}
            value={minQtyInput}
            onChange={(e) => setMinQtyInput(e.target.value)}
            placeholder="0"
            className="h-9 w-24 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>
        <Button type="submit" size="sm" disabled={isPending}>
          Apply
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCsv}
          >
            CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onXlsx}
          >
            XLSX
          </Button>
        </div>
      </form>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Top product" value={top ? top.productName : '—'} hint={top ? fmtMoney(top.revenue) : undefined} tone="blue" />
        <StatCard label="Total revenue" value={fmtMoney(totalRevenue)} tone="green" />
        <StatCard label="Total units sold" value={fmtNumber(totalUnits)} />
        <StatCard label="Best category" value={bestCategory} />
      </div>

      {/* Bar chart */}
      <Card>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
            Top 10 products by revenue
          </h2>
        </div>
        {chartData.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
            No product sales in this range.
          </div>
        ) : (
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 24, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtNumber(v)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === 'revenue' ? fmtMoney(v) : fmtNumber(v)
                  }
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Data table */}
      <Card>
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                <ZoruTableHead className="w-10 text-[var(--st-text-secondary)]">
                  #
                </ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                  Product
                </ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                  Category
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                  Units
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                  Revenue
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                  Avg price
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-[var(--st-border)]">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No products sold in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r, i) => (
                  <ZoruTableRow
                    key={`${r.productName}-${start + i}`}
                    className="border-[var(--st-border)]"
                  >
                    <ZoruTableCell className="text-[var(--st-text-secondary)]">
                      {start + i + 1}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-medium text-[var(--st-text)]">
                      <EntityRowLink
                        href={productHref(r.productName)}
                        label={r.productName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.category}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.units)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(r.revenue)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.avgPrice)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
          <PaginationBar
            page={page}
            limit={limit}
            hasMore={hasMore}
            total={rows.length}
          />
        </div>
      </Card>
    </div>
  );
}
