'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <PayrollRunForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `savePayrollRunAction`. The form encodes the
 * curated `CreatePayrollRunInput` from the Rust DTO (period start/end,
 * pay date, lock date, bank file format).
 *
 * NOTE: Post-creation lifecycle actions (compute / approve / disburse)
 * are intentionally NOT exposed here — they live on the detail page,
 * because the Rust handlers require the run to already exist.
 *
 * Custom fields are NOT supported — `'payrollRun'` is not a registered
 * `WsCustomFieldBelongsTo` target.
 */

import * as React from 'react';

import { savePayrollRunAction } from '@/app/actions/crm/payroll-runs.actions';
import type {
  CrmPayrollRunBankFileFormat,
  CrmPayrollRunDoc,
} from '@/lib/rust-client/crm-payroll-runs';

interface PayrollRunFormProps {
  /** Existing run — present in Edit mode, omit for Create. */
  initial?: CrmPayrollRunDoc | null;
}

const BANK_FORMATS: ReadonlyArray<{
  value: CrmPayrollRunBankFileFormat;
  label: string;
}> = [
  { value: 'neft', label: 'NEFT' },
  { value: 'imps', label: 'IMPS' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'upi_bulk', label: 'UPI Bulk' },
];

// Sentinel for "no format selected" — Radix Select disallows empty values.
const NO_BANK_FORMAT = '__none__';

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create payroll run'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function toDateInput(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function PayrollRunForm({ initial }: PayrollRunFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(savePayrollRunAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [bankFileFormat, setBankFileFormat] = React.useState<string>(
    initial?.bankFileFormat ?? '',
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/hr-payroll/payroll/${state.id}`
          : '/dashboard/crm/hr-payroll/payroll',
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
      {/* Hidden field mirrors the controlled <Select> so the form
          submission carries the chosen bank file format. */}
      <input
        type="hidden"
        name="bankFileFormat"
        value={bankFileFormat}
      />

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Period
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="periodFrom">
              Period start <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="periodFrom"
              name="periodFrom"
              type="date"
              required
              defaultValue={toDateInput(initial?.periodFrom)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="periodTo">
              Period end <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="periodTo"
              name="periodTo"
              type="date"
              required
              defaultValue={toDateInput(initial?.periodTo)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="payDate">Pay date</Label>
            <Input
              id="payDate"
              name="payDate"
              type="date"
              defaultValue={toDateInput(initial?.payDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="lockDate">Lock date</Label>
            <Input
              id="lockDate"
              name="lockDate"
              type="date"
              defaultValue={toDateInput(initial?.lockDate)}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Bank disbursal
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="bankFileFormatSelect">Bank file format</Label>
            <div className="mt-1.5">
              <Select
                value={bankFileFormat || NO_BANK_FORMAT}
                onValueChange={(v) =>
                  setBankFileFormat(v === NO_BANK_FORMAT ? '' : v)
                }
              >
                <ZoruSelectTrigger id="bankFileFormatSelect">
                  <ZoruSelectValue placeholder="Select a format" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value={NO_BANK_FORMAT}>None</ZoruSelectItem>
                  {BANK_FORMATS.map((f) => (
                    <ZoruSelectItem key={f.value} value={f.value}>
                      {f.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <p className="mt-1.5 text-[11.5px] text-zoru-ink-muted">
              Format used when generating the disbursal file. Optional —
              can be set later before disbursal.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/hr-payroll/payroll/${String(initial!._id)}`
                : '/dashboard/crm/hr-payroll/payroll'
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
