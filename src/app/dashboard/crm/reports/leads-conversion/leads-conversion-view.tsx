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
  LabelList,
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
import { StatCard, fmtNumber } from '../_components/report-toolbar';
import type {
  LeadConversionStats,
  LeadStageFunnelRow,
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
  leads: LeadRow[];
  total: number;
  page: number;
  limit: number;
}

const HEADERS = ['Title', 'Contact', 'Company', 'Status', 'Source', 'Created'];

export function LeadsConversionView({ stats, funnel, leads, total, page, limit }: Props) {
  const qualified = funnel.find((r) => r.stage === 'Qualified')?.count ?? 0;
  const won = funnel.find((r) => r.stage === 'Converted')?.count ?? stats.converted;

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

  const onCsv = React.useCallback(() => {
    downloadCsv(`leads-conversion-${dateStamp()}.csv`, HEADERS, exportRows);
  }, [exportRows]);

  const onXlsx = React.useCallback(
    () => downloadXlsx(`leads-conversion-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Leads'),
    [exportRows],
  );

  const chartData = funnel.map((r) => ({
    stage: r.stage,
    count: r.count,
    label: r.conversionFromPrev > 0 ? `${r.conversionFromPrev.toFixed(0)}%` : '',
  }));

  const hasMore = page * limit < total;

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader onExportCsv={onCsv} onExportXlsx={onXlsx} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total leads" value={fmtNumber(stats.total)} />
        <StatCard label="Qualified" value={fmtNumber(qualified)} tone="blue" />
        <StatCard label="Won / Converted" value={fmtNumber(won)} tone="green" />
        <StatCard
          label="Conversion rate"
          value={`${stats.conversionRate.toFixed(1)}%`}
          tone={stats.conversionRate >= 20 ? 'green' : 'amber'}
          hint={`Avg cycle ${stats.avgCycleDays.toFixed(1)} days`}
        />
      </div>

      <ZoruCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">
            Funnel by stage
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Bar labels show stage-over-stage conversion %.
          </p>
        </div>
        {chartData.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            No leads in this range.
          </div>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="label" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ZoruCard>

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Lead</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Company</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Source</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Created</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {leads.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell colSpan={5} className="h-20 text-center text-[13px] text-muted-foreground">
                    No leads.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                leads.map((l) => (
                  <ZoruTableRow key={l.id} className="border-border">
                    <ZoruTableCell className="font-medium text-foreground">
                      <EntityRowLink
                        href={`/dashboard/crm/sales-crm/leads?leadId=${l.id}`}
                        label={l.title}
                        subtitle={l.contactName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {l.company ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={l.status === 'Converted' ? 'default' : l.status === 'Lost' ? 'destructive' : 'secondary'}>
                        {l.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">{l.source}</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                      {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '—'}
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
