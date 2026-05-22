'use client';

import {
  Button,
  Card,
  Input,
  Label,
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
  LoaderCircle,
  Save } from 'lucide-react';

// TODO 1E.sweep: month -> <EnumFormField enumName="month">; employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <PfEsiForm /> — create + edit form for PF/ESI monthly records.
 * Binds to `savePfEsiRecord` via `useActionState`.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    savePfEsiRecord,
    type CrmPfEsiStatus,
} from '@/app/actions/crm-pf-esi.actions';

const BASE = '/dashboard/hrm/payroll/pf-esi';


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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create record'}
        </Button>
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="recordId"
                        value={String(initialData!._id)}
                    />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeName">Employee name *</Label>
                        <Input
                            id="employeeName"
                            name="employeeName"
                            required
                            defaultValue={(initialData?.employeeName as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input
                            id="employeeId"
                            name="employeeId"
                            defaultValue={(initialData?.employeeId as string | undefined) ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="month">Month (YYYY-MM) *</Label>
                        <Input
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
                        <Label>Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="pfEsiStatus"
                            initialId={status}
                            onChange={(id) => setStatus((id as CrmPfEsiStatus) ?? 'pending')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* PF block */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Provident Fund (PF)
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="pfEmployer">Employer share (₹)</Label>
                            <Input
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
                            <Label htmlFor="pfEmployee">Employee share (₹)</Label>
                            <Input
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
                            <Label htmlFor="pfUan">UAN</Label>
                            <Input
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
                            <Label htmlFor="esiEmployer">Employer share (₹)</Label>
                            <Input
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
                            <Label htmlFor="esiEmployee">Employee share (₹)</Label>
                            <Input
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
                            <Label htmlFor="esiIcNumber">ESI IC number</Label>
                            <Input
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
                        <Label htmlFor="challanNumber">Challan number</Label>
                        <Input
                            id="challanNumber"
                            name="challanNumber"
                            defaultValue={(initialData?.challanNumber as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="depositDate">Deposit date</Label>
                        <Input
                            id="depositDate"
                            name="depositDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.depositDate)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={(initialData?.notes as string | undefined) ?? ''}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to PF/ESI list
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
