import React, { useState } from 'react';
import { Button, Label, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DialogFooter } from '@/components/sabcrm/20ui';
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
        <Label className="text-[12px] text-[var(--st-text-secondary)]">
          Employee <span className="text-[var(--st-danger)]">*</span>
        </Label>
        <Select value={newUserId} onValueChange={setNewUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={String(e._id)} value={String(e._id)}>
                {e.firstName} {e.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px] text-[var(--st-text-secondary)]">
          Date <span className="text-[var(--st-danger)]">*</span>
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
          <Label className="text-[12px] text-[var(--st-text-secondary)]">
            Current Shift <span className="text-[var(--st-danger)]">*</span>
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
          <Label className="text-[12px] text-[var(--st-text-secondary)]">
            Requested Shift <span className="text-[var(--st-danger)]">*</span>
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
        <Label className="text-[12px] text-[var(--st-text-secondary)]">Reason (optional)</Label>
        <textarea
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          rows={3}
          placeholder="Explain the reason for the shift change…"
          className="w-full resize-none rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] placeholder:text-[var(--st-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--st-border)]"
        />
      </div>

      {formError ? (
        <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 px-3 py-2 text-[13px] text-[var(--st-danger)]">
          {formError}
        </div>
      ) : null}

      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Submit Request'}
        </Button>
      </DialogFooter>
    </form>
  );
}
