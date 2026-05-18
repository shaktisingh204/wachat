'use client';

// TODO 1E.sweep: frequency/component-type dropdowns -> <EnumFormField>; currency -> <EntityFormField entity="currency">; employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <SalaryStructureForm /> — create + edit form for the salary-structure
 * entity (Rust-backed via `crmSalaryStructuresApi`).
 *
 * Submits via `useActionState` → `saveSalaryStructureDoc` server
 * action. Computes a live gross/net preview but final calculation is
 * delegated to the backend (which mirrors the same arithmetic).
 */

import { useActionState, useEffect, useMemo, useState } from 'react';
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
    useZoruToast,
} from '@/components/zoruui';

import { saveSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';
import type {
    CrmSalaryStructureDoc,
    CrmSalaryStructureStatus,
} from '@/lib/rust-client/crm-salary-structures';

const BASE = '/dashboard/hrm/payroll/salary-structure';

const STATUS_OPTIONS: ReadonlyArray<{
    value: CrmSalaryStructureStatus;
    label: string;
}> = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
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
            {isEditing ? 'Save changes' : 'Create structure'}
        </ZoruButton>
    );
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

interface SalaryStructureFormProps {
    initialData?: CrmSalaryStructureDoc | null;
}

export function SalaryStructureForm({ initialData }: SalaryStructureFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveSalaryStructureDoc,
        INITIAL_STATE,
    );

    /* Local numeric mirror for live preview only — form submission still
     * goes through the named `<input>` fields. */
    const [basic, setBasic] = useState<number>(initialData?.basic ?? 0);
    const [hra, setHra] = useState<number>(initialData?.hra ?? 0);
    const [da, setDa] = useState<number>(initialData?.da ?? 0);
    const [other, setOther] = useState<number>(
        initialData?.otherAllowances ?? 0,
    );
    const [pfEmp, setPfEmp] = useState<number>(initialData?.pfEmployee ?? 0);
    const [esi, setEsi] = useState<number>(initialData?.esi ?? 0);
    const [pt, setPt] = useState<number>(initialData?.professionalTax ?? 0);

    const previewGross = useMemo(() => basic + hra + da + other, [
        basic,
        hra,
        da,
        other,
    ]);
    const previewNet = useMemo(
        () => previewGross - pfEmp - esi - pt,
        [previewGross, pfEmp, esi, pt],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
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
                        name="structureId"
                        value={initialData!._id}
                    />
                ) : null}
                {/* Numeric mirrors flow gross / net through to the server
                 *   action so it doesn't have to recompute. */}
                <input type="hidden" name="gross" value={String(previewGross)} />
                <input type="hidden" name="net" value={String(previewNet)} />

                {/* Row 1: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID *</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            required
                            placeholder="Employee Mongo id"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Display label"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Effective from + status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="effectiveFrom">Effective from</ZoruLabel>
                        <ZoruInput
                            id="effectiveFrom"
                            name="effectiveFrom"
                            type="date"
                            defaultValue={toDateInput(initialData?.effectiveFrom)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status">Status</ZoruLabel>
                        <ZoruSelect
                            name="status"
                            defaultValue={initialData?.status ?? 'active'}
                        >
                            <ZoruSelectTrigger id="status">
                                <ZoruSelectValue />
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

                {/* Row 3: Earnings */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Earnings
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="basic">Basic *</ZoruLabel>
                            <ZoruInput
                                id="basic"
                                name="basic"
                                type="number"
                                required
                                value={basic}
                                onChange={(e) => setBasic(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="hra">HRA</ZoruLabel>
                            <ZoruInput
                                id="hra"
                                name="hra"
                                type="number"
                                value={hra}
                                onChange={(e) => setHra(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="da">DA</ZoruLabel>
                            <ZoruInput
                                id="da"
                                name="da"
                                type="number"
                                value={da}
                                onChange={(e) => setDa(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="otherAllowances">Other allowances</ZoruLabel>
                            <ZoruInput
                                id="otherAllowances"
                                name="otherAllowances"
                                type="number"
                                value={other}
                                onChange={(e) =>
                                    setOther(Number(e.target.value) || 0)
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* Row 4: Deductions */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Deductions
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="pfEmployer">PF (employer)</ZoruLabel>
                            <ZoruInput
                                id="pfEmployer"
                                name="pfEmployer"
                                type="number"
                                defaultValue={initialData?.pfEmployer ?? 0}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="pfEmployee">PF (employee)</ZoruLabel>
                            <ZoruInput
                                id="pfEmployee"
                                name="pfEmployee"
                                type="number"
                                value={pfEmp}
                                onChange={(e) =>
                                    setPfEmp(Number(e.target.value) || 0)
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="esi">ESI</ZoruLabel>
                            <ZoruInput
                                id="esi"
                                name="esi"
                                type="number"
                                value={esi}
                                onChange={(e) => setEsi(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="professionalTax">Professional tax</ZoruLabel>
                            <ZoruInput
                                id="professionalTax"
                                name="professionalTax"
                                type="number"
                                value={pt}
                                onChange={(e) => setPt(Number(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 text-[13px]">
                        <div className="text-zoru-ink-muted">Preview gross</div>
                        <div className="font-mono text-[15px] text-zoru-ink">
                            {inr.format(previewGross)}
                        </div>
                    </div>
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 text-[13px]">
                        <div className="text-zoru-ink-muted">Preview net</div>
                        <div className="font-mono text-[15px] text-zoru-ink">
                            {inr.format(previewNet)}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
