'use client';

// TODO 1E.sweep: month/financial-year dropdowns -> <EnumFormField>; employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <TdsForm /> — create + edit form for TDS records.
 * Binds to `saveTdsRecord` via `useActionState`.
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

import {
    saveTdsRecord,
    type CrmTdsQuarter,
    type CrmTdsStatus,
} from '@/app/actions/crm-tds.actions';

const BASE = '/dashboard/hrm/payroll/tds';

const STATUS_OPTIONS: Array<{ value: CrmTdsStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'deposited', label: 'Deposited' },
    { value: 'filed', label: 'Filed' },
    { value: 'archived', label: 'Archived' },
];

const QUARTER_OPTIONS: Array<{ value: CrmTdsQuarter; label: string }> = [
    { value: 'Q1', label: 'Q1 (Apr – Jun)' },
    { value: 'Q2', label: 'Q2 (Jul – Sep)' },
    { value: 'Q3', label: 'Q3 (Oct – Dec)' },
    { value: 'Q4', label: 'Q4 (Jan – Mar)' },
];

function currentFY(): string {
    const now = new Date();
    const sy = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    return `${sy}-${String(sy + 1).slice(-2)}`;
}

function fyOptions(count = 6): string[] {
    const baseYear = (() => {
        const now = new Date();
        return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    })();
    return Array.from({ length: count }, (_, i) => {
        const sy = baseYear - i;
        return `${sy}-${String(sy + 1).slice(-2)}`;
    });
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface TdsFormProps {
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
            {isEditing ? 'Save changes' : 'Create TDS record'}
        </ZoruButton>
    );
}

export function TdsForm({ initialData }: TdsFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveTdsRecord, initialState);

    const [financialYear, setFinancialYear] = useState<string>(
        (initialData?.financialYear as string | undefined) ?? currentFY(),
    );
    const [quarter, setQuarter] = useState<CrmTdsQuarter>(
        ((initialData?.quarter as CrmTdsQuarter | undefined) ?? 'Q1'),
    );
    const [status, setStatus] = useState<CrmTdsStatus>(
        ((initialData?.status as CrmTdsStatus | undefined) ?? 'pending'),
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
                <input type="hidden" name="financialYear" value={financialYear} />
                <input type="hidden" name="quarter" value={quarter} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name *</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            required
                            defaultValue={(initialData?.employeeName as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            defaultValue={(initialData?.employeeId as string | undefined) ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="fy-trigger">Financial year</ZoruLabel>
                        <ZoruSelect value={financialYear} onValueChange={setFinancialYear}>
                            <ZoruSelectTrigger id="fy-trigger">
                                <ZoruSelectValue placeholder="FY" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {fyOptions(6).map((fy) => (
                                    <ZoruSelectItem key={fy} value={fy}>
                                        FY {fy}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="q-trigger">Quarter</ZoruLabel>
                        <ZoruSelect
                            value={quarter}
                            onValueChange={(v) => setQuarter(v as CrmTdsQuarter)}
                        >
                            <ZoruSelectTrigger id="q-trigger">
                                <ZoruSelectValue placeholder="Quarter" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {QUARTER_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmTdsStatus)}
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

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="grossAmount">Gross amount (₹)</ZoruLabel>
                        <ZoruInput
                            id="grossAmount"
                            name="grossAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                typeof initialData?.grossAmount === 'number'
                                    ? String(initialData.grossAmount)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="tdsAmount">TDS amount (₹)</ZoruLabel>
                        <ZoruInput
                            id="tdsAmount"
                            name="tdsAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                typeof initialData?.tdsAmount === 'number'
                                    ? String(initialData.tdsAmount)
                                    : ''
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="certificateNumber">Certificate number</ZoruLabel>
                        <ZoruInput
                            id="certificateNumber"
                            name="certificateNumber"
                            placeholder="e.g. TDS-2025-Q1-001"
                            defaultValue={(initialData?.certificateNumber as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="depositChallanNumber">Deposit challan number</ZoruLabel>
                        <ZoruInput
                            id="depositChallanNumber"
                            name="depositChallanNumber"
                            placeholder="Challan #"
                            defaultValue={(initialData?.depositChallanNumber as string | undefined) ?? ''}
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
                        placeholder="Internal notes…"
                        defaultValue={(initialData?.notes as string | undefined) ?? ''}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to TDS list
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
