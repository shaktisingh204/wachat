'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
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
import { LoaderCircle,
  Paperclip } from 'lucide-react';

/**
 * <PayslipForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `savePayslipAction`. Encodes the curated
 * `CrmPayslipCreateInput` from the Rust DTO (employee, pay period,
 * earnings + deductions, totals, status).
 *
 * SabFiles compliance: the PDF attachment uses `<SabFilePickerButton>`
 * rather than a free-text URL field. The Rust DTO doesn't yet have a
 * slot for the file id — the picker output is held in form state and
 * dropped on submit until the backend grows the column. See
 * `crm-payslips.actions.ts` for the matching note.
 *
 * Custom fields are NOT supported — `'payslip'` is not a registered
 * `WsCustomFieldBelongsTo` target.
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';
import { savePayslipAction } from '@/app/actions/crm-payslips.actions';
import type {
    CrmPayslipDoc,
    CrmPayslipStatus,
} from '@/lib/rust-client/crm-payslips';

interface PayslipFormProps {
    /** Existing payslip — present in Edit mode, omit for Create. */
    initial?: CrmPayslipDoc | null;
}

const STATUS_OPTIONS: ReadonlyArray<{
    value: CrmPayslipStatus;
    label: string;
}> = [
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'paid', label: 'Paid' },
    { value: 'archived', label: 'Archived' },
];

const INITIAL_STATE: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ editing }: { editing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            {editing ? 'Save changes' : 'Create payslip'}
        </ZoruButton>
    );
}

function toMonthInput(v?: string): string {
    if (!v) return '';
    const m = /^(\d{4})-(\d{2})/.exec(v);
    return m ? `${m[1]}-${m[2]}` : '';
}

function toDateInput(v?: string): string {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function PayslipForm({ initial }: PayslipFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction] = useActionState(
        savePayslipAction,
        INITIAL_STATE,
    );

    const editing = !!initial?._id;

    const [status, setStatus] = React.useState<CrmPayslipStatus>(
        (initial?.status as CrmPayslipStatus | undefined) ?? 'draft',
    );

    // PDF attachment — picker is shown for SabFiles policy compliance.
    // The id is held locally only; the Rust DTO has no slot for it yet
    // so we do NOT post it back to the server.
    const [pdfFileId, setPdfFileId] = React.useState<string>('');
    const [pdfFileName, setPdfFileName] = React.useState<string>('');

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(
                state.id
                    ? `/dashboard/crm/hr-payroll/payslips/${state.id}`
                    : '/dashboard/crm/hr-payroll/payslips',
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
                <input
                    type="hidden"
                    name="_id"
                    value={String(initial!._id)}
                />
            ) : null}
            <input type="hidden" name="status" value={status} />

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Employee &amp; period
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="employeeId">
                            Employee ID <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            required
                            defaultValue={initial?.employeeId ?? ''}
                            placeholder="emp_…"
                            className="mt-1.5 font-mono"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            defaultValue={initial?.employeeName ?? ''}
                            placeholder="Cached name for display"
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="payPeriod">
                            Pay period <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="payPeriod"
                            name="payPeriod"
                            type="month"
                            required
                            defaultValue={toMonthInput(initial?.payPeriod)}
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="issuedAt">Issued on</ZoruLabel>
                        <ZoruInput
                            id="issuedAt"
                            name="issuedAt"
                            type="date"
                            defaultValue={toDateInput(initial?.issuedAt)}
                            className="mt-1.5"
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Earnings
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <NumberField
                        id="basic"
                        label="Basic"
                        defaultValue={initial?.basic}
                        required
                    />
                    <NumberField
                        id="hra"
                        label="HRA"
                        defaultValue={initial?.hra}
                        required
                    />
                    <NumberField
                        id="allowances"
                        label="Allowances"
                        defaultValue={initial?.allowances}
                    />
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Deductions
                </h3>
                <div className="grid gap-4 md:grid-cols-4">
                    <NumberField
                        id="pf"
                        label="PF"
                        defaultValue={initial?.pf}
                    />
                    <NumberField
                        id="esi"
                        label="ESI"
                        defaultValue={initial?.esi}
                    />
                    <NumberField
                        id="tax"
                        label="Tax"
                        defaultValue={initial?.tax}
                    />
                    <NumberField
                        id="deductions"
                        label="Other"
                        defaultValue={initial?.deductions}
                    />
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Totals
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <NumberField
                        id="gross"
                        label="Gross"
                        defaultValue={initial?.gross}
                        hint="Leave blank to auto-compute from earnings."
                    />
                    <NumberField
                        id="net"
                        label="Net"
                        defaultValue={initial?.net}
                        hint="Leave blank to auto-compute (gross − deductions)."
                    />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="statusSelect">Status</ZoruLabel>
                        <div className="mt-1.5">
                            <ZoruSelect
                                value={status}
                                onValueChange={(v) =>
                                    setStatus(v as CrmPayslipStatus)
                                }
                            >
                                <ZoruSelectTrigger id="statusSelect">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <ZoruSelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    PDF attachment
                </h3>
                <p className="mb-3 text-[12px] text-zoru-ink-muted">
                    Pick a payslip PDF from your SabFiles library or upload a
                    fresh one. Storage of the attachment is pending backend
                    support — the picker is shown here for policy compliance.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <SabFilePickerButton
                        accept="document"
                        onPick={(p) => {
                            setPdfFileId(p?.id ?? '');
                            setPdfFileName(p?.name ?? '');
                        }}
                    >
                        <Paperclip className="mr-1.5 h-4 w-4" />
                        {pdfFileId ? 'Replace PDF' : 'Choose PDF'}
                    </SabFilePickerButton>
                    {pdfFileName ? (
                        <span className="text-[12px] text-zoru-ink">
                            {pdfFileName}
                        </span>
                    ) : null}
                </div>
            </ZoruCard>

            <div className="flex justify-end gap-2">
                <ZoruButton variant="outline" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/hr-payroll/payslips/${String(
                                      initial!._id,
                                  )}`
                                : '/dashboard/crm/hr-payroll/payslips'
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

/* ─── Small helpers ──────────────────────────────────────────────── */

interface NumberFieldProps {
    id: string;
    label: string;
    defaultValue?: number;
    required?: boolean;
    hint?: string;
}

function NumberField({
    id,
    label,
    defaultValue,
    required,
    hint,
}: NumberFieldProps) {
    return (
        <div>
            <ZoruLabel htmlFor={id}>
                {label}
                {required ? (
                    <span className="text-zoru-danger-ink"> *</span>
                ) : null}
            </ZoruLabel>
            <ZoruInput
                id={id}
                name={id}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required={required}
                defaultValue={
                    defaultValue == null
                        ? ''
                        : String(defaultValue)
                }
                className="mt-1.5 font-mono"
            />
            {hint ? (
                <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p>
            ) : null}
        </div>
    );
}
