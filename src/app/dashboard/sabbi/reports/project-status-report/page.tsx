export const dynamic = 'force-dynamic';

import * as React from 'react';

import { Badge, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Projects by RAG status
            </h2>
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              {fmtNumber(totals.totalActive)} active
            </span>
          </div>
          <RagBarChart data={ragDistribution} />
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Delivery velocity
            </h2>
            <span className="text-[12px] text-[var(--st-text-secondary)]">
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
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Project</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="text-[var(--st-text-secondary)]">RAG</Th>
                <Th className="text-[var(--st-text-secondary)]">Owner</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Completion</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Tasks</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Overdue</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Deadline</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={8}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No active projects.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r) => (
                  <Tr key={r._id} className="border-[var(--st-border)]">
                    <Td>
                      <EntityRowLink
                        href={`/dashboard/crm/projects/${r._id}`}
                        label={r.name}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.status}
                    </Td>
                    <Td>
                      <Badge variant={ragVariant(r.rag)}>{r.rag}</Badge>
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.ownerName}
                    </Td>
                    <Td className="text-right text-[13px] font-medium text-[var(--st-text)]">
                      {r.completionPercent}%
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.tasksCount)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.overdueTasks)}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                      {r.deadline ? r.deadline.slice(0, 10) : '—'}
                      {r.daysToDeadline != null ? (
                        <span className="ml-1 text-[11px]">
                          ({r.daysToDeadline > 0
                            ? `+${r.daysToDeadline}d`
                            : `${r.daysToDeadline}d`})
                        </span>
                      ) : null}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
