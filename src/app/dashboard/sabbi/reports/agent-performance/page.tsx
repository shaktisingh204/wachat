import React, { Suspense } from 'react';

import {
  Badge,
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
  StatCard,
  fmtMoney,
  fmtNumber,
} from '../_components/report-toolbar';
import { HorizontalBarChart } from '../_components/hr-report-charts';
import { HrReportToolbar } from '../_components/hr-report-toolbar';
import {
  getHrReportDepartments,
  getSalesAgentPerformance,
} from '@/app/actions/crm-reports.actions';
import ReportsLoading from '../loading';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    departmentId?: string;
    page?: string;
    limit?: string;
  }>;
}

/* ─── Server Container ────────────────────────────────────────────── */

async function AgentPerformanceContainer({
  searchParams,
}: {
  searchParams: Awaited<PageProps['searchParams']>;
}) {
  const page = Math.max(1, searchParams.page ? parseInt(searchParams.page, 10) : 1);
  const limit = Math.min(100, Math.max(5, searchParams.limit ? parseInt(searchParams.limit, 10) : 20));

  const [departments, report] = await Promise.all([
    getHrReportDepartments(),
    getSalesAgentPerformance(searchParams.from, searchParams.to, searchParams.departmentId),
  ]);

  const { rows, totals } = report;

  const chartData = rows.slice(0, 12).map((r) => ({
    label: r.employeeName,
    value: r.leadsHandled,
    secondary: r.dealsWon,
  }));

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportRows = rows.map((r) => ({
    Agent: r.employeeName,
    Department: r.department,
    'Leads handled': r.leadsHandled,
    'Deals won': r.dealsWon,
    'Deals lost': r.dealsLost,
    'Revenue closed': r.revenueClosed,
    'Avg deal size': r.avgDealSize,
  }));
  const exportHeaders = [
    'Agent',
    'Department',
    'Leads handled',
    'Deals won',
    'Deals lost',
    'Revenue closed',
    'Avg deal size',
  ];

  return (
    <EntityListShell
      title="Agent Performance"
      subtitle="Per-agent leads handled, deals closed and revenue."
      primaryAction={
        <HrReportToolbar
          from={searchParams.from}
          to={searchParams.to}
          departmentId={searchParams.departmentId}
          departments={departments}
          exportProps={{
            filename: 'agent-performance',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'AgentPerformance',
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
        <StatCard label="Total agents" value={fmtNumber(totals.totalAgents)} />
        <StatCard
          label="Top performer"
          value={totals.topPerformer}
          tone="green"
        />
        <StatCard
          label="Leads handled"
          value={fmtNumber(totals.leadsHandled)}
          tone="blue"
        />
        <StatCard
          label="Avg deal size"
          value={fmtMoney(totals.avgDealSize)}
          hint={`${fmtNumber(totals.dealsWon)} deals · ${fmtMoney(totals.revenueClosed)} closed`}
          tone="amber"
        />
      </div>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
            Top agents — leads vs deals won
          </h2>
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            Showing top {chartData.length}
          </span>
        </div>
        <HorizontalBarChart
          data={chartData}
          primaryKey="value"
          primaryName="Leads"
          secondaryKey="secondary"
          secondaryName="Deals won"
        />
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Agent</ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Department</ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Leads</ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Won</ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Lost</ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Revenue</ZoruTableHead>
                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Avg deal</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-[var(--st-border)]">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No agents in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.employeeId} className="border-[var(--st-border)]">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                        label={r.employeeName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                      <Badge variant="outline">{r.department}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.leadsHandled)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.dealsWon)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtNumber(r.dealsLost)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-[var(--st-text)]">
                      {fmtMoney(r.revenueClosed)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                      {fmtMoney(r.avgDealSize)}
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

export default async function AgentPerformancePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  return (
    <Suspense fallback={<ReportsLoading />}>
      <AgentPerformanceContainer searchParams={sp} />
    </Suspense>
  );
}
