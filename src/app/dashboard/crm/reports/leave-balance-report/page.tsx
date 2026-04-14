export const dynamic = 'force-dynamic';

import { Scale } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { StatCard } from '../_components/report-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLeaveBalanceReport } from '@/app/actions/worksuite/reports.actions';

export default async function LeaveBalanceReportPage() {
  const rows = await getLeaveBalanceReport();
  const employees = new Set(rows.map((r) => r.employeeId)).size;
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalUsed = rows.reduce((s, r) => s + r.used, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Balance"
        subtitle="Remaining leave balance per employee and leave type."
        icon={Scale}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Employees" value={String(employees)} />
        <StatCard label="Allocated days" value={String(totalAllocated)} />
        <StatCard label="Used days" value={String(totalUsed)} tone="amber" />
      </div>

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                <TableHead className="text-clay-ink-muted">Leave Type</TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Allocated
                </TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Used
                </TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Remaining
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    No employees or leave types configured.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={`${r.employeeId}-${r.leaveTypeName}-${i}`}
                    className="border-clay-border"
                  >
                    <TableCell className="font-medium text-clay-ink">
                      {r.employeeName}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {r.leaveTypeName}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-clay-ink">
                      {r.allocated}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-clay-amber">
                      {r.used}
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-clay-green">
                      {r.remaining}
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
