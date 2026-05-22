'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create float'}
        </Button>
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="floatId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Branch + Custodian */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="branchName">Branch name *</Label>
                        <Input
                            id="branchName"
                            name="branchName"
                            required
                            placeholder="e.g. Mumbai HQ"
                            defaultValue={initialData?.branchName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="custodianName">Custodian name</Label>
                        <Input
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
                        <Label htmlFor="openingBalance">Opening balance</Label>
                        <Input
                            id="openingBalance"
                            name="openingBalance"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.openingBalance ?? ''}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
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
                            <Label htmlFor="currentBalance">Current balance</Label>
                            <Input
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
                        <Label htmlFor="status-trigger">Status</Label>
                        <Select
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
                        </Select>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Operating policies, signing limits, custodian handover notes."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to floats
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
