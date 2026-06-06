'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ReportHeader } from '../_components/report-header';
import { StatCard, fmtMoney, fmtNumber } from '../_components/report-toolbar';
import type { TopProductRow } from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface Props {
  rows: TopProductRow[];
  page: number;
  limit: number;
}

const HEADERS = ['Rank', 'Product', 'Units', 'Revenue', 'Avg Unit Price'];

export function TopProductsView({ rows, page, limit }: Props) {
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const top = rows[0];
  const avgUnitPrice = totalUnits ? totalRevenue / totalUnits : 0;

  const chartData = rows.slice(0, 10).map((r) => ({
    name:
      r.productName.length > 22 ? `${r.productName.slice(0, 20)}…` : r.productName,
    revenue: Math.round(r.revenue),
    units: r.units,
  }));

  const exportRows = React.useMemo(
    () =>
      rows.map((r, i) => ({
        Rank: i + 1,
        Product: r.productName,
        Units: r.units,
        Revenue: r.revenue,
        'Avg Unit Price': r.units ? r.revenue / r.units : 0,
      })),
    [rows],
  );

  const onCsv = React.useCallback(() => {
    downloadCsv(`top-products-${dateStamp()}.csv`, HEADERS, exportRows);
  }, [exportRows]);

  const onXlsx = React.useCallback(
    () => downloadXlsx(`top-products-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Top Products'),
    [exportRows],
  );

  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;

  const productHref = (name: string) =>
    `/dashboard/crm/products?q=${encodeURIComponent(name)}`;

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader onExportCsv={onCsv} onExportXlsx={onXlsx} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total units" value={fmtNumber(totalUnits)} />
        <StatCard label="Total revenue" value={fmtMoney(totalRevenue)} tone="green" />
        <StatCard
          label="Top product"
          value={top ? top.productName : '—'}
          hint={top ? fmtMoney(top.revenue) : undefined}
          tone="blue"
        />
        <StatCard label="Avg unit price" value={fmtMoney(avgUnitPrice)} />
      </div>

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
              <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => fmtNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  formatter={(v: number, name: string) => (name === 'revenue' ? fmtMoney(v) : fmtNumber(v))}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="w-10 text-[var(--st-text-secondary)]">#</Th>
                <Th className="text-[var(--st-text-secondary)]">Product</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Units</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Revenue</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Avg price</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td colSpan={5} className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]">
                    No products sold in this range.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => (
                  <Tr key={`${r.productName}-${start + i}`} className="border-[var(--st-border)]">
                    <Td className="text-[var(--st-text-secondary)]">{start + i + 1}</Td>
                    <Td className="font-medium text-[var(--st-text)]">
                      <EntityRowLink href={productHref(r.productName)} label={r.productName} />
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.units)}
                    </Td>
                    <Td className="text-right text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(r.revenue)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.units ? r.revenue / r.units : 0)}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
          <PaginationBar page={page} limit={limit} hasMore={hasMore} total={rows.length} />
        </div>
      </Card>
    </div>
  );
}
