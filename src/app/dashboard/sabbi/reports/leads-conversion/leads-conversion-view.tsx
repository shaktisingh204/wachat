'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const LeadsBarChart = dynamic(
  () => import('./leads-conversion-charts').then((mod) => mod.LeadsBarChart),
  { ssr: false }
);
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { Inbox } from 'lucide-react';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatCard, fmtNumber } from '../_components/report-toolbar';
import type {
  LeadConversionStats,
  LeadStageFunnelRow,
  LeadsBySourceRow,
} from '@/lib/worksuite/report-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface LeadRow {
  id: string;
  title: string;
  contactName?: string;
  company?: string;
  status: string;
  source: string;
  createdAt: string | null;
}

interface Props {
  stats: LeadConversionStats;
  funnel: LeadStageFunnelRow[];
  bySource: LeadsBySourceRow[];
  leads: LeadRow[];
  total: number;
  page: number;
  limit: number;
  from?: string;
  to?: string;
  source: string;
  owner: string;
}

const HEADERS = ['Title', 'Contact', 'Company', 'Status', 'Source', 'Created'];

export function LeadsConversionView({
  stats,
  funnel,
  bySource,
  leads,
  total,
  page,
  limit,
  from,
  to,
  source,
  owner,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [sourceInput, setSourceInput] = React.useState(source || '');
  const [ownerInput, setOwnerInput] = React.useState(owner || '');

  const qualified =
    funnel.find((r) => r.stage === 'Qualified')?.count ?? 0;
  const won =
    funnel.find((r) => r.stage === 'Converted')?.count ?? stats.converted;

  const exportRows = React.useMemo(
    () =>
      leads.map((l) => ({
        Title: l.title,
        Contact: l.contactName ?? '',
        Company: l.company ?? '',
        Status: l.status,
        Source: l.source,
        Created: l.createdAt ?? '',
      })),
    [leads],
  );

  const onCsv = React.useCallback(
    () =>
      downloadCsv(
        `leads-conversion-${dateStamp()}.csv`,
        HEADERS,
        exportRows,
      ),
    [exportRows],
  );

  const onXlsx = React.useCallback(
    () =>
      downloadXlsx(
        `leads-conversion-${dateStamp()}.xlsx`,
        HEADERS,
        exportRows,
        'Leads',
      ),
    [exportRows],
  );

  const pushFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (sourceInput) params.set('source', sourceInput);
    else params.delete('source');
    if (ownerInput) params.set('owner', ownerInput);
    else params.delete('owner');
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const chartData = funnel.map((r) => ({
    stage: r.stage,
    count: r.count,
    label:
      r.conversionFromPrev > 0
        ? `${r.conversionFromPrev.toFixed(0)}%`
        : '',
  }));

  const hasMore = page * limit < total;

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
        <Field label="Source">
          <Input
            type="text"
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
            placeholder="Any"
            inputSize="sm"
            className="w-28"
          />
        </Field>
        <Field label="Owner">
          <Input
            type="text"
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total leads" value={fmtNumber(stats.total)} />
        <StatCard label="Qualified" value={fmtNumber(qualified)} tone="blue" />
        <StatCard
          label="Won / Converted"
          value={fmtNumber(won)}
          tone="green"
        />
        <StatCard
          label="Conversion rate"
          value={`${stats.conversionRate.toFixed(1)}%`}
          tone={stats.conversionRate >= 20 ? 'green' : 'amber'}
          hint={`Avg cycle ${stats.avgCycleDays.toFixed(1)} days`}
        />
      </div>

      {/* Funnel bar chart */}
      <Card>
        <CardHeader className="mb-3">
          <CardTitle>Funnel by stage</CardTitle>
          <CardDescription>
            Bar labels show stage-over-stage conversion %.
          </CardDescription>
        </CardHeader>
        <LeadsBarChart chartData={chartData} />
      </Card>

      {/* Conversion rate by source table */}
      {bySource.length > 0 && (
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Conversion by source</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  <Th>Source</Th>
                  <Th align="right">Leads</Th>
                  <Th align="right">Converted</Th>
                  <Th align="right">Conv. rate</Th>
                </Tr>
              </THead>
              <TBody>
                {bySource.map((s) => (
                  <Tr key={s.source}>
                    <Td className="font-medium text-[var(--st-text)]">
                      {s.source}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text)]">
                      {fmtNumber(s.total)}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text)]">
                      {fmtNumber(s.converted)}
                    </Td>
                    <Td align="right" className="text-[13px] font-medium text-[var(--st-text)]">
                      <Badge tone={s.conversionRate >= 20 ? 'success' : 'neutral'}>
                        {s.conversionRate.toFixed(1)}%
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Leads table */}
      <Card>
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th>Lead</Th>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th>Source</Th>
                <Th align="right">Created</Th>
              </Tr>
            </THead>
            <TBody>
              {leads.length === 0 ? (
                <Tr>
                  <Td colSpan={5}>
                    <EmptyState
                      icon={Inbox}
                      size="sm"
                      title="No leads"
                      description="No leads match the current filters."
                    />
                  </Td>
                </Tr>
              ) : (
                leads.map((l) => (
                  <Tr key={l.id}>
                    <Td className="font-medium text-[var(--st-text)]">
                      <EntityRowLink
                        href={`/dashboard/crm/sales-crm/leads?leadId=${l.id}`}
                        label={l.title}
                        subtitle={l.contactName}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {l.company ?? '-'}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          l.status === 'Converted'
                            ? 'success'
                            : l.status === 'Lost'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {l.status}
                      </Badge>
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {l.source}
                    </Td>
                    <Td align="right" className="text-[13px] text-[var(--st-text-secondary)]">
                      {l.createdAt
                        ? new Date(l.createdAt).toLocaleDateString()
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
