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
  ZoruTextarea,
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
  LoaderCircle,
  Save } from 'lucide-react';

// TODO 1E.sweep: month -> <EnumFormField enumName="month">; employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <PfEsiForm /> — create + edit form for PF/ESI monthly records.
 * Binds to `savePfEsiRecord` via `useActionState`.
 */

import {
    savePfEsiRecord,
    type CrmPfEsiStatus,
} from '@/app/actions/crm-pf-esi.actions';

const BASE = '/dashboard/hrm/payroll/pf-esi';

const STATUS_OPTIONS: Array<{ value: CrmPfEsiStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'deposited', label: 'Deposited' },
    { value: 'filed', label: 'Filed' },
    { value: 'archived', label: 'Archived' },
];

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

interface PfEsiFormProps {
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
            {isEditing ? 'Save changes' : 'Create record'}
        </ZoruButton>
    );
}

export function PfEsiForm({ initialData }: PfEsiFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePfEsiRecord, initialState);

    const [status, setStatus] = useState<CrmPfEsiStatus>(
        ((initialData?.status as CrmPfEsiStatus | undefined) ?? 'pending'),
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

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="month">Month (YYYY-MM) *</ZoruLabel>
                        <ZoruInput
                            id="month"
                            name="month"
                            type="month"
                            required
                            defaultValue={
                                (initialData?.month as string | undefined) ?? currentMonth()
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmPfEsiStatus)}
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

                {/* PF block */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Provident Fund (PF)
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="pfEmployer">Employer share (₹)</ZoruLabel>
                            <ZoruInput
                                id="pfEmployer"
                                name="pfEmployer"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={
                                    typeof initialData?.pfEmployer === 'number'
                                        ? String(initialData.pfEmployer)
                                        : ''
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="pfEmployee">Employee share (₹)</ZoruLabel>
                            <ZoruInput
                                id="pfEmployee"
                                name="pfEmployee"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={
                                    typeof initialData?.pfEmployee === 'number'
                                        ? String(initialData.pfEmployee)
                                        : ''
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="pfUan">UAN</ZoruLabel>
                            <ZoruInput
                                id="pfUan"
                                name="pfUan"
                                placeholder="12-digit UAN"
                                defaultValue={(initialData?.pfUan as string | undefined) ?? ''}
                            />
                        </div>
                    </div>
                </div>

                {/* ESI block */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Employee State Insurance (ESI)
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="esiEmployer">Employer share (₹)</ZoruLabel>
                            <ZoruInput
                                id="esiEmployer"
                                name="esiEmployer"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={
                                    typeof initialData?.esiEmployer === 'number'
                                        ? String(initialData.esiEmployer)
                                        : ''
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="esiEmployee">Employee share (₹)</ZoruLabel>
                            <ZoruInput
                                id="esiEmployee"
                                name="esiEmployee"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={
                                    typeof initialData?.esiEmployee === 'number'
                                        ? String(initialData.esiEmployee)
                                        : ''
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="esiIcNumber">ESI IC number</ZoruLabel>
                            <ZoruInput
                                id="esiIcNumber"
                                name="esiIcNumber"
                                defaultValue={(initialData?.esiIcNumber as string | undefined) ?? ''}
                            />
                        </div>
                    </div>
                </div>

                {/* Deposit block */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="challanNumber">Challan number</ZoruLabel>
                        <ZoruInput
                            id="challanNumber"
                            name="challanNumber"
                            defaultValue={(initialData?.challanNumber as string | undefined) ?? ''}
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
                        defaultValue={(initialData?.notes as string | undefined) ?? ''}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to PF/ESI list
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
