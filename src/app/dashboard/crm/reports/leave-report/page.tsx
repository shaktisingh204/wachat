export const dynamic = 'force-dynamic';

import { PlaneTakeoff } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { ReportToolbar, StatCard } from '../_components/report-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLeavesReport } from '@/app/actions/worksuite/reports.actions';

export default async function LeaveReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getLeavesReport(sp.from, sp.to);

  const totalApproved = rows.reduce((s, r) => s + r.approvedDays, 0);
  const totalPending = rows.reduce((s, r) => s + r.pendingDays, 0);
  const totalRejected = rows.reduce((s, r) => s + r.rejectedDays, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Report"
        subtitle="Leaves taken by employee and leave type."
        icon={PlaneTakeoff}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Approved days" value={String(totalApproved)} tone="green" />
        <StatCard label="Pending days" value={String(totalPending)} tone="amber" />
        <StatCard label="Rejected days" value={String(totalRejected)} tone="red" />
      </div>

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Employee</TableHead>
                <TableHead className="text-muted-foreground">Leave Type</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Approved
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Pending
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Rejected
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No leaves in this range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={`${r.employeeId}-${i}`}
                    className="border-border"
                  >
                    <TableCell className="font-medium text-foreground">
                      {r.employeeName}
                    </TableCell>
                    <TableCell className="text-[13px] text-foreground">
                      {r.leaveTypeName}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-emerald-500">
                      {r.approvedDays}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-amber-500">
                      {r.pendingDays}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-destructive">
                      {r.rejectedDays}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
