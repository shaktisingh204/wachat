'use client';

/**
 * <EmployeeForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveEmployeeAction`. The form encodes every
 * relational/reference field as an `<EntityFormField>` so the value
 * stored is an id (or a string for inline-create entities). Custom
 * fields are rendered below the standard fields and submitted as a
 * single `customFields` JSON blob — the action layer fans them out via
 * `applyCustomFieldsToEntity`.
 *
 * Employee is the heaviest CRM/HRM entity, so the form is split into
 * four logical cards (Identity, Organization, Employment, Personal)
 * plus the custom-fields panel.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveEmployeeAction } from '@/app/actions/crm/employees.actions';
import type { CrmEmployeeDoc } from '@/lib/rust-client/crm-employees';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface EmployeeFormProps {
  /** Existing employee — present in Edit mode, omit for Create. */
  initial?: CrmEmployeeDoc | null;
  /** Custom field definitions for `belongs_to = 'employee'`. */
  customFields: WsCustomField[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create employee'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

/** Normalize an ISO/date string to the `YYYY-MM-DD` value an
 *  `<input type="date">` expects, or empty when absent/invalid. */
function dateValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function EmployeeForm({ initial, customFields }: EmployeeFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveEmployeeAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >(() => {
    const seed: Record<string, CustomFieldValue> = {};
    const bag = (initial?.customFields ?? {}) as Record<string, unknown>;
    for (const f of customFields) {
      const v = bag[f.name];
      if (v !== undefined) {
        seed[f.name] = v as CustomFieldValue;
      }
    }
    return seed;
  });

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/hr-payroll/employees/${state.id}`
          : '/dashboard/crm/hr-payroll/employees',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const handleCustomFieldChange = (name: string, next: CustomFieldValue) => {
    setCustomFieldValues((prev) => ({ ...prev, [name]: next }));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFieldValues)}
      />

      {/* ─── Identity ───────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Identity
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Salutation</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="salutation"
                name="salutation"
                initialId={initial?.salutation ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="displayName">Display name</ZoruLabel>
            <ZoruInput
              id="displayName"
              name="displayName"
              defaultValue={initial?.displayName ?? ''}
              placeholder="How they appear across the app"
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="firstName">
              First name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="firstName"
              name="firstName"
              required
              defaultValue={initial?.firstName ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="lastName">
              Last name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="lastName"
              name="lastName"
              required
              defaultValue={initial?.lastName ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="workEmail">
              Work email <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="workEmail"
              name="workEmail"
              type="email"
              required
              defaultValue={initial?.workEmail ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="workPhone">Work phone</ZoruLabel>
            <ZoruInput
              id="workPhone"
              name="workPhone"
              type="tel"
              defaultValue={initial?.workPhone ?? ''}
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="employeeCodeDisplay">Employee code</ZoruLabel>
            <ZoruInput
              id="employeeCodeDisplay"
              value={initial?.employeeId ?? 'auto-generated on create'}
              disabled
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      {/* ─── Organization ───────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Organization
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>
              Department <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="department"
                name="departmentId"
                initialId={initial?.departmentId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel>
              Designation <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="designation"
                name="designationId"
                initialId={initial?.designationId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Reporting manager</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="reportingManagerId"
                initialId={initial?.reportingManagerId ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Dotted-line manager</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="dottedLineManagerId"
                initialId={initial?.dottedLineManagerId ?? null}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="workLocationDisplay">Work location</ZoruLabel>
            <ZoruInput
              id="workLocationDisplay"
              value={initial?.workLocation ?? '—'}
              disabled
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      {/* ─── Employment ─────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Employment
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="joiningDate">
              Joining date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="joiningDate"
              name="joiningDate"
              type="date"
              required
              defaultValue={dateValue(initial?.joiningDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="employmentType">Employment type</ZoruLabel>
            <select
              id="employmentType"
              name="employmentType"
              defaultValue={initial?.employmentType ?? 'full_time'}
              className="mt-1.5 h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
            >
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
              <option value="consultant">Consultant</option>
            </select>
          </div>
          <div>
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? 'active'}
              className="mt-1.5 h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
            >
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="terminated">Terminated</option>
              <option value="resigned">Resigned</option>
            </select>
          </div>
          <div>
            <ZoruLabel htmlFor="salaryStructureId">
              Salary structure id <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="salaryStructureId"
              name="salaryStructureId"
              required
              defaultValue={initial?.salaryStructureId ?? ''}
              placeholder="24-char hex id"
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="ctc">CTC (annual)</ZoruLabel>
            <ZoruInput
              id="ctc"
              name="ctc"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.ctc ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="variablePct">Variable pay %</ZoruLabel>
            <ZoruInput
              id="variablePct"
              name="variablePct"
              type="number"
              step="0.1"
              min={0}
              max={100}
              defaultValue={initial?.variablePct ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="noticePeriodDays">Notice period (days)</ZoruLabel>
            <ZoruInput
              id="noticePeriodDays"
              name="noticePeriodDays"
              type="number"
              min={0}
              defaultValue={initial?.noticePeriodDays ?? ''}
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      {/* ─── Personal ───────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Personal
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="dob">
              Date of birth <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="dob"
              name="dob"
              type="date"
              required
              defaultValue={dateValue(initial?.dob)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="gender">Gender</ZoruLabel>
            <select
              id="gender"
              name="gender"
              defaultValue={initial?.gender ?? ''}
              className="mt-1.5 h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <ZoruLabel htmlFor="personalEmail">Personal email</ZoruLabel>
            <ZoruInput
              id="personalEmail"
              name="personalEmail"
              type="email"
              defaultValue={initial?.personalEmail ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="personalPhone">Personal phone</ZoruLabel>
            <ZoruInput
              id="personalPhone"
              name="personalPhone"
              type="tel"
              defaultValue={initial?.personalPhone ?? ''}
              className="mt-1.5"
            />
          </div>
          {/* Address pickers — the current Rust create/update DTO doesn't
              accept a structured address payload yet, so the country/state/city
              fields are exposed here for capture only. Once §9.1 address-edit
              ships, these can be wired through `address.current.*` patches. */}
          <div>
            <ZoruLabel>Country</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="country"
                name="addressCountry"
                initialId={initial?.address?.current?.country ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>State</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="state"
                name="addressState"
                initialId={initial?.address?.current?.state ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>City</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="city"
                name="addressCity"
                initialId={initial?.address?.current?.city ?? null}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      {customFields.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <CustomFieldInput
                key={String(f._id ?? f.name)}
                field={f}
                value={customFieldValues[f.name]}
                onChange={(v) => handleCustomFieldChange(f.name, v)}
              />
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/hr-payroll/employees/${String(initial!._id)}`
                : '/dashboard/crm/hr-payroll/employees'
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
