'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const LeadsBarChart = dynamic(
  () => import('./leads-conversion-charts').then((mod) => mod.LeadsBarChart),
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
} from '@/components/zoruui';
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
        className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Source
          </span>
          <input
            type="text"
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-28 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Owner
          </span>
          <input
            type="text"
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
            placeholder="Any"
            className="h-9 w-28 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
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
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-zoru-ink">
            Funnel by stage
          </h2>
          <p className="text-[12px] text-zoru-ink-muted">
            Bar labels show stage-over-stage conversion %.
          </p>
        </div>
        <LeadsBarChart chartData={chartData} />
      </Card>

      {/* Conversion rate by source table */}
      {bySource.length > 0 && (
        <Card>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-zoru-ink">
              Conversion by source
            </h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Source
                  </ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    Leads
                  </ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    Converted
                  </ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    Conv. rate
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {bySource.map((s) => (
                  <ZoruTableRow key={s.source} className="border-zoru-line">
                    <ZoruTableCell className="font-medium text-zoru-ink">
                      {s.source}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                      {fmtNumber(s.total)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                      {fmtNumber(s.converted)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-ink">
                      <Badge
                        variant={
                          s.conversionRate >= 20 ? 'default' : 'secondary'
                        }
                      >
                        {s.conversionRate.toFixed(1)}%
                      </Badge>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Leads table */}
      <Card>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">
                  Lead
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Company
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Status
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Source
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Created
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {leads.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No leads.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                leads.map((l) => (
                  <ZoruTableRow key={l.id} className="border-zoru-line">
                    <ZoruTableCell className="font-medium text-zoru-ink">
                      <EntityRowLink
                        href={`/dashboard/crm/sales-crm/leads?leadId=${l.id}`}
                        label={l.title}
                        subtitle={l.contactName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {l.company ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge
                        variant={
                          l.status === 'Converted'
                            ? 'default'
                            : l.status === 'Lost'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {l.status}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {l.source}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                      {l.createdAt
                        ? new Date(l.createdAt).toLocaleDateString()
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
