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
 * <BookingForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveBookingAction`. Relational fields use
 * `<EntityFormField>` so the value stored is an id; the status /
 * payment-status pickers use `<ZoruSelect>` against the wire-format
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create booking'}
    </ZoruButton>
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

  // Mirror the ZoruSelect's controlled value into a hidden input so the
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

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Basics
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>
              Customer <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
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
            <ZoruLabel>Service</ZoruLabel>
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
            <ZoruLabel>
              Assigned staff / resource <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
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
            <ZoruLabel htmlFor="capacityUsed">Capacity used</ZoruLabel>
            <ZoruInput
              id="capacityUsed"
              name="capacityUsed"
              type="number"
              min={1}
              defaultValue={initial?.capacityUsed ?? 1}
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Scheduling
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="slotStart">
              Slot start <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="slotStart"
              name="slotStart"
              type="datetime-local"
              required
              defaultValue={toLocalDateTimeInput(initial?.slotStart)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="slotEnd">
              Slot end <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="slotEnd"
              name="slotEnd"
              type="datetime-local"
              required
              defaultValue={toLocalDateTimeInput(initial?.slotEnd)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="recurringRule">Recurring rule (RRULE)</ZoruLabel>
            <ZoruInput
              id="recurringRule"
              name="recurringRule"
              defaultValue={initial?.recurringRule ?? ''}
              className="mt-1.5"
              placeholder="FREQ=WEEKLY;BYDAY=MO"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="cancellationPolicy">Cancellation policy</ZoruLabel>
            <ZoruInput
              id="cancellationPolicy"
              name="cancellationPolicy"
              defaultValue={initial?.cancellationPolicy ?? ''}
              className="mt-1.5"
              placeholder="e.g. 24h notice"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Status
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Booking status</ZoruLabel>
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
            <ZoruLabel>Payment status</ZoruLabel>
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
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ''}
              className="mt-1.5"
              rows={3}
              placeholder="Internal notes or special instructions…"
            />
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/bookings/${String(initial!._id)}`
                : '/dashboard/crm/bookings'
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
