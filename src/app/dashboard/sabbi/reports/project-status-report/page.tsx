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
import {
  RagBarChart,
  VelocityLineChart,
} from '../_components/tp-report-charts';
import { GanttChartPreview } from '../_components/gantt-chart-preview';
import { ResourceUtilizationOverlay } from '../_components/resource-utilization-overlay';
import {
  getProjectStatusDeep,
  getTpReportProjects,
  getTpReportOwners,
  type ProjectRag,
} from '@/app/actions/crm-reports.actions';

interface PageProps {
  searchParams: Promise<{
    projectId?: string;
    ownerId?: string;
    page?: string;
    limit?: string;
  }>;
}

function ragVariant(
  rag: ProjectRag,
): 'success' | 'warning' | 'destructive' {
  if (rag === 'on-track') return 'success';
  if (rag === 'at-risk') return 'warning';
  return 'destructive';
}

export default async function ProjectStatusReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(
    100,
    Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20),
  );

  const [projects, owners, report] = await Promise.all([
    getTpReportProjects(),
    getTpReportOwners(),
    getProjectStatusDeep(sp.projectId, sp.ownerId),
  ]);

  const { rows, ragDistribution, velocity, totals } = report;

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = [
    'Project',
    'Status',
    'RAG',
    'Owner',
    'Completion %',
    'Tasks',
    'Overdue',
    'Deadline',
    'Days to deadline',
  ];
  const exportRows = rows.map((r) => ({
    Project: r.name,
    Status: r.status,
    RAG: r.rag,
    Owner: r.ownerName,
    'Completion %': r.completionPercent,
    Tasks: r.tasksCount,
    Overdue: r.overdueTasks,
    Deadline: r.deadline ? r.deadline.slice(0, 10) : '',
    'Days to deadline': r.daysToDeadline ?? '',
  }));

  return (
    <EntityListShell
      title="Project Status"
      subtitle="Active projects grouped by RAG status with delivery velocity."
      primaryAction={
        <TpReportToolbar
          projectId={sp.projectId}
          ownerId={sp.ownerId}
          projects={projects}
          owners={owners}
          hideDateRange
          exportProps={{
            filename: 'project-status-report',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'ProjectStatus',
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
          label="Total active projects"
          value={fmtNumber(totals.totalActive)}
        />
        <StatCard
          label="On track"
          value={fmtNumber(totals.onTrack)}
          tone="green"
        />
        <StatCard
          label="At risk"
          value={fmtNumber(totals.atRisk)}
          tone="amber"
        />
        <StatCard
          label="Blocked"
          value={fmtNumber(totals.blocked)}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">
              Projects by RAG status
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {fmtNumber(totals.totalActive)} active
            </span>
          </div>
          <RagBarChart data={ragDistribution} />
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">
              Delivery velocity
            </h2>
            <span className="text-[12px] text-muted-foreground">
              tasks completed / month
            </span>
          </div>
          <VelocityLineChart data={velocity} />
        </Card>
        
        <ResourceUtilizationOverlay rows={rows} />
      </div>

      <div className="mb-4">
        <GanttChartPreview rows={rows} />
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Project</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">RAG</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Owner</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Completion</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Tasks</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Overdue</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Deadline</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No active projects.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r._id} className="border-border">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/projects/${r._id}`}
                        label={r.name}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.status}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={ragVariant(r.rag)}>{r.rag}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.ownerName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-foreground">
                      {r.completionPercent}%
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {fmtNumber(r.tasksCount)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-destructive">
                      {fmtNumber(r.overdueTasks)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                      {r.deadline ? r.deadline.slice(0, 10) : '—'}
                      {r.daysToDeadline != null ? (
                        <span className="ml-1 text-[11px]">
                          ({r.daysToDeadline > 0
                            ? `+${r.daysToDeadline}d`
                            : `${r.daysToDeadline}d`})
                        </span>
                      ) : null}
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
