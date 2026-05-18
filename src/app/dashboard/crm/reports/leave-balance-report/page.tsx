import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatCard } from '../_components/report-toolbar';

import { getLeaveBalanceReport } from '@/app/actions/worksuite/reports.actions';

export default async function LeaveBalanceReportPage() {
  const rows = await getLeaveBalanceReport();
  const employees = new Set(rows.map((r) => r.employeeId)).size;
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalUsed = rows.reduce((s, r) => s + r.used, 0);

  return (
    <EntityListShell
      title="Leave Balance"
      subtitle="Remaining leave balance per employee and leave type."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Employees" value={String(employees)} />
        <StatCard label="Allocated days" value={String(totalAllocated)} />
        <StatCard label="Used days" value={String(totalUsed)} tone="amber" />
      </div>

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Employee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Leave Type</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Allocated
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Used
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Remaining
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No employees or leave types configured.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r, i) => (
                  <ZoruTableRow
                    key={`${r.employeeId}-${r.leaveTypeName}-${i}`}
                    className="border-border"
                  >
                    <ZoruTableCell className="font-medium text-foreground">
                      {r.employeeName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.leaveTypeName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {r.allocated}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-amber-500">
                      {r.used}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-emerald-500">
                      {r.remaining}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
