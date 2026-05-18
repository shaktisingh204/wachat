'use client';

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
 * <LeaveForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveLeaveAction`. The form mirrors the
 * Rust DTO (`CrmLeaveCreateInput` / `CrmLeaveUpdateInput`): pick an
 * employee + leave type, set the date range, optional half-day, an
 * optional reason, and the approver target.
 *
 * No custom-fields panel — `'leave'` is not a registered
 * `WsCustomFieldBelongsTo` value.
 *
 * Status is surfaced as a ZoruSelect for display continuity with the
 * rest of the CRM forms, but it is NOT forwarded to the Rust DTO —
 * workflow transitions go through dedicated approve / reject / cancel
 * actions. The action layer silently drops the field; see
 * `saveLeaveAction`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveLeaveAction } from '@/app/actions/crm/leaves.actions';
import type {
  CrmLeaveDoc,
  CrmLeaveTypeOption,
} from '@/lib/rust-client/crm-leaves';

interface LeaveFormProps {
  /** Existing leave — present in Edit mode, omit for Create. */
  initial?: CrmLeaveDoc | null;
  /** Catalog of valid `leaveTypeId` values for the dropdown. */
  leaveTypes: CrmLeaveTypeOption[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Submit request'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function isoToDateInput(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Approver derives from the first approver-chain step, when present —
// this keeps the form round-trippable across save/edit cycles even
// though the field isn't part of the create/update DTO.
function initialApproverId(initial?: CrmLeaveDoc | null): string | null {
  return initial?.approverChain?.[0]?.approverId ?? null;
}


export function LeaveForm({ initial, leaveTypes }: LeaveFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveLeaveAction, INITIAL_STATE);

  const editing = !!initial?._id;

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/hr-payroll/leave/${state.id}`
          : '/dashboard/crm/hr-payroll/leave',
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

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Applicant
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Employee</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="employeeId"
                initialId={initial?.assignedTo ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="leaveTypeId">
              Leave type <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <ZoruSelect
                name="leaveTypeId"
                defaultValue={initial?.leaveTypeId ?? undefined}
                required
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Pick a leave type…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {leaveTypes.length === 0 ? (
                    <div className="px-3 py-2 text-[12.5px] text-zoru-ink-muted">
                      No leave types yet — add one under Leave Types.
                    </div>
                  ) : (
                    leaveTypes.map((lt) => (
                      <ZoruSelectItem key={lt._id} value={lt._id}>
                        <span className="font-mono text-[12px] text-zoru-ink-muted">
                          {lt.code}
                        </span>
                        <span className="ml-2">{lt.name}</span>
                      </ZoruSelectItem>
                    ))
                  )}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Range
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="from">
              Start date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="from"
              name="from"
              type="date"
              required
              defaultValue={isoToDateInput(initial?.from)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="to">
              End date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="to"
              name="to"
              type="date"
              required
              defaultValue={isoToDateInput(initial?.to)}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <ZoruCheckbox
              id="halfDay"
              name="halfDay"
              value="true"
              defaultChecked={initial?.halfDay ?? false}
            />
            <ZoruLabel htmlFor="halfDay" className="cursor-pointer">
              Half-day request
            </ZoruLabel>
          </div>
          {editing && typeof initial?.days === 'number' ? (
            <div className="md:col-span-2 rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px] text-zoru-ink-muted">
              Current computed duration:{' '}
              <span className="tabular-nums text-zoru-ink">
                {initial.days} day{initial.days === 1 ? '' : 's'}
              </span>
              . The Rust handler recomputes this whenever the range or
              half-day flag changes.
            </div>
          ) : null}
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="leaveStatus"
                name="status"
                initialId={initial?.status ?? 'pending'}
                disabled={!editing}
              />
            </div>
            <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
              Status transitions go through dedicated approve / reject /
              cancel actions — this control is informational.
            </p>
          </div>
          <div>
            <ZoruLabel>Approver</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="approverId"
                initialId={initialApproverId(initial)}
              />
            </div>
            <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
              Approver chain is appended on the approve action; this
              picker is a hint shown to the reviewer.
            </p>
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="reason">Reason</ZoruLabel>
            <ZoruTextarea
              id="reason"
              name="reason"
              defaultValue={initial?.reason ?? ''}
              className="mt-1.5"
              rows={4}
              placeholder="Tell the approver why you need this leave…"
            />
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/hr-payroll/leave/${String(initial!._id)}`
                : '/dashboard/crm/hr-payroll/leave'
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
