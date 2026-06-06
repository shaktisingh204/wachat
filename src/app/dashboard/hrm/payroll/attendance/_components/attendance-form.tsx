'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <AttendanceForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `saveAttendanceAction`. Employee, shift, and
 * approver references go through `<EntityFormField>` so the value
 * stored is an id; status / source use `<Select>` with a fixed
 * vocabulary (Rust enum). Times are stamped via two `<input type="time">`
 * controls — the action layer recombines them with `date` into ISO-8601
 * `punchIn` / `punchOut` instants and auto-computes `totalHours` when
 * the form leaves that field empty.
 *
 * No custom-fields panel — `'attendance'` is not a registered
 * `WsCustomFieldBelongsTo` value.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveAttendanceAction } from '@/app/actions/crm/attendance.actions';
import type {
  CrmAttendanceDoc,
} from '@/lib/rust-client/crm-attendance';

interface AttendanceFormProps {
  /** Existing record — present in Edit mode, omit for Create. */
  initial?: CrmAttendanceDoc | null;
}


function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create record'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

/** Convert an ISO-8601 datetime to a `YYYY-MM-DD` value for `<input type="date">`. */
function toDateValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Convert an ISO-8601 datetime to an `HH:MM` value for `<input type="time">`. */
function toTimeValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Use UTC components to round-trip cleanly with the Rust handler,
  // which stores punch timestamps as UTC instants.
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceForm({ initial }: AttendanceFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    saveAttendanceAction,
    INITIAL_STATE,
  );

  const editing = !!initial?._id;

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/hrm/payroll/attendance/${state.id}`
          : '/dashboard/hrm/payroll/attendance',
      );
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Employee <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="employeeId"
                initialId={initial?.employeeId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="date">
              Date <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={toDateValue(initial?.date) || todayDateValue()}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="status">
              Status <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="attendanceFormStatus"
                name="status"
                initialId={initial?.status ?? 'present'}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="source">Source</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="attendanceSource"
                name="source"
                initialId={initial?.source ?? 'manual'}
              />
            </div>
          </div>
          <div>
            <Label>Approver</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="approverId"
                initialId={initial?.approverId ?? null}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Times
        </h3>
        <p className="-mt-3 mb-4 text-[12px] text-[var(--st-text-secondary)]">
          Times are interpreted as UTC. Leave the hours field empty to
          auto-compute from the check-in / check-out window.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="checkInTime">Check-in time</Label>
            <Input
              id="checkInTime"
              name="checkInTime"
              type="time"
              defaultValue={toTimeValue(initial?.punchIn?.at)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="checkOutTime">Check-out time</Label>
            <Input
              id="checkOutTime"
              name="checkOutTime"
              type="time"
              defaultValue={toTimeValue(initial?.punchOut?.at)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="totalHours">Total hours (worked)</Label>
            <Input
              id="totalHours"
              name="totalHours"
              type="number"
              step="0.01"
              min={0}
              max={24}
              defaultValue={initial?.totalHours ?? ''}
              className="mt-1.5"
              placeholder="auto"
            />
          </div>
          <div>
            <Label htmlFor="overtimeHours">Overtime hours</Label>
            <Input
              id="overtimeHours"
              name="overtimeHours"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.overtimeHours ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="lateByMinutes">Late by (minutes)</Label>
            <Input
              id="lateByMinutes"
              name="lateByMinutes"
              type="number"
              min={0}
              defaultValue={initial?.lateByMinutes ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="earlyOutByMinutes">
              Early-out by (minutes)
            </Label>
            <Input
              id="earlyOutByMinutes"
              name="earlyOutByMinutes"
              type="number"
              min={0}
              defaultValue={initial?.earlyOutByMinutes ?? ''}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Notes
        </h3>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ''}
            className="mt-1.5"
            placeholder="Optional context — e.g. WFH for vendor meeting, doctor visit, etc."
            rows={3}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/hrm/payroll/attendance/${String(initial!._id)}`
                : '/dashboard/hrm/payroll/attendance'
            }
          >
            Cancel
          </Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
