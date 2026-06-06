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
import { Card, Table, TBody, Td, Th, THead, Tr, Button } from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtNumber } from '../_components/report-toolbar';
import type { TopClientDeepRow } from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface Props {
  rows: TopClientDeepRow[];
  page: number;
  limit: number;
  from?: string;
  to?: string;
  minRevenue: number;
  industry: string;
}

const HEADERS = [
  'Rank',
  'Client',
  'Industry',
  'Orders',
  'Revenue',
  'Avg Order Value',
  'Last Order',
];

export function TopClientsReport({
  rows,
  page,
  limit,
  from,
  to,
  minRevenue,
  industry,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [isPending, startTransition] = React.useTransition();
  const [minRevInput, setMinRevInput] = React.useState(String(minRevenue || ''));
  const [industryInput, setIndustryInput] = React.useState(industry || '');

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalClients = rows.length;
  const avg = totalClients ? totalRevenue / totalClients : 0;
  const top = rows[0];

  const chartData = rows.slice(0, 10).map((r) => ({
    name:
      r.clientName.length > 18
        ? `${r.clientName.slice(0, 16)}…`
        : r.clientName,
    revenue: Math.round(r.revenue),
  }));

  const exportRows = React.useMemo(
    () =>
      rows.map((r, i) => ({
        Rank: i + 1,
        Client: r.clientName,
        Industry: r.industry,
        Orders: r.invoices,
        Revenue: r.revenue,
        'Avg Order Value': Math.round(r.avgOrderValue),
        'Last Order': r.lastOrderDate,
      })),
    [rows],
  );

  const onCsv = React.useCallback(
    () => downloadCsv(`top-clients-${dateStamp()}.csv`, HEADERS, exportRows),
    [exportRows],
  );

  const onXlsx = React.useCallback(
    () =>
      downloadXlsx(
        `top-clients-${dateStamp()}.xlsx`,
        HEADERS,
        exportRows,
        'Top Clients',
      ),
    [exportRows],
  );

  const pushFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (minRevInput) params.set('minRevenue', minRevInput);
    else params.delete('minRevenue');
    if (industryInput) params.set('industry', industryInput);
    else params.delete('industry');
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Date range + filters */}
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
            Min revenue
          </span>
          <input
            type="number"
            min={0}
            value={minRevInput}
            onChange={(e) => setMinRevInput(e.target.value)}
            placeholder="0"
            className="h-9 w-28 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Industry
          </span>
          <input
            type="text"
            value={industryInput}
            onChange={(e) => setIndustryInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-32 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
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
        <StatCard label="Total clients" value={fmtNumber(totalClients)} />
        <StatCard
          label="Total revenue"
          value={fmtMoney(totalRevenue)}
          tone="green"
        />
        <StatCard
          label="Top client"
          value={top ? top.clientName : '—'}
          hint={top ? fmtMoney(top.revenue) : undefined}
          tone="blue"
        />
        <StatCard label="Avg per client" value={fmtMoney(avg)} />
      </div>

      {/* Bar chart: top 10 by revenue */}
      <Card>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
            Top 10 clients by revenue
          </h2>
        </div>
        {chartData.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
            No revenue in this range.
          </div>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
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
                  width={140}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  formatter={(v: number) => fmtMoney(v)}
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
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="w-10 text-[var(--st-text-secondary)]">
                  #
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Client
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Industry
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Orders
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Revenue
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Avg order
                </Th>
                <Th className="text-right text-[var(--st-text-secondary)]">
                  Last order
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
                    No clients in this range.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => (
                  <Tr
                    key={`${r.clientId || 'none'}-${start + i}`}
                    className="border-[var(--st-border)]"
                  >
                    <Td className="text-[var(--st-text-secondary)]">
                      {start + i + 1}
                    </Td>
                    <Td className="font-medium text-[var(--st-text)]">
                      {r.clientId ? (
                        <EntityRowLink
                          href={`/dashboard/crm/accounts/${r.clientId}`}
                          label={r.clientName}
                        />
                      ) : (
                        r.clientName
                      )}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.industry}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.invoices)}
                    </Td>
                    <Td className="text-right text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(r.revenue)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.avgOrderValue)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                      {r.lastOrderDate || '—'}
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
