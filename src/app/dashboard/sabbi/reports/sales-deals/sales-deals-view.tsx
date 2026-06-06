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
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  Button,
  Field,
  Input,
} from '@/components/sabcrm/20ui';
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
      <div className="flex flex-wrap gap-2 items-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
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
        className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        <Field label="From">
          <Input type="date" name="from" defaultValue={from} inputSize="sm" />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={to} inputSize="sm" />
        </Field>
        <div
          className={`rounded-[var(--st-radius)] p-1 transition-colors ${isDragOver ? 'bg-[var(--st-accent-soft)] ring-1 ring-[var(--st-accent)]' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const dropped = e.dataTransfer.getData('stage');
            if (dropped) setStageInput(dropped);
          }}
        >
          <Field label="Stage">
            <Input
              type="text"
              value={stageInput}
              onChange={(e) => setStageInput(e.target.value)}
              placeholder="Drop here or type"
              inputSize="sm"
              className="w-32"
            />
          </Field>
        </div>
        <Field label="Pipeline">
          <Input
            type="text"
            value={pipelineInput}
            onChange={(e) => setPipelineInput(e.target.value)}
            placeholder="Any"
            inputSize="sm"
            className="w-28"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm" disabled={isPending}>
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
          <CardHeader className="mb-3">
            <CardTitle>Won vs lost by month</CardTitle>
          </CardHeader>
          <SalesLineChart lineData={lineData} />
        </Card>

        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Stage distribution</CardTitle>
          </CardHeader>
          <SalesPieChart pieData={pieData} />
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">
                  Deal
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Stage
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Owner
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Pipeline
                </Th>
                <Th align="right" className="text-[var(--st-text-secondary)]">
                  Value
                </Th>
                <Th align="right" className="text-[var(--st-text-secondary)]">
                  Created
                </Th>
              </Tr>
            </THead>
            <TBody>
              {deals.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={6}
                    align="center"
                    className="h-20 text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No deals.
                  </Td>
                </Tr>
              ) : (
                deals.map((d) => (
                  <Tr key={d.id} className="border-[var(--st-border)]">
                    <Td className="font-medium text-[var(--st-text)]">
                      <EntityRowLink
                        href={`/dashboard/crm/sales-crm/deals/${d.id}`}
                        label={d.name}
                      />
                    </Td>
                    <Td>
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
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {d.owner}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {d.pipeline}
                    </Td>
                    <Td align="right" className="text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(d.value)}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text-secondary)]">
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleDateString()
                        : '-'}
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
            total={total}
          />
        </div>
      </Card>
    </div>
  );
}
