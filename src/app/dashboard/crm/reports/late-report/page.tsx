export const dynamic = 'force-dynamic';

import * as React from 'react';

import {
  Badge,
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import { StatCard, fmtNumber } from '../_components/report-toolbar';
import { TpReportToolbar } from '../_components/tp-report-toolbar';
import { LateStackedChart } from '../_components/tp-report-charts';
import {
  getLateReportDeep,
  getTpReportProjects,
  getTpReportOwners,
  type LateEntityKind,
} from '@/app/actions/crm-reports.actions';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    projectId?: string;
    ownerId?: string;
    page?: string;
    limit?: string;
  }>;
}

const KIND_LABEL: Record<LateEntityKind, string> = {
  task: 'Task',
  project: 'Project',
  invoice: 'Invoice',
};

function kindHref(kind: LateEntityKind, id: string): string {
  if (kind === 'task') return `/dashboard/crm/tasks/${id}`;
  if (kind === 'project') return `/dashboard/crm/projects/${id}`;
  return `/dashboard/crm/sales-crm/invoices/${id}`;
}

function kindVariant(kind: LateEntityKind): 'outline' | 'warning' | 'destructive' {
  if (kind === 'invoice') return 'destructive';
  if (kind === 'project') return 'warning';
  return 'outline';
}

export default async function LateReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(
    100,
    Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20),
  );

  const [projects, owners, report] = await Promise.all([
    getTpReportProjects(),
    getTpReportOwners(),
    getLateReportDeep(sp.from, sp.to, sp.projectId, sp.ownerId),
  ]);

  const { rows, byKind, stacked, totals } = report;

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = [
    'Kind',
    'Title',
    'Project',
    'Owner',
    'Due',
    'Late (days)',
    'Status',
  ];
  const exportRows = rows.map((r) => ({
    Kind: KIND_LABEL[r.kind],
    Title: r.title,
    Project: r.projectName,
    Owner: r.ownerName,
    Due: r.dueDate ? r.dueDate.slice(0, 10) : '',
    'Late (days)': r.lateDays,
    Status: r.status,
  }));

  const taskBreakdown = byKind.find((k) => k.kind === 'task');
  const projectBreakdown = byKind.find((k) => k.kind === 'project');
  const invoiceBreakdown = byKind.find((k) => k.kind === 'invoice');

  return (
    <EntityListShell
      title="Late Report"
      subtitle="Tasks, projects and invoices past their due date."
      primaryAction={
        <TpReportToolbar
          from={sp.from}
          to={sp.to}
          projectId={sp.projectId}
          ownerId={sp.ownerId}
          projects={projects}
          owners={owners}
          exportProps={{
            filename: 'late-report',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'LateItems',
          }}
        />
      }
      pagination={
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={hasMore}
          total={rows.length}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total late items"
          value={fmtNumber(totals.totalLate)}
          tone="red"
        />
        <StatCard
          label="Late tasks"
          value={fmtNumber(taskBreakdown?.count ?? 0)}
          hint={`avg ${taskBreakdown?.avgDays ?? 0}d`}
          tone="amber"
        />
        <StatCard
          label="Late projects"
          value={fmtNumber(projectBreakdown?.count ?? 0)}
          hint={`avg ${projectBreakdown?.avgDays ?? 0}d`}
          tone="amber"
        />
        <StatCard
          label="Avg lateness"
          value={
            totals.avgLatenessDays
              ? `${fmtNumber(totals.avgLatenessDays)} days`
              : '—'
          }
          hint={`worst ${totals.worstLatenessDays}d · ${fmtNumber(
            invoiceBreakdown?.count ?? 0,
          )} late invoices`}
          tone="red"
        />
      </div>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">
            Late items by month — stacked by kind
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {totals.kindCount} kind{totals.kindCount === 1 ? '' : 's'}
          </span>
        </div>
        <LateStackedChart data={stacked} />
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Kind</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Title</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Project</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Owner</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Due</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Late</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No late items in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow
                    key={`${r.kind}-${r._id}`}
                    className="border-border"
                  >
                    <ZoruTableCell>
                      <Badge variant={kindVariant(r.kind)}>
                        {KIND_LABEL[r.kind]}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={kindHref(r.kind, r._id)}
                        label={r.title}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.projectId ? (
                        <EntityRowLink
                          href={`/dashboard/crm/projects/${r.projectId}`}
                          label={r.projectName}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.ownerName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-destructive">
                      {r.dueDate ? r.dueDate.slice(0, 10) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-destructive">
                      {r.lateDays}d
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.status}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
