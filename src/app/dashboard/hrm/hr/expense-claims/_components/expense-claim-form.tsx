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
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

// §1E.sweep: status Select kept — form has cancelled/archived slugs missing from expenseClaimStatus enum; extend enum once Rust DTO is confirmed.

/**
 * <ExpenseClaimForm /> — create + edit form for HR expense claims.
 *
 * Binds to `saveExpenseClaim` via `useActionState`. The `receipt_url`
 * slot uses `<SabFilePickerButton>` because the SabFiles project policy
 * forbids any free-text URL paste for file inputs.
 *
 * On create, the server action auto-generates a `claim_number`
 * (`EC-YYYYMM-NNNN`); the field is read-only on edit.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveExpenseClaim } from '@/app/actions/crm-expense-claims.actions';
import type {
    CrmExpenseClaimDoc,
    CrmExpenseClaimStatus,
} from '@/app/actions/crm-expense-claims.actions';

const BASE = '/dashboard/hrm/hr/expense-claims';

const STATUS_OPTIONS: Array<{ value: CrmExpenseClaimStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'reimbursed', label: 'Reimbursed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface ExpenseClaimFormProps {
    initialData?: CrmExpenseClaimDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create expense claim'}
        </ZoruButton>
    );
}

export function ExpenseClaimForm({ initialData }: ExpenseClaimFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveExpenseClaim, initialState);

    const [status, setStatus] = useState<CrmExpenseClaimStatus>(
        (initialData?.status as CrmExpenseClaimStatus) ?? 'submitted',
    );

    // SabFile receipt state. The hidden inputs flow through the form
    // action; the visible UI shows the chosen filename inline.
    const [receiptUrl, setReceiptUrl] = useState<string>(
        initialData?.receipt_url ?? '',
    );
    const [receiptName, setReceiptName] = useState<string>(() => {
        const stored = initialData?.receipt_name;
        if (stored) return stored;
        const u = initialData?.receipt_url;
        if (!u) return '';
        try {
            const path = new URL(u, 'http://x').pathname;
            return decodeURIComponent(path.split('/').pop() ?? '') || u;
        } catch {
            return u;
        }
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickReceipt = (pick: SabFilePick) => {
        setReceiptUrl(pick.url);
        setReceiptName(pick.name);
    };

    const clearReceipt = () => {
        setReceiptUrl('');
        setReceiptName('');
    };

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="claimId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="receipt_url" value={receiptUrl} />
                <input type="hidden" name="receipt_name" value={receiptName} />

                {/* Row 1: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employee_id">Employee id *</ZoruLabel>
                        <ZoruInput
                            id="employee_id"
                            name="employee_id"
                            required
                            placeholder="Employee record id"
                            defaultValue={initialData?.employee_id ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employee_name">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employee_name"
                            name="employee_name"
                            placeholder="Friendly display name"
                            defaultValue={initialData?.employee_name ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Claim number (read-only on edit, auto on create) + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="claim_number_display">
                            Claim number
                        </ZoruLabel>
                        <ZoruInput
                            id="claim_number_display"
                            value={initialData?.claim_number ?? 'Auto-generated on save'}
                            readOnly
                            disabled
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="category_id">Category id</ZoruLabel>
                        <ZoruInput
                            id="category_id"
                            name="category_id"
                            placeholder="Expense category id"
                            defaultValue={initialData?.category_id ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Category name + Expense date */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="category_name">Category name</ZoruLabel>
                        <ZoruInput
                            id="category_name"
                            name="category_name"
                            placeholder="e.g. Travel · Meals"
                            defaultValue={initialData?.category_name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expense_date">Expense date</ZoruLabel>
                        <ZoruInput
                            id="expense_date"
                            name="expense_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.expense_date)}
                        />
                    </div>
                </div>

                {/* Row 4: Amount + Currency + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="amount">Amount *</ZoruLabel>
                        <ZoruInput
                            id="amount"
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            defaultValue={initialData?.amount ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                        <ZoruInput
                            id="currency"
                            name="currency"
                            placeholder="INR"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmExpenseClaimStatus)
                            }
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Row 5: Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="What was the expense for?"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 6: Receipt (SabFile) */}
                <div className="space-y-1.5">
                    <ZoruLabel>Receipt</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="all"
                            onPick={onPickReceipt}
                            title="Pick a receipt file"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {receiptUrl ? 'Replace receipt' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {receiptUrl ? (
                            <>
                                <a
                                    href={receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {receiptName || receiptUrl}
                                </a>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearReceipt}
                                >
                                    Remove
                                </ZoruButton>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No receipt attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 7: Approver */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="approver_id">Approver id</ZoruLabel>
                        <ZoruInput
                            id="approver_id"
                            name="approver_id"
                            placeholder="Optional"
                            defaultValue={initialData?.approver_id ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="approver_name">Approver name</ZoruLabel>
                        <ZoruInput
                            id="approver_name"
                            name="approver_name"
                            defaultValue={initialData?.approver_name ?? ''}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to expense claims
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
