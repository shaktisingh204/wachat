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
import {
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ReportHeader } from '../_components/report-header';
import { StatCard, fmtMoney, fmtNumber } from '../_components/report-toolbar';
import type { TopClientRow } from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface Props {
  rows: TopClientRow[];
  page: number;
  limit: number;
}

const HEADERS = ['Rank', 'Client', 'Client ID', 'Invoices', 'Revenue'];

export function TopClientsView({ rows, page, limit }: Props) {
  const totalClients = rows.length;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const top = rows[0];
  const avg = totalClients ? totalRevenue / totalClients : 0;

  const chartData = rows.slice(0, 10).map((r) => ({
    name:
      r.clientName.length > 20 ? `${r.clientName.slice(0, 18)}…` : r.clientName,
    revenue: Math.round(r.revenue),
  }));

  const exportRows = React.useMemo(
    () =>
      rows.map((r, i) => ({
        Rank: i + 1,
        Client: r.clientName,
        'Client ID': r.clientId,
        Invoices: r.invoices,
        Revenue: r.revenue,
      })),
    [rows],
  );

  const onCsv = React.useCallback(() => {
    downloadCsv(`top-clients-${dateStamp()}.csv`, HEADERS, exportRows);
  }, [exportRows]);

  const onXlsx = React.useCallback(
    () => downloadXlsx(`top-clients-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Top Clients'),
    [exportRows],
  );

  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader onExportCsv={onCsv} onExportXlsx={onXlsx} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clients" value={fmtNumber(totalClients)} />
        <StatCard label="Total revenue" value={fmtMoney(totalRevenue)} tone="green" />
        <StatCard
          label="Top client"
          value={top ? top.clientName : '—'}
          hint={top ? fmtMoney(top.revenue) : undefined}
          tone="blue"
        />
        <StatCard label="Avg per client" value={fmtMoney(avg)} />
      </div>

      <Card>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">
            Top 10 clients by revenue
          </h2>
        </div>
        {chartData.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            No revenue in this range.
          </div>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => fmtNumber(v)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  formatter={(v: number) => fmtMoney(v)}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="w-10 text-muted-foreground">#</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Client</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Invoices</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Revenue</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell colSpan={4} className="h-20 text-center text-[13px] text-muted-foreground">
                    No clients in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r, i) => (
                  <ZoruTableRow key={`${r.clientId || 'none'}-${start + i}`} className="border-border">
                    <ZoruTableCell className="text-muted-foreground">{start + i + 1}</ZoruTableCell>
                    <ZoruTableCell className="font-medium text-foreground">
                      {r.clientId ? (
                        <EntityRowLink href={`/dashboard/crm/accounts/${r.clientId}`} label={r.clientName} />
                      ) : (
                        r.clientName
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {fmtNumber(r.invoices)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-emerald-500">
                      {fmtMoney(r.revenue)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
          <PaginationBar page={page} limit={limit} hasMore={hasMore} total={rows.length} />
        </div>
      </Card>
    </div>
  );
}
