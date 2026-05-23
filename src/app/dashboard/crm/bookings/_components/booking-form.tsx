'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
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
 * <BookingForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveBookingAction`. Relational fields use
 * `<EntityFormField>` so the value stored is an id; the status /
 * payment-status pickers use `<Select>` against the wire-format
 * enums declared in `crm-extras-types::booking`.
 *
 * NOTE: There is no custom-fields panel — `'booking'` is intentionally
 * not part of `WsCustomFieldBelongsTo` (see
 * `src/lib/worksuite/meta-types.ts`).
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveBookingAction } from '@/app/actions/crm/bookings.actions';
import type {
  CrmBookingDoc,
  CrmBookingPaymentStatus,
  CrmBookingStatus,
} from '@/lib/rust-client/crm-bookings';

interface BookingFormProps {
  /** Existing booking — present in Edit mode, omit for Create. */
  initial?: CrmBookingDoc | null;
}


function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create booking'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

/**
 * Format an ISO instant for a `<input type="datetime-local">`. The
 * browser expects a "naive" local datetime (`YYYY-MM-DDTHH:mm`) with no
 * trailing `Z`; we strip seconds + timezone so round-trip editing
 * preserves the chosen wall-clock time.
 */
function toLocalDateTimeInput(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function BookingForm({ initial }: BookingFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveBookingAction, INITIAL_STATE);

  const editing = !!initial?._id;

  // Mirror the Select's controlled value into a hidden input so the
  // server action sees it in FormData. (ZoruSelect's underlying Radix
  // primitive isn't itself a form control.)
  const [status, setStatus] = React.useState<CrmBookingStatus>(
    initial?.status ?? 'pending',
  );
  const [paymentStatus, setPaymentStatus] = React.useState<CrmBookingPaymentStatus>(
    initial?.paymentStatus ?? 'unpaid',
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/bookings/${state.id}`
          : '/dashboard/crm/bookings',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="paymentStatus" value={paymentStatus} />

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Basics
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Customer <span className="text-zoru-danger-ink">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="client"
                name="customerId"
                initialId={initial?.customerId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <Label>Service</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="item"
                name="service"
                initialId={initial?.service ?? null}
                placeholder="Select a service or product"
              />
            </div>
          </div>
          <div>
            <Label>
              Assigned staff / resource <span className="text-zoru-danger-ink">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="resourceId"
                initialId={initial?.resourceId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="capacityUsed">Capacity used</Label>
            <Input
              id="capacityUsed"
              name="capacityUsed"
              type="number"
              min={1}
              defaultValue={initial?.capacityUsed ?? 1}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Scheduling
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="slotStart">
              Slot start <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="slotStart"
              name="slotStart"
              type="datetime-local"
              required
              defaultValue={toLocalDateTimeInput(initial?.slotStart)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="slotEnd">
              Slot end <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="slotEnd"
              name="slotEnd"
              type="datetime-local"
              required
              defaultValue={toLocalDateTimeInput(initial?.slotEnd)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="recurringRule">Recurring rule (RRULE)</Label>
            <Input
              id="recurringRule"
              name="recurringRule"
              defaultValue={initial?.recurringRule ?? ''}
              className="mt-1.5"
              placeholder="FREQ=WEEKLY;BYDAY=MO"
            />
          </div>
          <div>
            <Label htmlFor="cancellationPolicy">Cancellation policy</Label>
            <Input
              id="cancellationPolicy"
              name="cancellationPolicy"
              defaultValue={initial?.cancellationPolicy ?? ''}
              className="mt-1.5"
              placeholder="e.g. 24h notice"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Reminders
        </h3>
        <p className="mb-4 text-[12px] text-zoru-ink-muted">Automated reminder emails/SMS configured for this booking.</p>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Reminder Time</Label>
              <Input type="datetime-local" name="reminderAt_0" defaultValue={initial?.reminders?.[0] ? toLocalDateTimeInput(initial.reminders[0].at) : ''} className="mt-1.5" />
            </div>
            <div>
              <Label>Channel</Label>
              <select name="reminderChannel_0" defaultValue={initial?.reminders?.[0]?.channel || ''} className="flex h-9 w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors mt-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-ring">
                <option value="">None</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Status
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Booking status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="bookingStatus"
                initialId={status}
                onChange={(v) => setStatus((v ?? 'pending') as CrmBookingStatus)}
              />
            </div>
            {editing ? (
              <p className="mt-1.5 text-[11.5px] text-zoru-ink-muted">
                Lifecycle transitions belong to dedicated actions
                (check-in, cancel) — this select is ignored on save.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Payment status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="bookingPaymentStatus"
                initialId={paymentStatus}
                onChange={(v) =>
                  setPaymentStatus((v ?? 'unpaid') as CrmBookingPaymentStatus)
                }
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ''}
              className="mt-1.5"
              rows={3}
              placeholder="Internal notes or special instructions…"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/bookings/${String(initial!._id)}`
                : '/dashboard/crm/bookings'
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
