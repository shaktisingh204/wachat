import React, { useState } from 'react';
import {
  Button,
  Label,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruDialogFooter,
} from '@/components/zoruui';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import type { WsEmployeeShift } from '@/lib/worksuite/shifts-types';

export function NewShiftChangeRequestForm({
  employees,
  shifts,
  onCancel,
  onSubmit,
}: {
  employees: WithId<CrmEmployee>[];
  shifts: WsEmployeeShift[];
  onCancel: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [newUserId, setNewUserId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCurrentShiftId, setNewCurrentShiftId] = useState('');
  const [newRequestedShiftId, setNewRequestedShiftId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUserId || !newDate || !newCurrentShiftId || !newRequestedShiftId) {
      setFormError('Employee, date, current shift and requested shift are all required.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        user_id: newUserId,
        date: new Date(newDate),
        current_shift_id: newCurrentShiftId,
        requested_shift_id: newRequestedShiftId,
        reason: newReason,
        status: 'pending',
      });
      // Reset form
      setNewUserId('');
      setNewDate('');
      setNewCurrentShiftId('');
      setNewRequestedShiftId('');
      setNewReason('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
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
              <ZoruSelectItem key={String(e._id)} value={String(e._id)}>
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
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Submit Request'}
        </Button>
      </ZoruDialogFooter>
    </form>
  );
}
