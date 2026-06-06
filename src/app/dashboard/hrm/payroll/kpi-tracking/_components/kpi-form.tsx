'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
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

// TODO 1E.sweep: status/cadence dropdowns -> <EnumFormField>; owner/employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <KpiForm /> — create + edit form for KPIs.
 *
 * Binds to the `saveKpi` server action via `useActionState`. Frequency
 * and status are controlled `<Select>`s mirrored into hidden inputs
 * so the server action reads them as plain FormData fields.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveKpi } from '@/app/actions/crm-kpis.actions';
import type {
    CrmKpiDoc,
    CrmKpiFrequency,
    CrmKpiStatus,
} from '@/lib/rust-client/crm-kpis';



const BASE = '/dashboard/hrm/payroll/kpi-tracking';

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
            {isEditing ? 'Save changes' : 'Create KPI'}
        </Button>
    );
}

interface KpiFormProps {
    initialData?: CrmKpiDoc | null;
}

export function KpiForm({ initialData }: KpiFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveKpi, initialState);

    const [frequency, setFrequency] = useState<string>(
        (initialData?.frequency as string) ?? '',
    );
    const [status, setStatus] = useState<CrmKpiStatus>(
        (initialData?.status as CrmKpiStatus) ?? 'active',
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="kpiId" value={initialData!._id} />
                ) : null}

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Monthly sales revenue"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="How is this KPI calculated?"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 3: Owner + Department */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="owner">Owner</Label>
                        <Input
                            id="owner"
                            name="owner"
                            placeholder="Owner id or name"
                            defaultValue={initialData?.owner ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="department">Department</Label>
                        <Input
                            id="department"
                            name="department"
                            placeholder="Department"
                            defaultValue={initialData?.department ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Target + Unit + Frequency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="target">Target</Label>
                        <Input
                            id="target"
                            name="target"
                            placeholder="e.g. 100, 95%"
                            defaultValue={initialData?.target ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="unit">Unit</Label>
                        <Input
                            id="unit"
                            name="unit"
                            placeholder="%, $, count, …"
                            defaultValue={initialData?.unit ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Frequency</Label>
                        <EnumFormField
                            name="frequency"
                            enumName="kpiFrequency"
                            initialId={frequency}
                            onChange={(id) => setFrequency(id ?? '')}
                            allowInlineCreate={false}
                            placeholder="Pick a cadence…"
                        />
                    </div>
                </div>

                {/* Row 5: Weight + Category + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="weight">Weight %</Label>
                        <Input
                            id="weight"
                            name="weight"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0–100"
                            defaultValue={
                                typeof initialData?.weight === 'number'
                                    ? String(initialData.weight)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="category">Category</Label>
                        <Input
                            id="category"
                            name="category"
                            placeholder="e.g. Revenue, Quality"
                            defaultValue={initialData?.category ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="kpiFormStatus"
                            initialId={status}
                            onChange={(id) => setStatus((id as CrmKpiStatus) ?? 'active')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to KPIs
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
