'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowLeftRight, Check, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import {
  getShiftChangeRequests,
  approveShiftChange,
  rejectShiftChange,
  saveShiftChangeRequest,
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

  // New request dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCurrentShiftId, setNewCurrentShiftId] = useState('');
  const [newRequestedShiftId, setNewRequestedShiftId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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

  const resetForm = () => {
    setNewUserId('');
    setNewDate('');
    setNewCurrentShiftId('');
    setNewRequestedShiftId('');
    setNewReason('');
    setFormError(null);
  };

  const handleCreateRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUserId || !newDate || !newCurrentShiftId || !newRequestedShiftId) {
      setFormError('Employee, date, current shift and requested shift are all required.');
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const res = await saveShiftChangeRequest({
        user_id: newUserId,
        date: new Date(newDate),
        current_shift_id: newCurrentShiftId,
        requested_shift_id: newRequestedShiftId,
        reason: newReason,
        status: 'pending',
      });
      if (!res.success) {
        setFormError(res.error ?? 'Failed to create request');
        return;
      }
      setDialogOpen(false);
      resetForm();
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
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => { resetForm(); setDialogOpen(true); }}
          >
            New Request
          </ClayButton>
        }
      />

      <ClayCard>
        <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">All Requests</h2>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-clay-border bg-clay-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Employee</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Date</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Current Shift</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Requested Shift</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Reason</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending && requests.length === 0 ? (
                <tr className="border-b border-clay-border">
                  <td colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((r) => {
                  const emp = empMap.get(r.user_id);
                  const cur = shiftMap.get(r.current_shift_id);
                  const req = shiftMap.get(r.requested_shift_id);
                  return (
                    <tr key={String(r._id)} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50">
                      <td className="px-4 py-2.5 text-clay-ink">
                        {emp ? `${emp.firstName} ${emp.lastName}` : r.user_id}
                      </td>
                      <td className="px-4 py-2.5 text-clay-ink">
                        {format(new Date(r.date), 'PP')}
                      </td>
                      <td className="px-4 py-2.5">
                        <ShiftCell shift={cur} />
                      </td>
                      <td className="px-4 py-2.5">
                        <ShiftCell shift={req} />
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-[12.5px] text-clay-ink-muted">
                        {r.reason || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <ClayBadge tone={tone(r.status)}>{r.status}</ClayBadge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
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
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-b border-clay-border">
                  <td colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    No shift change requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New Shift Change Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-clay-ink-muted">
                Employee <span className="text-clay-red">*</span>
              </Label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e._id.toString()} value={e._id.toString()}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-clay-ink-muted">
                Date <span className="text-clay-red">*</span>
              </Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-clay-ink-muted">
                  Current Shift <span className="text-clay-red">*</span>
                </Label>
                <Select value={newCurrentShiftId} onValueChange={setNewCurrentShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Current" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-clay-ink-muted">
                  Requested Shift <span className="text-clay-red">*</span>
                </Label>
                <Select value={newRequestedShiftId} onValueChange={setNewRequestedShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Requested" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-clay-ink-muted">Reason (optional)</Label>
              <textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                rows={3}
                placeholder="Explain the reason for the shift change…"
                className="w-full resize-none rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2 text-[13px] text-clay-ink placeholder:text-clay-ink-muted focus:outline-none focus:ring-1 focus:ring-clay-border-focus"
              />
            </div>

            {formError ? (
              <div className="rounded-clay-md border border-clay-red-soft bg-clay-red-soft/50 px-3 py-2 text-[13px] text-clay-red">
                {formError}
              </div>
            ) : null}

            <DialogFooter>
              <ClayButton
                variant="pill"
                type="button"
                onClick={() => { setDialogOpen(false); resetForm(); }}
              >
                Cancel
              </ClayButton>
              <ClayButton variant="obsidian" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Submit Request'}
              </ClayButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
