'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
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
 * Status is surfaced as a Select for display continuity with the
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
  /** Whether the leave dates/type should be read-only based on HR policy. */
  isLocked?: boolean;
  /** Pass employee leave balances to calculate real-time warnings. */
  leaveBalances?: any[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Submit request'}
    </Button>
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


export function LeaveForm({ initial, leaveTypes, isLocked, leaveBalances }: LeaveFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveLeaveAction, INITIAL_STATE);
  const [warning, setWarning] = React.useState<string | null>(null);

  const editing = !!initial?._id;

  const checkBalances = (e: React.FormEvent<HTMLFormElement>) => {
    if (!leaveBalances || leaveBalances.length === 0 || !editing) return;
    const fd = new FormData(e.currentTarget);
    const ltId = fd.get('leaveTypeId') as string;
    const fromStr = fd.get('from') as string;
    const toStr = fd.get('to') as string;
    const halfDay = fd.get('halfDay') === 'true';

    if (!ltId || !fromStr || !toStr) return;

    let newDays = 1;
    const fromMs = new Date(fromStr).getTime();
    const toMs = new Date(toStr).getTime();
    if (toMs >= fromMs) {
      newDays = Math.max(1, Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24)) + 1);
    }
    if (halfDay) newDays = 0.5;

    const existingTypeId = initial?.leaveTypeId;
    const existingDays = typeof initial?.days === 'number' ? initial.days : 0;
    const isDifferentType = ltId !== existingTypeId;
    const daysToDeduct = isDifferentType ? newDays : newDays - existingDays;

    if (daysToDeduct > 0) {
      const leaveTypeObj = leaveTypes.find(lt => lt._id === ltId);
      if (leaveTypeObj) {
        const matchedBalance = leaveBalances.find(b => 
          b.leaveType.toLowerCase() === leaveTypeObj.code.toLowerCase() || 
          b.leaveType.toLowerCase() === leaveTypeObj.name.toLowerCase() ||
          b.leaveType.replace(/_/g, ' ').toLowerCase() === leaveTypeObj.name.toLowerCase() ||
          b.leaveType.replace(/_/g, ' ').toLowerCase() === leaveTypeObj.code.toLowerCase()
        );
        const remaining = matchedBalance 
           ? Math.max(0, (matchedBalance.allotted || 0) - (matchedBalance.used || 0) - (matchedBalance.pending || 0))
           : 0;

        if (remaining - daysToDeduct < 0) {
           setWarning('Warning: Modifying the leave dates will cause negative leave balances. You only have ' + remaining + ' days remaining for ' + leaveTypeObj.name + '.');
           return;
        }
      }
    }
    setWarning(null);
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/hrm/payroll/leave/${state.id}`
          : '/dashboard/hrm/payroll/leave',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} onChange={checkBalances} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}

      {warning && (
        <div className="rounded-md border border-zoru-line/50 bg-zoru-ink/10 p-4 text-sm font-medium text-zoru-ink">
          {warning}
        </div>
      )}

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Applicant
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Employee</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="employeeId"
                initialId={initial?.assignedTo ?? null}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="leaveTypeId">
              Leave type <span className="text-zoru-danger-ink">*</span>
            </Label>
            <div className="mt-1.5">
              <Select
                name="leaveTypeId"
                defaultValue={initial?.leaveTypeId ?? undefined}
                required
                disabled={isLocked}
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
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Range
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="from">
              Start date <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              required
              disabled={isLocked}
              defaultValue={isoToDateInput(initial?.from)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="to">
              End date <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="to"
              name="to"
              type="date"
              required
              disabled={isLocked}
              defaultValue={isoToDateInput(initial?.to)}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox
              id="halfDay"
              name="halfDay"
              value="true"
              disabled={isLocked}
              defaultChecked={initial?.halfDay ?? false}
            />
            <Label htmlFor="halfDay" className="cursor-pointer">
              Half-day request
            </Label>
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
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="status">Status</Label>
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
            <Label>Approver</Label>
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
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              defaultValue={initial?.reason ?? ''}
              className="mt-1.5"
              rows={4}
              placeholder="Tell the approver why you need this leave…"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/hrm/payroll/leave/${String(initial!._id)}`
                : '/dashboard/hrm/payroll/leave'
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
