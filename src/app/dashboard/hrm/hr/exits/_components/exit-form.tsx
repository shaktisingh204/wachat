'use client';

/**
 * <ExitForm /> — create + edit form for HR exits / offboarding.
 *
 * Binds to the `saveExit` server action via `useActionState`.
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

import { saveExit } from '@/app/actions/crm-exits.actions';
import type {
    CrmExitDoc,
    CrmExitStatus,
    CrmExitType,
} from '@/lib/rust-client/crm-exits';

const BASE = '/dashboard/hrm/hr/exits';

const TYPE_OPTIONS: Array<{ value: CrmExitType; label: string }> = [
    { value: 'resignation', label: 'Resignation' },
    { value: 'termination', label: 'Termination' },
    { value: 'end_of_contract', label: 'End of contract' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: Array<{ value: CrmExitStatus; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'complete', label: 'Complete' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const FNF_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'waived', label: 'Waived' },
];

const KT_OPTIONS = FNF_OPTIONS;

const NOC_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'issued', label: 'Issued' },
    { value: 'na', label: 'Not applicable' },
];

const ASSET_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'partial', label: 'Partial' },
    { value: 'complete', label: 'Complete' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface ExitFormProps {
    initialData?: CrmExitDoc | null;
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
            {isEditing ? 'Save changes' : 'Create exit'}
        </ZoruButton>
    );
}

export function ExitForm({ initialData }: ExitFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveExit, initialState);

    const [type, setType] = useState<CrmExitType>(
        (initialData?.type as CrmExitType) ?? 'resignation',
    );
    const [status, setStatus] = useState<CrmExitStatus>(
        (initialData?.status as CrmExitStatus) ?? 'open',
    );
    const [fnfStatus, setFnfStatus] = useState<string>(
        initialData?.fnfStatus ?? 'pending',
    );
    const [nocStatus, setNocStatus] = useState<string>(
        initialData?.nocStatus ?? 'pending',
    );
    const [assetReturnStatus, setAssetReturnStatus] = useState<string>(
        initialData?.assetReturnStatus ?? 'pending',
    );
    const [knowledgeTransferStatus, setKnowledgeTransferStatus] = useState<string>(
        initialData?.knowledgeTransferStatus ?? 'pending',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) {
                router.push(`${BASE}/${id}`);
            } else {
                router.push(BASE);
            }
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
                    <input type="hidden" name="exitId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="fnfStatus" value={fnfStatus} />
                <input type="hidden" name="nocStatus" value={nocStatus} />
                <input type="hidden" name="assetReturnStatus" value={assetReturnStatus} />
                <input
                    type="hidden"
                    name="knowledgeTransferStatus"
                    value={knowledgeTransferStatus}
                />

                {/* Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name *</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Full name"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="HR employee id"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                </div>

                {/* Type + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="type-trigger">Type</ZoruLabel>
                        <ZoruSelect value={type} onValueChange={(v) => setType(v as CrmExitType)}>
                            <ZoruSelectTrigger id="type-trigger">
                                <ZoruSelectValue placeholder="Type" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {TYPE_OPTIONS.map((o) => (
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
                            onValueChange={(v) => setStatus(v as CrmExitStatus)}
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

                {/* Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="noticeStart">Notice start</ZoruLabel>
                        <ZoruInput
                            id="noticeStart"
                            name="noticeStart"
                            type="date"
                            defaultValue={toDateInput(initialData?.noticeStart)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="lastDay">Last working day</ZoruLabel>
                        <ZoruInput
                            id="lastDay"
                            name="lastDay"
                            type="date"
                            defaultValue={toDateInput(initialData?.lastDay)}
                        />
                    </div>
                </div>

                {/* Clearance status grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="fnf-trigger">F&amp;F status</ZoruLabel>
                        <ZoruSelect value={fnfStatus} onValueChange={setFnfStatus}>
                            <ZoruSelectTrigger id="fnf-trigger">
                                <ZoruSelectValue placeholder="F&F status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {FNF_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="noc-trigger">NOC status</ZoruLabel>
                        <ZoruSelect value={nocStatus} onValueChange={setNocStatus}>
                            <ZoruSelectTrigger id="noc-trigger">
                                <ZoruSelectValue placeholder="NOC status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {NOC_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="asset-trigger">Asset return</ZoruLabel>
                        <ZoruSelect
                            value={assetReturnStatus}
                            onValueChange={setAssetReturnStatus}
                        >
                            <ZoruSelectTrigger id="asset-trigger">
                                <ZoruSelectValue placeholder="Asset return" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {ASSET_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="kt-trigger">Knowledge transfer</ZoruLabel>
                        <ZoruSelect
                            value={knowledgeTransferStatus}
                            onValueChange={setKnowledgeTransferStatus}
                        >
                            <ZoruSelectTrigger id="kt-trigger">
                                <ZoruSelectValue placeholder="KT status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {KT_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="reason">Reason</ZoruLabel>
                    <ZoruInput
                        id="reason"
                        name="reason"
                        placeholder="Short summary"
                        defaultValue={initialData?.reason ?? ''}
                    />
                </div>

                {/* Exit interview notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="exitInterviewNotes">
                        Exit interview notes
                    </ZoruLabel>
                    <ZoruTextarea
                        id="exitInterviewNotes"
                        name="exitInterviewNotes"
                        rows={4}
                        defaultValue={initialData?.exitInterviewNotes ?? ''}
                    />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to exits
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
