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
  CardHeader,
  CardTitle,
  CardBody,
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
  const [fromInput, setFromInput] = React.useState(from || '');
  const [toInput, setToInput] = React.useState(to || '');
  const [minRevInput, setMinRevInput] = React.useState(String(minRevenue || ''));
  const [industryInput, setIndustryInput] = React.useState(industry || '');

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalClients = rows.length;
  const avg = totalClients ? totalRevenue / totalClients : 0;
  const top = rows[0];

  const chartData = rows.slice(0, 10).map((r) => ({
    name:
      r.clientName.length > 18
        ? `${r.clientName.slice(0, 16)}...`
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
    if (fromInput) params.set('from', fromInput);
    else params.delete('from');
    if (toInput) params.set('to', toInput);
    else params.delete('to');
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
        className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        <Field label="From">
          <Input
            type="date"
            name="from"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            inputSize="sm"
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            name="to"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            inputSize="sm"
          />
        </Field>
        <Field label="Min revenue">
          <Input
            type="number"
            min={0}
            value={minRevInput}
            onChange={(e) => setMinRevInput(e.target.value)}
            placeholder="0"
            inputSize="sm"
            className="w-28"
          />
        </Field>
        <Field label="Industry">
          <Input
            type="text"
            value={industryInput}
            onChange={(e) => setIndustryInput(e.target.value)}
            placeholder="Any"
            inputSize="sm"
            className="w-32"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm" loading={isPending}>
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
        <StatCard label="Total clients" value={fmtNumber(totalClients)} />
        <StatCard
          label="Total revenue"
          value={fmtMoney(totalRevenue)}
          tone="green"
        />
        <StatCard
          label="Top client"
          value={top ? top.clientName : '-'}
          hint={top ? fmtMoney(top.revenue) : undefined}
          tone="blue"
        />
        <StatCard label="Avg per client" value={fmtMoney(avg)} />
      </div>

      {/* Bar chart: top 10 by revenue */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 clients by revenue</CardTitle>
        </CardHeader>
        <CardBody>
          {chartData.length === 0 ? (
            <EmptyState
              title="No revenue in this range"
              description="Adjust the date range or filters to see client revenue."
            />
          ) : (
            <div className="h-80 w-full">
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
                    width={140}
                    stroke="var(--st-text-secondary)"
                    fontSize={11}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtMoney(v)}
                    contentStyle={{
                      background: 'var(--st-bg-secondary)',
                      border: '1px solid var(--st-border)',
                      borderRadius: 'var(--st-radius)',
                      fontSize: 12,
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
        </CardBody>
      </Card>

      {/* Data table */}
      <Card padding="none">
        <div className="overflow-x-auto rounded-[var(--st-radius)]">
          <Table>
            <THead>
              <Tr>
                <Th width={40}>#</Th>
                <Th>Client</Th>
                <Th>Industry</Th>
                <Th align="right">Orders</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Avg order</Th>
                <Th align="right">Last order</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr>
                  <Td colSpan={7} align="center">
                    <EmptyState
                      title="No clients in this range"
                      description="Try widening the date range or lowering the minimum revenue."
                    />
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => (
                  <Tr key={`${r.clientId || 'none'}-${start + i}`}>
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
                    <Td align="right" className="text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.invoices)}
                    </Td>
                    <Td
                      align="right"
                      className="text-[13px] font-medium text-[var(--st-text)]"
                    >
                      {fmtMoney(r.revenue)}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.avgOrderValue)}
                    </Td>
                    <Td
                      align="right"
                      className="text-[13px] text-[var(--st-text-secondary)]"
                    >
                      {r.lastOrderDate || '-'}
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
