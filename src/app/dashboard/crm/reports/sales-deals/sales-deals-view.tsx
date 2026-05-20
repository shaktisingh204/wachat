'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ReportHeader } from '../_components/report-header';
import { StatCard, fmtMoney, fmtNumber } from '../_components/report-toolbar';
import type { FunnelRow, DealsByMonthRow } from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface DealRow {
  id: string;
  name: string;
  stage: string;
  value: number;
  accountId?: string;
  createdAt: string | null;
}

interface Props {
  funnel: FunnelRow[];
  byMonth: DealsByMonthRow[];
  deals: DealRow[];
  total: number;
  page: number;
  limit: number;
}

const HEADERS = ['Deal', 'Stage', 'Value', 'Account ID', 'Created'];

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
];

function isWonStage(s: string) {
  const v = s.toLowerCase();
  return v === 'won' || v === 'closed won' || v === 'closed-won';
}

function isLostStage(s: string) {
  const v = s.toLowerCase();
  return v === 'lost' || v === 'closed lost' || v === 'closed-lost';
}

export function SalesDealsView({ funnel, byMonth, deals, total, page, limit }: Props) {
  const totalDeals = funnel.reduce((s, r) => s + r.count, 0);
  const totalValue = funnel.reduce((s, r) => s + r.value, 0);
  const won = funnel.find((r) => isWonStage(r.stage));
  const lost = funnel.find((r) => isLostStage(r.stage));
  const wonCount = won?.count ?? 0;
  const lostCount = lost?.count ?? 0;
  const winRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

  const exportRows = React.useMemo(
    () =>
      deals.map((d) => ({
        Deal: d.name,
        Stage: d.stage,
        Value: d.value,
        'Account ID': d.accountId ?? '',
        Created: d.createdAt ?? '',
      })),
    [deals],
  );

  const onCsv = React.useCallback(() => {
    downloadCsv(`sales-deals-${dateStamp()}.csv`, HEADERS, exportRows);
  }, [exportRows]);

  const onXlsx = React.useCallback(
    () => downloadXlsx(`sales-deals-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Deals'),
    [exportRows],
  );

  const hasMore = page * limit < total;

  const lineData = byMonth.map((r) => ({
    period: r.period,
    Won: r.won,
    Lost: r.lost,
  }));

  const pieData = funnel.map((r) => ({ name: r.stage, value: r.count }));

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader onExportCsv={onCsv} onExportXlsx={onXlsx} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total deals" value={fmtNumber(totalDeals)} />
        <StatCard label="Won" value={fmtNumber(wonCount)} tone="green" />
        <StatCard label="Lost" value={fmtNumber(lostCount)} tone="red" />
        <StatCard
          label="Win rate"
          value={`${winRate.toFixed(1)}%`}
          tone={winRate >= 50 ? 'green' : 'amber'}
        />
        <StatCard label="Pipeline value" value={fmtMoney(totalValue)} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ZoruCard className="lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Deals closed by month
            </h2>
          </div>
          {lineData.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No closed deals in this range.
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={lineData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Won" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Lost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ZoruCard>

        <ZoruCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Stage distribution
            </h2>
          </div>
          {pieData.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No deals.
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(d: { name?: string }) => d.name ?? ''}>
                    {pieData.map((_, i) => (
                      <Cell key={`pie-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ZoruCard>
      </div>

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Deal</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Stage</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Value</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Created</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {deals.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell colSpan={4} className="h-20 text-center text-[13px] text-muted-foreground">
                    No deals.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                deals.map((d) => (
                  <ZoruTableRow key={d.id} className="border-border">
                    <ZoruTableCell className="font-medium text-foreground">
                      <EntityRowLink href={`/dashboard/crm/sales-crm/deals/${d.id}`} label={d.name} />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant={isWonStage(d.stage) ? 'default' : isLostStage(d.stage) ? 'destructive' : 'secondary'}
                      >
                        {d.stage}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-foreground">
                      {fmtMoney(d.value)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
          <PaginationBar page={page} limit={limit} hasMore={hasMore} total={total} />
        </div>
      </ZoruCard>
    </div>
  );
}
