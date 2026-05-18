import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ReportToolbar, StatCard } from '../_components/report-toolbar';

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
    <EntityListShell
      title="Leave Report"
      subtitle="Leaves taken by employee and leave type."
      primaryAction={<ReportToolbar from={sp.from} to={sp.to} />}
    >

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Approved days" value={String(totalApproved)} tone="green" />
        <StatCard label="Pending days" value={String(totalPending)} tone="amber" />
        <StatCard label="Rejected days" value={String(totalRejected)} tone="red" />
      </div>

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Employee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Leave Type</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Approved
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Pending
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Rejected
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
                    No leaves in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r, i) => (
                  <ZoruTableRow
                    key={`${r.employeeId}-${i}`}
                    className="border-border"
                  >
                    <ZoruTableCell className="font-medium text-foreground">
                      {r.employeeName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.leaveTypeName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-emerald-500">
                      {r.approvedDays}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-amber-500">
                      {r.pendingDays}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-destructive">
                      {r.rejectedDays}
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
