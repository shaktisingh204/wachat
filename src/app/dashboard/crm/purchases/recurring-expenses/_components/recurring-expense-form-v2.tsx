'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <RecurringExpenseForm /> — create + edit form for recurring expenses.
 *
 * Binds to the `saveRecurringExpense` server action via
 * `useActionState`.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveRecurringExpense,
    type RecurringExpenseDoc,
    type RecurringExpenseFrequency,
    type RecurringExpenseStatus,
} from '@/app/actions/crm-recurring-expenses-v2.actions';

const BASE = '/dashboard/crm/purchases/recurring-expenses';

const FREQUENCY_OPTIONS: Array<{ value: RecurringExpenseFrequency; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

const STATUS_OPTIONS: Array<{ value: RecurringExpenseStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

interface RecurringExpenseFormProps {
    initialData?: RecurringExpenseDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create schedule'}
        </Button>
    );
}

export function RecurringExpenseForm({ initialData }: RecurringExpenseFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveRecurringExpense, initialState);

    const [frequency, setFrequency] = useState<RecurringExpenseFrequency>(
        initialData?.frequency ?? 'monthly',
    );
    const [status, setStatus] = useState<RecurringExpenseStatus>(
        initialData?.status ?? 'active',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="recurringId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="frequency" value={frequency} />
                <input type="hidden" name="status" value={status} />

                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Office rent"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="vendor_id">Vendor id</Label>
                        <Input
                            id="vendor_id"
                            name="vendor_id"
                            placeholder="Vendor id"
                            defaultValue={initialData?.vendor_id ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="expense_category_id">Expense category id</Label>
                        <Input
                            id="expense_category_id"
                            name="expense_category_id"
                            placeholder="Category id"
                            defaultValue={initialData?.expense_category_id ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="amount">Amount *</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            step="0.01"
                            min={0}
                            required
                            defaultValue={initialData?.amount ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
                            id="currency"
                            name="currency"
                            placeholder="INR"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="frequency-trigger">Frequency *</Label>
                        <EnumFormField
                            enumName="recurringFrequency"
                            name="__frequency_picker"
                            initialId={frequency || null}
                            placeholder="Frequency"
                            onChange={(id) => setFrequency((id ?? 'monthly') as RecurringExpenseFrequency)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="start_date">Start date</Label>
                        <Input
                            id="start_date"
                            name="start_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.start_date)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="end_date">End date</Label>
                        <Input
                            id="end_date"
                            name="end_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.end_date)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="next_run_at">Next run</Label>
                        <Input
                            id="next_run_at"
                            name="next_run_at"
                            type="date"
                            defaultValue={toDateInput(initialData?.next_run_at)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="account_id">Account id</Label>
                        <Input
                            id="account_id"
                            name="account_id"
                            placeholder="Bank / cash account id"
                            defaultValue={initialData?.account_id ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <EnumFormField
                            enumName="recurringScheduleStatus"
                            name="__status_picker"
                            initialId={status || null}
                            placeholder="Status"
                            onChange={(id) => setStatus((id ?? 'active') as RecurringExpenseStatus)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to schedules
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
