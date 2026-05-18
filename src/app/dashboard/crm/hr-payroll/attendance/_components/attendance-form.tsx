'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
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
 * stored is an id; status / source use `<ZoruSelect>` with a fixed
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create record'}
    </ZoruButton>
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
          ? `/dashboard/crm/hr-payroll/attendance/${state.id}`
          : '/dashboard/crm/hr-payroll/attendance',
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

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>
              Employee <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
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
            <ZoruLabel htmlFor="date">
              Date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={toDateValue(initial?.date) || todayDateValue()}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="status">
              Status <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="attendanceFormStatus"
                name="status"
                initialId={initial?.status ?? 'present'}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="source">Source</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="attendanceSource"
                name="source"
                initialId={initial?.source ?? 'manual'}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Approver</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="approverId"
                initialId={initial?.approverId ?? null}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Times
        </h3>
        <p className="-mt-3 mb-4 text-[12px] text-zoru-ink-muted">
          Times are interpreted as UTC. Leave the hours field empty to
          auto-compute from the check-in / check-out window.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="checkInTime">Check-in time</ZoruLabel>
            <ZoruInput
              id="checkInTime"
              name="checkInTime"
              type="time"
              defaultValue={toTimeValue(initial?.punchIn?.at)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="checkOutTime">Check-out time</ZoruLabel>
            <ZoruInput
              id="checkOutTime"
              name="checkOutTime"
              type="time"
              defaultValue={toTimeValue(initial?.punchOut?.at)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="totalHours">Total hours (worked)</ZoruLabel>
            <ZoruInput
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
            <ZoruLabel htmlFor="overtimeHours">Overtime hours</ZoruLabel>
            <ZoruInput
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
            <ZoruLabel htmlFor="lateByMinutes">Late by (minutes)</ZoruLabel>
            <ZoruInput
              id="lateByMinutes"
              name="lateByMinutes"
              type="number"
              min={0}
              defaultValue={initial?.lateByMinutes ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="earlyOutByMinutes">
              Early-out by (minutes)
            </ZoruLabel>
            <ZoruInput
              id="earlyOutByMinutes"
              name="earlyOutByMinutes"
              type="number"
              min={0}
              defaultValue={initial?.earlyOutByMinutes ?? ''}
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Notes
        </h3>
        <div>
          <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
          <ZoruTextarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ''}
            className="mt-1.5"
            placeholder="Optional context — e.g. WFH for vendor meeting, doctor visit, etc."
            rows={3}
          />
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/hr-payroll/attendance/${String(initial!._id)}`
                : '/dashboard/crm/hr-payroll/attendance'
            }
          >
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
