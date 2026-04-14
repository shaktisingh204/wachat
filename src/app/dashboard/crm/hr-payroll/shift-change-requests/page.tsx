'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import {
  getShiftChangeRequests,
  approveShiftChange,
  rejectShiftChange,
  getEmployeeShifts,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsEmployeeShiftChangeRequest,
  WsEmployeeShift,
  WsShiftChangeStatus,
} from '@/lib/worksuite/shifts-types';

export default function ShiftChangeRequestsPage() {
  const [requests, setRequests] = useState<WsEmployeeShiftChangeRequest[]>([]);
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [shifts, setShifts] = useState<WsEmployeeShift[]>([]);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const [reqs, emps, sh] = await Promise.all([
        getShiftChangeRequests(),
        getCrmEmployees(),
        getEmployeeShifts(),
      ]);
      setRequests(reqs);
      setEmployees(emps);
      setShifts(sh);
    });

  useEffect(() => {
    load();
  }, []);

  const empMap = useMemo(() => {
    const m = new Map<string, WithId<CrmEmployee>>();
    for (const e of employees) m.set(e._id.toString(), e);
    return m;
  }, [employees]);

  const shiftMap = useMemo(() => {
    const m = new Map<string, WsEmployeeShift>();
    for (const s of shifts) if (s._id) m.set(String(s._id), s);
    return m;
  }, [shifts]);

  const handleApprove = (id?: string) => {
    if (!id) return;
    startTransition(async () => {
      await approveShiftChange(id);
      load();
    });
  };

  const handleReject = (id?: string) => {
    if (!id) return;
    const reason = prompt('Reason for rejection (optional):', '') ?? '';
    startTransition(async () => {
      await rejectShiftChange(id, reason);
      load();
    });
  };

  const tone = (s: WsShiftChangeStatus): 'amber' | 'green' | 'red' => {
    if (s === 'approved') return 'green';
    if (s === 'rejected') return 'red';
    return 'amber';
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Shift Change Requests"
        subtitle="Review and action employee requests to swap shifts."
        icon={ArrowLeftRight}
      />

      <ClayCard>
        <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">All Requests</h2>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                <TableHead className="text-clay-ink-muted">Date</TableHead>
                <TableHead className="text-clay-ink-muted">Current Shift</TableHead>
                <TableHead className="text-clay-ink-muted">Requested Shift</TableHead>
                <TableHead className="text-clay-ink-muted">Reason</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending && requests.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : requests.length > 0 ? (
                requests.map((r) => {
                  const emp = empMap.get(r.user_id);
                  const cur = shiftMap.get(r.current_shift_id);
                  const req = shiftMap.get(r.requested_shift_id);
                  return (
                    <TableRow key={String(r._id)} className="border-clay-border">
                      <TableCell className="text-[13px] text-clay-ink">
                        {emp ? `${emp.firstName} ${emp.lastName}` : r.user_id}
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {format(new Date(r.date), 'PP')}
                      </TableCell>
                      <TableCell>
                        <ShiftCell shift={cur} />
                      </TableCell>
                      <TableCell>
                        <ShiftCell shift={req} />
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-[12.5px] text-clay-ink-muted">
                        {r.reason || '—'}
                      </TableCell>
                      <TableCell>
                        <ClayBadge tone={tone(r.status)}>{r.status}</ClayBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <ClayButton
                              variant="pill"
                              size="sm"
                              leading={<Check className="h-3.5 w-3.5" strokeWidth={2} />}
                              onClick={() => handleApprove(r._id)}
                            >
                              Approve
                            </ClayButton>
                            <ClayButton
                              variant="pill"
                              size="sm"
                              leading={<X className="h-3.5 w-3.5" strokeWidth={2} />}
                              onClick={() => handleReject(r._id)}
                            >
                              Reject
                            </ClayButton>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-clay-ink-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    No shift change requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}

function ShiftCell({ shift }: { shift?: WsEmployeeShift }) {
  if (!shift)
    return <span className="text-[12.5px] text-clay-ink-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-clay-ink">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[3px] border border-clay-border"
        style={{ backgroundColor: shift.color_code || '#EAB308' }}
      />
      {shift.name}
    </span>
  );
}
