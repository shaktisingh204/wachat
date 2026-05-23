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

import {
  StatCard,
  fmtMoney,
  fmtNumber,
} from '../_components/report-toolbar';
import { HrReportToolbar } from '../_components/hr-report-toolbar';
import dynamic from 'next/dynamic';
import {
  getHrReportDepartments,
  getSalesAgentPerformance,
} from '@/app/actions/crm-reports.actions';

const HorizontalBarChart = dynamic(
  () => import('../_components/hr-report-charts').then((mod) => mod.HorizontalBarChart),
  { ssr: false }
);

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    departmentId?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function AgentPerformancePage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(100, Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20));

  const [departments, report] = await Promise.all([
    getHrReportDepartments(),
    getSalesAgentPerformance(sp.from, sp.to, sp.departmentId),
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
          from={sp.from}
          to={sp.to}
          departmentId={sp.departmentId}
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
          <h2 className="text-[16px] font-semibold text-foreground">
            Top agents — leads vs deals won
          </h2>
          <span className="text-[12px] text-muted-foreground">
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Agent</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Department</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Leads</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Won</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Lost</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Revenue</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Avg deal</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No agents in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.employeeId} className="border-border">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                        label={r.employeeName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      <Badge variant="outline">{r.department}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {fmtNumber(r.leadsHandled)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-emerald-500">
                      {fmtNumber(r.dealsWon)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-destructive">
                      {fmtNumber(r.dealsLost)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-foreground">
                      {fmtMoney(r.revenueClosed)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
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
