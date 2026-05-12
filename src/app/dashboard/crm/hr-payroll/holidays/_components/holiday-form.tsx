'use client';

/**
 * <HolidayForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `saveHolidayAction`. The form posts the
 * holiday name, date, type, optional country/state, recurring flag,
 * and a free-text description. Holidays are not eligible for custom
 * fields (`'holiday'` is not in `WsCustomFieldBelongsTo`), so no
 * custom-fields panel is rendered.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveHolidayAction } from '@/app/actions/crm/holidays.actions';
import type {
  CrmHolidayDoc,
  CrmHolidayType,
} from '@/lib/rust-client/crm-holidays';

interface HolidayFormProps {
  /** Existing holiday — present in Edit mode, omit for Create. */
  initial?: CrmHolidayDoc | null;
}

const TYPE_OPTIONS: { value: CrmHolidayType; label: string }[] = [
  { value: 'national', label: 'National' },
  { value: 'regional', label: 'Regional' },
  { value: 'religious', label: 'Religious' },
  { value: 'optional', label: 'Optional' },
  { value: 'restricted', label: 'Restricted' },
];

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create holiday'}
    </ZoruButton>
  );
}

function looksLikeObjectId(v?: string | null): boolean {
  return !!v && /^[0-9a-fA-F]{24}$/.test(v);
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function HolidayForm({ initial }: HolidayFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveHolidayAction, INITIAL_STATE);

  const editing = !!initial?._id;

  // Locations in the Rust DTO are a flat string[]. The form has two
  // distinct pickers (country + state); seed each from the first two
  // ObjectId-shaped entries.
  const seedLocations = React.useMemo(() => {
    const oids = (initial?.applicableLocations ?? []).filter(
      looksLikeObjectId,
    );
    return { country: oids[0] ?? null, state: oids[1] ?? null };
  }, [initial?.applicableLocations]);

  const initialDate = React.useMemo(() => {
    if (!initial?.date) return '';
    const d = new Date(initial.date);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }, [initial?.date]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/hr-payroll/holidays/${state.id}`
          : '/dashboard/crm/hr-payroll/holidays',
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
          Holiday
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="name">
              Name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? ''}
              placeholder="Republic Day"
              className="mt-1.5"
            />
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
              defaultValue={initialDate}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="holidayType">Type</ZoruLabel>
            <div className="mt-1.5">
              <ZoruSelect
                name="holidayType"
                defaultValue={initial?.holidayType ?? 'national'}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Pick a type…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <ZoruSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <ZoruCheckbox
              id="recurring"
              name="recurring"
              value="true"
              defaultChecked={initial?.recurring ?? false}
            />
            <ZoruLabel htmlFor="recurring" className="cursor-pointer">
              Repeats every year on the same date
            </ZoruLabel>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Applicable region
        </h3>
        <p className="mb-4 text-[12.5px] text-zoru-ink-muted">
          Leave both blank if the holiday applies project-wide.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Country</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="country"
                name="countryId"
                initialId={seedLocations.country}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>State / Region</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="state"
                name="stateId"
                initialId={seedLocations.state}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Description
        </h3>
        <div>
          <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
          <ZoruTextarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ''}
            rows={4}
            placeholder="Optional context — bank holiday, branch closures, etc."
            className="mt-1.5"
          />
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/hr-payroll/holidays/${String(initial!._id)}`
                : '/dashboard/crm/hr-payroll/holidays'
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
