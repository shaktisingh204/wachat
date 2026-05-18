'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

/**
 * <RecurringExpenseForm /> — single source of truth for the Create and
 * Edit flows of `/dashboard/crm/purchases/recurring-expenses`.
 *
 * Binds to the `saveRecurringExpense` server action via `useActionState`.
 * The action accepts a hidden `_id` field to switch between insert /
 * update on the Mongo `crm_recurring_expenses` collection.
 *
 * Per project policy:
 *   - Vendor + Category use `<EntityFormField>` (no free-text URL paste
 *     for files; entity pickers handle the linking).
 *   - Bank account is picked via `<EntityFormField entity="bankAccount">`
 *     to mirror the Payouts module.
 *   - ZoruUI components only — no shadcn directly.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { saveRecurringExpense } from '@/app/actions/worksuite/billing.actions';
import type {
    WsFrequency,
    WsRecurringExpense,
    WsRecurringStatus,
} from '@/lib/worksuite/billing-types';

const BASE = '/dashboard/crm/purchases/recurring-expenses';

const INITIAL_STATE: { message?: string; error?: string; id?: string } = {};

interface RecurringExpenseFormProps {
    /**
     * Optional existing schedule — when provided the form switches to Edit
     * mode (renders a hidden `_id` and submits PATCH semantics on the
     * server side).
     */
    initialData?: (WsRecurringExpense & { _id: string | unknown }) | null;
}

/** Convert any Mongo / ISO-shaped date into `YYYY-MM-DD` for the input. */
function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string | number | Date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create schedule'}
        </ZoruButton>
    );
}

export function RecurringExpenseForm({ initialData }: RecurringExpenseFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveRecurringExpense,
        INITIAL_STATE,
    );

    // Controlled selects — the form action reads matched hidden inputs.
    const [frequency, setFrequency] = useState<WsFrequency>(
        (initialData?.frequency as WsFrequency) ?? 'months',
    );
    const [status, setStatus] = useState<WsRecurringStatus>(
        (initialData?.status as WsRecurringStatus) ?? 'active',
    );

    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id =
                state.id ??
                (initialData?._id ? String(initialData._id) : undefined);
            if (id) {
                router.push(`${BASE}/${id}`);
            } else {
                router.push(BASE);
            }
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const startDateDefault =
        toDateInput(initialData?.start_date) ||
        new Date().toISOString().slice(0, 10);

    return (
        <form
            action={formAction}
            className="flex w-full flex-col gap-6"
            onChange={() => setDirty(true)}
            onSubmit={() => setDirty(false)}
        >
            <DirtyFormPrompt dirty={dirty} />

            {/* Hidden inputs flowing controlled state back into the action. */}
            {isEditing ? (
                <input
                    type="hidden"
                    name="_id"
                    value={String(initialData!._id)}
                />
            ) : null}
            <input type="hidden" name="frequency" value={frequency} />
            <input type="hidden" name="status" value={status} />

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Schedule details
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5 md:col-span-2">
                        <ZoruLabel className="text-foreground">
                            Name <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            name="name"
                            required
                            placeholder="e.g. AWS hosting"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Currency</ZoruLabel>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={initialData?.currency ?? 'INR'}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">
                            Amount <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            name="amount"
                            type="number"
                            step="0.01"
                            required
                            defaultValue={initialData?.amount ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Vendor</ZoruLabel>
                        <EntityFormField
                            entity="vendor"
                            name="vendor_id"
                            dualWriteName="vendor"
                            initialId={
                                initialData?.vendor &&
                                typeof initialData.vendor === 'string'
                                    ? initialData.vendor
                                    : undefined
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Category</ZoruLabel>
                        <EntityFormField
                            entity="category"
                            name="category_id"
                            dualWriteName="category_name"
                            initialId={
                                initialData?.category_id
                                    ? String(initialData.category_id)
                                    : undefined
                            }
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Recurrence
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Every</ZoruLabel>
                        <ZoruInput
                            name="frequency_count"
                            type="number"
                            min={1}
                            defaultValue={initialData?.frequency_count ?? 1}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Frequency</ZoruLabel>
                        <EnumFormField
                            enumName="wsFrequency"
                            name="__frequency_picker"
                            initialId={frequency || null}
                            onChange={(id) => setFrequency((id ?? 'months') as WsFrequency)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">
                            Start date{' '}
                            <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            name="start_date"
                            type="date"
                            defaultValue={startDateDefault}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Until date</ZoruLabel>
                        <ZoruInput
                            name="until_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.until_date)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">
                            Stop after N runs
                        </ZoruLabel>
                        <ZoruInput
                            name="stop_at_count"
                            type="number"
                            min={0}
                            defaultValue={initialData?.stop_at_count ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">Status</ZoruLabel>
                        <EnumFormField
                            enumName="wsRecurringStatus"
                            name="__status_picker"
                            initialId={status || null}
                            onChange={(id) => setStatus((id ?? 'active') as WsRecurringStatus)}
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Payment
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">
                            Payment method
                        </ZoruLabel>
                        <ZoruInput
                            name="payment_method"
                            placeholder="Cash, Card, Bank, …"
                            defaultValue={initialData?.payment_method ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-foreground">
                            Bank account
                        </ZoruLabel>
                        <EntityFormField
                            entity="bankAccount"
                            name="bank_account_id"
                            initialId={
                                initialData?.bank_account_id
                                    ? String(initialData.bank_account_id)
                                    : undefined
                            }
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Notes
                </h3>
                <ZoruTextarea
                    name="notes"
                    rows={3}
                    defaultValue={initialData?.notes ?? ''}
                />
            </ZoruCard>

            <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-zoru-line bg-zoru-bg px-2 py-3">
                <ZoruButton variant="outline" asChild>
                    <Link
                        href={
                            isEditing
                                ? `${BASE}/${String(initialData!._id)}`
                                : BASE
                        }
                    >
                        Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
