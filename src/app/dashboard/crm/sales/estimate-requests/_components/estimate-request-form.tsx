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
  useId,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <EstimateRequestForm /> — create + edit form for CRM Sales
 * Estimate Requests.
 *
 * Binds to the `saveEstimateRequest` server action via `useActionState`.
 * Captures: customerName, customerEmail, requirements, budgetRange,
 * deadline, source, status, assignedToId, notes.
 */

import {
    saveEstimateRequest,
    type CrmEstimateRequestSource,
    type CrmEstimateRequestStatus,
} from '@/app/actions/crm-estimate-requests.actions';

const BASE = '/dashboard/crm/sales/estimate-requests';

const SOURCE_OPTIONS: Array<{ value: CrmEstimateRequestSource; label: string }> = [
    { value: 'web', label: 'Website' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'referral', label: 'Referral' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: Array<{ value: CrmEstimateRequestStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_review', label: 'In review' },
    { value: 'quoted', label: 'Quoted' },
    { value: 'declined', label: 'Declined' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
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
            {isEditing ? 'Save changes' : 'Create request'}
        </ZoruButton>
    );
}

export interface EstimateRequestFormProps {
    initialData?: Record<string, unknown> | null;
}

export function EstimateRequestForm({ initialData }: EstimateRequestFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const reactId = useId();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveEstimateRequest, initialState);

    const [source, setSource] = useState<CrmEstimateRequestSource>(
        (initialData?.source as CrmEstimateRequestSource) ?? 'web',
    );
    const [status, setStatus] = useState<CrmEstimateRequestStatus>(
        (initialData?.status as CrmEstimateRequestStatus) ?? 'pending',
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
                        name="requestId"
                        value={initialData!._id as string}
                    />
                ) : null}
                <input type="hidden" name="source" value={source} />
                <input type="hidden" name="status" value={status} />

                {/* Customer name + email */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="customerName">
                            Customer name *
                        </ZoruLabel>
                        <ZoruInput
                            id="customerName"
                            name="customerName"
                            required
                            placeholder="Jane Doe"
                            defaultValue={
                                (initialData?.customerName as string) ?? ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="customerEmail">
                            Customer email
                        </ZoruLabel>
                        <ZoruInput
                            id="customerEmail"
                            name="customerEmail"
                            type="email"
                            placeholder="jane@example.com"
                            defaultValue={
                                (initialData?.customerEmail as string) ?? ''
                            }
                        />
                    </div>
                </div>

                {/* Requirements */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="requirements">Requirements *</ZoruLabel>
                    <ZoruTextarea
                        id="requirements"
                        name="requirements"
                        required
                        rows={6}
                        placeholder="What does the customer need an estimate for?"
                        defaultValue={
                            (initialData?.requirements as string) ?? ''
                        }
                    />
                </div>

                {/* Budget + Deadline */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="budgetRange">Budget range</ZoruLabel>
                        <ZoruInput
                            id="budgetRange"
                            name="budgetRange"
                            placeholder="e.g. ₹50,000 – ₹1,00,000"
                            defaultValue={
                                (initialData?.budgetRange as string) ?? ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="deadline">Deadline</ZoruLabel>
                        <ZoruInput
                            id="deadline"
                            name="deadline"
                            type="date"
                            defaultValue={toDateInput(initialData?.deadline)}
                        />
                    </div>
                </div>

                {/* Source + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor={`${reactId}-source`}>Source</ZoruLabel>
                        <ZoruSelect
                            value={source}
                            onValueChange={(v) =>
                                setSource(v as CrmEstimateRequestSource)
                            }
                        >
                            <ZoruSelectTrigger id={`${reactId}-source`}>
                                <ZoruSelectValue placeholder="Source" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {SOURCE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor={`${reactId}-status`}>Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmEstimateRequestStatus)
                            }
                        >
                            <ZoruSelectTrigger id={`${reactId}-status`}>
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

                {/* Assigned + Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="assignedToId">Assigned to (user id)</ZoruLabel>
                    <ZoruInput
                        id="assignedToId"
                        name="assignedToId"
                        placeholder="Optional — owner user id"
                        defaultValue={
                            (initialData?.assignedToId as string) ?? ''
                        }
                    />
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Internal notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={4}
                        placeholder="Internal-only notes about this request."
                        defaultValue={(initialData?.notes as string) ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to requests
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
