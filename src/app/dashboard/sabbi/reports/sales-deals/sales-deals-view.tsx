'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const SalesLineChart = dynamic(
  () => import('./sales-deals-charts').then((mod) => mod.SalesLineChart),
  { ssr: false }
);
const SalesPieChart = dynamic(
  () => import('./sales-deals-charts').then((mod) => mod.SalesPieChart),
  { ssr: false }
);
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
} from '@/components/sabcrm/20ui/compat';
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
  const [isDragOver, setIsDragOver] = React.useState(false);

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
      {/* Draggable Stages for Interactive Filtering */}
      <div className="flex flex-wrap gap-2 items-center rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
        <span className="text-[12px] font-medium text-[var(--st-text-secondary)] mr-2">
          Drag stage to filter:
        </span>
        {funnel.map((f) => (
          <Badge
            key={f.stage}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('stage', f.stage)}
            className="cursor-grab active:cursor-grabbing"
            variant={stageInput === f.stage ? 'default' : 'secondary'}
            onClick={() => setStageInput(f.stage)}
          >
            {f.stage} ({f.count})
          </Badge>
        ))}
      </div>

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
        <label 
          className={`flex flex-col gap-1 rounded-lg p-1 transition-colors ${isDragOver ? 'bg-[var(--st-text)]/20 ring-1 ring-primary' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const dropped = e.dataTransfer.getData('stage');
            if (dropped) setStageInput(dropped);
          }}
        >
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Stage
          </span>
          <input
            type="text"
            value={stageInput}
            onChange={(e) => setStageInput(e.target.value)}
            placeholder="Drop here or type"
            className="h-9 w-32 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Pipeline
          </span>
          <input
            type="text"
            value={pipelineInput}
            onChange={(e) => setPipelineInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-28 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
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
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Won vs lost by month
            </h2>
          </div>
          <SalesLineChart lineData={lineData} />
        </Card>

        <Card>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Stage distribution
            </h2>
          </div>
          <SalesPieChart pieData={pieData} />
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                  Deal
                </ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                  Stage
                </ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                  Owner
                </ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                  Pipeline
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                  Value
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                  Created
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {deals.length === 0 ? (
                <ZoruTableRow className="border-[var(--st-border)]">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No deals.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                deals.map((d) => (
                  <ZoruTableRow key={d.id} className="border-[var(--st-border)]">
                    <ZoruTableCell className="font-medium text-[var(--st-text)]">
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
                    <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                      {d.owner}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                      {d.pipeline}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(d.value)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text-secondary)]">
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
