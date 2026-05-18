'use client';

// 1E.sweep: status converted to <EnumFormField enumName="tdsStatus">
// (slugs match: pending/deposited/filed/archived). TODOs remaining:
// - state stays as ZoruSelect over indianStates (dynamic list) — needs
//   <EntityFormField entity="state"> with India-only filter.
// - month is a <input type="month"> (native), not a dropdown.
// - employee → <EntityFormField entity="employee">.

/**
 * <ProfessionalTaxForm /> — create + edit form for monthly PT records.
 *
 * Binds to `saveProfessionalTaxRecord` via `useActionState`. The
 * `slabApplied` descriptor is *not* set client-side — it is resolved and
 * stamped by the server action from `crm_pt_slabs` at save time.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

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
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveProfessionalTaxRecord,
    type CrmProfessionalTaxStatus,
} from '@/app/actions/crm-professional-tax.actions';
import { indianStates } from '@/lib/states';

const BASE = '/dashboard/hrm/payroll/professional-tax';

function currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface ProfessionalTaxFormProps {
    initialData?: Record<string, unknown> | null;
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
            {isEditing ? 'Save changes' : 'Create PT record'}
        </ZoruButton>
    );
}

export function ProfessionalTaxForm({ initialData }: ProfessionalTaxFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveProfessionalTaxRecord,
        initialState,
    );

    const [stateValue, setStateValue] = useState<string>(
        (initialData?.state as string | undefined) ?? '',
    );
    const [status, setStatus] = useState<CrmProfessionalTaxStatus>(
        ((initialData?.status as CrmProfessionalTaxStatus | undefined) ??
            'pending'),
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? `${BASE}/${id}` : BASE);
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
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="recordId"
                        value={String(initialData!._id)}
                    />
                ) : null}
                <input type="hidden" name="state" value={stateValue} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name *</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            required
                            placeholder="e.g. Priya Sharma"
                            defaultValue={
                                (initialData?.employeeName as string | undefined) ?? ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Internal employee id"
                            defaultValue={
                                (initialData?.employeeId as string | undefined) ?? ''
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="state-trigger">State *</ZoruLabel>
                        {/* TODO 1E.sweep: dynamic list — needs <EntityFormField entity="state"> with India-only filter */}
                        <ZoruSelect value={stateValue} onValueChange={setStateValue}>
                            <ZoruSelectTrigger id="state-trigger">
                                <ZoruSelectValue placeholder="Select state…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent className="max-h-60">
                                {indianStates.map((s) => (
                                    <ZoruSelectItem key={s} value={s}>
                                        {s}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="month">Month *</ZoruLabel>
                        <ZoruInput
                            id="month"
                            name="month"
                            type="month"
                            required
                            defaultValue={
                                (initialData?.month as string | undefined) ??
                                currentMonth()
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            name="status-picker"
                            enumName="tdsStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus(
                                    (id as CrmProfessionalTaxStatus) ?? 'pending',
                                )
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="grossSalary">Gross salary (₹)</ZoruLabel>
                        <ZoruInput
                            id="grossSalary"
                            name="grossSalary"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                typeof initialData?.grossSalary === 'number'
                                    ? String(initialData.grossSalary)
                                    : ''
                            }
                        />
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Used to resolve the applicable slab at save time.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="ptAmount">PT amount (₹)</ZoruLabel>
                        <ZoruInput
                            id="ptAmount"
                            name="ptAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                typeof initialData?.ptAmount === 'number'
                                    ? String(initialData.ptAmount)
                                    : ''
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="challanNumber">Challan number</ZoruLabel>
                        <ZoruInput
                            id="challanNumber"
                            name="challanNumber"
                            defaultValue={
                                (initialData?.challanNumber as string | undefined) ?? ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="depositDate">Deposit date</ZoruLabel>
                        <ZoruInput
                            id="depositDate"
                            name="depositDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.depositDate)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={
                            (initialData?.notes as string | undefined) ?? ''
                        }
                    />
                </div>

                {initialData?.slabApplied ? (
                    <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-3 text-[12.5px] text-zoru-ink">
                        <span className="text-zoru-ink-muted">Slab applied:</span>{' '}
                        <span className="font-mono">
                            {initialData.slabApplied as string}
                        </span>
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to PT list
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
