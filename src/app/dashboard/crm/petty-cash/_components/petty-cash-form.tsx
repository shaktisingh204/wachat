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

/**
 * <PettyCashForm /> — create + edit form for petty-cash floats.
 *
 * Binds to the `savePettyCashFloat` server action via `useActionState`.
 */

import { savePettyCashFloat } from '@/app/actions/crm-petty-cash.actions';
import type {
    CrmPettyCashFloatDoc,
    CrmPettyCashStatus,
} from '@/lib/rust-client/crm-petty-cash';

const BASE = '/dashboard/crm/petty-cash';

const STATUS_OPTIONS: Array<{ value: CrmPettyCashStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
];

interface PettyCashFormProps {
    initialData?: CrmPettyCashFloatDoc | null;
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
            {isEditing ? 'Save changes' : 'Create float'}
        </ZoruButton>
    );
}

export function PettyCashForm({ initialData }: PettyCashFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePettyCashFloat, initialState);
    const [status, setStatus] = useState<CrmPettyCashStatus>(
        (initialData?.status as CrmPettyCashStatus) ?? 'active',
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
                    <input type="hidden" name="floatId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Branch + Custodian */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="branchName">Branch name *</ZoruLabel>
                        <ZoruInput
                            id="branchName"
                            name="branchName"
                            required
                            placeholder="e.g. Mumbai HQ"
                            defaultValue={initialData?.branchName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="custodianName">Custodian name</ZoruLabel>
                        <ZoruInput
                            id="custodianName"
                            name="custodianName"
                            placeholder="Person responsible for the float"
                            defaultValue={initialData?.custodianName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Opening + Currency */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="openingBalance">Opening balance</ZoruLabel>
                        <ZoruInput
                            id="openingBalance"
                            name="openingBalance"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.openingBalance ?? ''}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                        <ZoruInput
                            id="currency"
                            name="currency"
                            placeholder="INR"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                </div>

                {/* Row 3: Current balance (edit-only) + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {isEditing ? (
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="currentBalance">Current balance</ZoruLabel>
                            <ZoruInput
                                id="currentBalance"
                                name="currentBalance"
                                type="number"
                                step="0.01"
                                defaultValue={initialData?.currentBalance ?? ''}
                            />
                        </div>
                    ) : (
                        <div />
                    )}
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmPettyCashStatus)
                            }
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

                {/* Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Operating policies, signing limits, custodian handover notes."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to floats
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
