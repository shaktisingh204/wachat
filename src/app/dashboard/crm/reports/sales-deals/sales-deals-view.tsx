'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Badge,
  Button,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtMoney, fmtNumber } from '../_components/report-toolbar';
import type { FunnelRow, DealsByMonthRow, DealsFilteredRow } from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface Props {
  funnel: FunnelRow[];
  byMonth: DealsByMonthRow[];
  deals: DealsFilteredRow[];
  total: number;
  page: number;
  limit: number;
  from?: string;
  to?: string;
  stage: string;
  pipeline: string;
}

const HEADERS = ['Deal', 'Stage', 'Value', 'Owner', 'Pipeline', 'Account ID', 'Created'];

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

export function SalesDealsView({
  funnel,
  byMonth,
  deals,
  total,
  page,
  limit,
  from,
  to,
  stage,
  pipeline,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [stageInput, setStageInput] = React.useState(stage || '');
  const [pipelineInput, setPipelineInput] = React.useState(pipeline || '');

  const totalDeals = funnel.reduce((s, r) => s + r.count, 0);
  const totalValue = funnel.reduce((s, r) => s + r.value, 0);
  const won = funnel.find((r) => isWonStage(r.stage));
  const lost = funnel.find((r) => isLostStage(r.stage));
  const wonCount = won?.count ?? 0;
  const lostCount = lost?.count ?? 0;
  const winRate =
    wonCount + lostCount > 0
      ? (wonCount / (wonCount + lostCount)) * 100
      : 0;

  const exportRows = React.useMemo(
    () =>
      deals.map((d) => ({
        Deal: d.name,
        Stage: d.stage,
        Value: d.value,
        Owner: d.owner,
        Pipeline: d.pipeline,
        'Account ID': d.accountId ?? '',
        Created: d.createdAt ?? '',
      })),
    [deals],
  );

  const onCsv = React.useCallback(
    () => downloadCsv(`sales-deals-${dateStamp()}.csv`, HEADERS, exportRows),
    [exportRows],
  );

  const onXlsx = React.useCallback(
    () =>
      downloadXlsx(
        `sales-deals-${dateStamp()}.xlsx`,
        HEADERS,
        exportRows,
        'Deals',
      ),
    [exportRows],
  );

  const pushFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (stageInput) params.set('stage', stageInput);
    else params.delete('stage');
    if (pipelineInput) params.set('pipeline', pipelineInput);
    else params.delete('pipeline');
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const hasMore = page * limit < total;

  const lineData = byMonth.map((r) => ({
    period: r.period,
    Won: r.won,
    Lost: r.lost,
  }));

  const pieData = funnel.map((r) => ({ name: r.stage, value: r.count }));

  return (
    <div className="flex flex-col gap-4">
      {/* Filter row */}
      <form
        onSubmit={pushFilters}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Stage
          </span>
          <input
            type="text"
            value={stageInput}
            onChange={(e) => setStageInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-28 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Pipeline
          </span>
          <input
            type="text"
            value={pipelineInput}
            onChange={(e) => setPipelineInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-28 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total deals" value={fmtNumber(totalDeals)} />
        <StatCard label="Won" value={fmtNumber(wonCount)} tone="green" />
        <StatCard label="Lost" value={fmtNumber(lostCount)} tone="red" />
        <StatCard
          label="Win rate"
          value={`${winRate.toFixed(1)}%`}
          tone={winRate >= 50 ? 'green' : 'amber'}
        />
        <StatCard
          label="Pipeline value"
          value={fmtMoney(totalValue)}
          tone="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Won vs lost by month
            </h2>
          </div>
          {lineData.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No closed deals in this range.
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart
                  data={lineData}
                  margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="period"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="Won"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Lost"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
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
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label={(d: { name?: string }) => d.name ?? ''}
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={`pie-${i}`}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">
                  Deal
                </ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">
                  Stage
                </ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">
                  Owner
                </ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">
                  Pipeline
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Value
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Created
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {deals.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No deals.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                deals.map((d) => (
                  <ZoruTableRow key={d.id} className="border-border">
                    <ZoruTableCell className="font-medium text-foreground">
                      <EntityRowLink
                        href={`/dashboard/crm/sales-crm/deals/${d.id}`}
                        label={d.name}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge
                        variant={
                          isWonStage(d.stage)
                            ? 'default'
                            : isLostStage(d.stage)
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {d.stage}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">
                      {d.owner}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">
                      {d.pipeline}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-foreground">
                      {fmtMoney(d.value)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleDateString()
                        : '—'}
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
            total={total}
          />
        </div>
      </Card>
    </div>
  );
}
