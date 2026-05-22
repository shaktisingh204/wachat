'use client';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { Check,
  Plus,
  X } from 'lucide-react';
import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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

  const variant = (s: WsShiftChangeStatus): 'warning' | 'success' | 'danger' => {
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'danger';
    return 'warning';
  };

  return (
    <EntityListShell
      title="Shift Change Requests"
      subtitle="Review and action employee requests to swap shifts."
      primaryAction={
        <Button
          onClick={() => { resetForm(); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New Request
        </Button>
      }
    >

      <Card className="p-6">
        <h2 className="mb-3 text-[16px] text-zoru-ink">All Requests</h2>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Employee</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Date</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Current Shift</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Requested Shift</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Reason</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending && requests.length === 0 ? (
                <tr className="border-b border-zoru-line">
                  <td colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((r) => {
                  const emp = empMap.get(r.user_id);
                  const cur = shiftMap.get(r.current_shift_id);
                  const req = shiftMap.get(r.requested_shift_id);
                  return (
                    <tr key={String(r._id)} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50">
                      <td className="px-4 py-2.5 text-zoru-ink">
                        {emp ? `${emp.firstName} ${emp.lastName}` : r.user_id}
                      </td>
                      <td className="px-4 py-2.5 text-zoru-ink">
                        {format(new Date(r.date), 'PP')}
                      </td>
                      <td className="px-4 py-2.5">
                        <ShiftCell shift={cur} />
                      </td>
                      <td className="px-4 py-2.5">
                        <ShiftCell shift={req} />
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-[12.5px] text-zoru-ink-muted">
                        {r.reason || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={variant(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(r._id)}
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(r._id)}
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-zoru-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-b border-zoru-line">
                  <td colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No shift change requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <ZoruDialogContent className="sm:max-w-[520px]">
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Shift Change Request</ZoruDialogTitle>
          </ZoruDialogHeader>
          <form onSubmit={handleCreateRequest} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-zoru-ink-muted">
                Employee <span className="text-zoru-danger-ink">*</span>
              </Label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select employee" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {employees.map((e) => (
                    <ZoruSelectItem key={e._id.toString()} value={e._id.toString()}>
                      {e.firstName} {e.lastName}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-zoru-ink-muted">
                Date <span className="text-zoru-danger-ink">*</span>
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
                <Label className="text-[12px] text-zoru-ink-muted">
                  Current Shift <span className="text-zoru-danger-ink">*</span>
                </Label>
                <Select value={newCurrentShiftId} onValueChange={setNewCurrentShiftId}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Current" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {shifts.map((s) => (
                      <ZoruSelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-zoru-ink-muted">
                  Requested Shift <span className="text-zoru-danger-ink">*</span>
                </Label>
                <Select value={newRequestedShiftId} onValueChange={setNewRequestedShiftId}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Requested" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {shifts.map((s) => (
                      <ZoruSelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-zoru-ink-muted">Reason (optional)</Label>
              <textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                rows={3}
                placeholder="Explain the reason for the shift change…"
                className="w-full resize-none rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink placeholder:text-zoru-ink-muted focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {formError ? (
              <div className="rounded-lg border border-rose-50 bg-rose-50/50 px-3 py-2 text-[13px] text-zoru-danger-ink">
                {formError}
              </div>
            ) : null}

            <ZoruDialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => { setDialogOpen(false); resetForm(); }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Submit Request'}
              </Button>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}

function ShiftCell({ shift }: { shift?: WsEmployeeShift }) {
  if (!shift)
    return <span className="text-[12.5px] text-zoru-ink-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-zoru-ink">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[3px] border border-zoru-line"
        style={{ backgroundColor: shift.color_code || '#EAB308' }}
      />
      {shift.name}
    </span>
  );
}
