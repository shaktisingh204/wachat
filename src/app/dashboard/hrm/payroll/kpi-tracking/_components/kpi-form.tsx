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

// TODO 1E.sweep: status/cadence dropdowns -> <EnumFormField>; owner/employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <KpiForm /> — create + edit form for KPIs.
 *
 * Binds to the `saveKpi` server action via `useActionState`. Frequency
 * and status are controlled `<ZoruSelect>`s mirrored into hidden inputs
 * so the server action reads them as plain FormData fields.
 */

import { saveKpi } from '@/app/actions/crm-kpis.actions';
import type {
    CrmKpiDoc,
    CrmKpiFrequency,
    CrmKpiStatus,
} from '@/lib/rust-client/crm-kpis';

import { FREQUENCY_OPTIONS, STATUS_OPTIONS } from '../_config';

const BASE = '/dashboard/hrm/payroll/kpi-tracking';

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
            {isEditing ? 'Save changes' : 'Create KPI'}
        </ZoruButton>
    );
}

interface KpiFormProps {
    initialData?: CrmKpiDoc | null;
}

export function KpiForm({ initialData }: KpiFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
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
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="kpiId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="frequency" value={frequency} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                    <ZoruInput
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Monthly sales revenue"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
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
                        <ZoruLabel htmlFor="owner">Owner</ZoruLabel>
                        <ZoruInput
                            id="owner"
                            name="owner"
                            placeholder="Owner id or name"
                            defaultValue={initialData?.owner ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="department">Department</ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel htmlFor="target">Target</ZoruLabel>
                        <ZoruInput
                            id="target"
                            name="target"
                            placeholder="e.g. 100, 95%"
                            defaultValue={initialData?.target ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="unit">Unit</ZoruLabel>
                        <ZoruInput
                            id="unit"
                            name="unit"
                            placeholder="%, $, count, …"
                            defaultValue={initialData?.unit ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="frequency-trigger">Frequency</ZoruLabel>
                        <ZoruSelect
                            value={frequency}
                            onValueChange={(v) => setFrequency(v as CrmKpiFrequency)}
                        >
                            <ZoruSelectTrigger id="frequency-trigger">
                                <ZoruSelectValue placeholder="Pick a cadence…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {FREQUENCY_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Row 5: Weight + Category + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="weight">Weight %</ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel htmlFor="category">Category</ZoruLabel>
                        <ZoruInput
                            id="category"
                            name="category"
                            placeholder="e.g. Revenue, Quality"
                            defaultValue={initialData?.category ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmKpiStatus)}
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

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to KPIs
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
