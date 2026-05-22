'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
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
 * <TravelRequestForm /> — create + edit form for HR travel requests.
 *
 * Binds to `saveTravelRequest` via `useActionState`. ZoruUI throughout.
 * No file picker here — itinerary attachments are out of scope for this
 * lightweight request record.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveTravelRequest } from '@/app/actions/crm-travel.actions';
import type {
    CrmTravelRequestDoc,
    CrmTravelStatus,
} from '@/app/actions/crm-travel.actions';

const BASE = '/dashboard/hrm/hr/travel';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface TravelRequestFormProps {
    initialData?: CrmTravelRequestDoc | null;
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
            {isEditing ? 'Save changes' : 'Create travel request'}
        </Button>
    );
}

export function TravelRequestForm({ initialData }: TravelRequestFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveTravelRequest, initialState);

    const [mode, setMode] = useState<string>(
        (initialData?.mode as string) ?? 'flight',
    );
    const [status, setStatus] = useState<CrmTravelStatus>(
        (initialData?.status as CrmTravelStatus) ?? 'pending',
    );

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

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="travelId" value={initialData!._id} />
                ) : null}

                {/* Row 1: Employee picker (dual-writes employee_name for legacy callers) */}
                <div className="space-y-1.5">
                    <Label>Employee *</Label>
                    <EntityFormField
                        entity="employee"
                        name="employee_id"
                        dualWriteName="employee_name"
                        initialId={initialData?.employee_id ?? null}
                        initialLabel={initialData?.employee_name ?? ''}
                        allowCreate
                        placeholder="Select employee"
                        required
                    />
                </div>

                {/* Row 2: Purpose */}
                <div className="space-y-1.5">
                    <Label htmlFor="purpose">Purpose</Label>
                    <Input
                        id="purpose"
                        name="purpose"
                        placeholder="e.g. Client kickoff workshop"
                        defaultValue={initialData?.purpose ?? ''}
                    />
                </div>

                {/* Row 3: From / To / Mode */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>From city</Label>
                        <EntityFormField
                            entity="city"
                            name="from_city"
                            initialId={initialData?.from_city ?? null}
                            allowCreate
                            placeholder="From city"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>To city</Label>
                        <EntityFormField
                            entity="city"
                            name="to_city"
                            initialId={initialData?.to_city ?? null}
                            allowCreate
                            placeholder="To city"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Mode</Label>
                        <EnumFormField
                            enumName="travelMode"
                            name="mode"
                            initialId={mode}
                            onChange={(id) => setMode(id ?? 'flight')}
                            placeholder="Mode"
                        />
                    </div>
                </div>

                {/* Row 4: Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="travel_date">Travel date</Label>
                        <Input
                            id="travel_date"
                            name="travel_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.travel_date)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="return_date">Return date</Label>
                        <Input
                            id="return_date"
                            name="return_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.return_date)}
                        />
                    </div>
                </div>

                {/* Row 5: Costs + currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="estimated_cost">Estimated cost</Label>
                        <Input
                            id="estimated_cost"
                            name="estimated_cost"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={initialData?.estimated_cost ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="actual_cost">Actual cost</Label>
                        <Input
                            id="actual_cost"
                            name="actual_cost"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={initialData?.actual_cost ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Currency</Label>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={initialData?.currency ?? 'INR'}
                            allowCreate
                            placeholder="INR"
                        />
                    </div>
                </div>

                {/* Row 6: Approver + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Approver</Label>
                        <EntityFormField
                            entity="employee"
                            name="approver_id"
                            dualWriteName="approver_name"
                            initialId={initialData?.approver_id ?? null}
                            initialLabel={initialData?.approver_name ?? ''}
                            allowCreate
                            placeholder="Select approver"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        {/* TODO 1E.sweep: catalogued travelStatus has 'submitted'+'booked' slugs not in original options; existing 'pending' was renamed. */}
                        <EnumFormField
                            enumName="travelStatus"
                            name="status"
                            initialId={status === 'pending' ? 'submitted' : status}
                            onChange={(id) => {
                                const mapped =
                                    id === 'submitted' ? 'pending' : (id as CrmTravelStatus);
                                setStatus(mapped ?? 'pending');
                            }}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 7: Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to travel requests
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
