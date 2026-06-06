'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { PackageSearch } from 'lucide-react';
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
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Button,
  Field,
  Input,
  EmptyState,
} from '@/components/sabcrm/20ui';
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
  )[0]?.[0] ?? '-';

  const chartData = rows.slice(0, 10).map((r) => ({
    name:
      r.productName.length > 20
        ? `${r.productName.slice(0, 18)}...`
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
        className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        <Field label="From">
          <Input type="date" name="from" defaultValue={from} inputSize="sm" />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={to} inputSize="sm" />
        </Field>
        <Field label="Category">
          <Input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            placeholder="Any"
            inputSize="sm"
            className="w-32"
          />
        </Field>
        <Field label="Min units">
          <Input
            type="number"
            min={0}
            value={minQtyInput}
            onChange={(e) => setMinQtyInput(e.target.value)}
            placeholder="0"
            inputSize="sm"
            className="w-24"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm" disabled={isPending}>
          Apply
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCsv}>
            CSV
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onXlsx}>
            XLSX
          </Button>
        </div>
      </form>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Top product" value={top ? top.productName : '-'} hint={top ? fmtMoney(top.revenue) : undefined} tone="blue" />
        <StatCard label="Total revenue" value={fmtMoney(totalRevenue)} tone="green" />
        <StatCard label="Total units sold" value={fmtNumber(totalUnits)} />
        <StatCard label="Best category" value={bestCategory} />
      </div>

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 products by revenue</CardTitle>
        </CardHeader>
        {chartData.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No product sales in this range"
            description="Adjust the date range or filters to see top products."
            size="sm"
          />
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 24, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--st-border)"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtNumber(v)}
                  stroke="var(--st-text-secondary)"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  stroke="var(--st-text-secondary)"
                  fontSize={11}
                />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === 'revenue' ? fmtMoney(v) : fmtNumber(v)
                  }
                  contentStyle={{
                    background: 'var(--st-bg)',
                    border: '1px solid var(--st-border)',
                    borderRadius: 'var(--st-radius)',
                    fontSize: 12,
                    color: 'var(--st-text)',
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--st-accent)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Data table */}
      <Card>
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th className="w-10">#</Th>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th align="right">Units</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Avg price</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr>
                  <Td colSpan={6}>
                    <EmptyState
                      icon={PackageSearch}
                      title="No products sold in this range"
                      description="Adjust the date range or filters to see results."
                      size="sm"
                    />
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => (
                  <Tr key={`${r.productName}-${start + i}`}>
                    <Td className="text-[var(--st-text-secondary)]">
                      {start + i + 1}
                    </Td>
                    <Td className="font-medium text-[var(--st-text)]">
                      <EntityRowLink
                        href={productHref(r.productName)}
                        label={r.productName}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.category}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.units)}
                    </Td>
                    <Td align="right" className="text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(r.revenue)}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.avgPrice)}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
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
