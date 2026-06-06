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

/**
 * <ExitForm /> — create + edit form for HR exits / offboarding.
 *
 * Binds to the `saveExit` server action via `useActionState`.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveExit } from '@/app/actions/crm-exits.actions';
import type {
    CrmExitDoc,
    CrmExitStatus,
    CrmExitType,
} from '@/lib/rust-client/crm-exits';

const BASE = '/dashboard/hrm/hr/exits';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create exit'}
        </Button>
    );
}

export function ExitForm({ initialData }: ExitFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="exitId" value={initialData!._id} />
                ) : null}

                {/* Employee picker (dual-writes employeeName for legacy callers) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Employee *</Label>
                        <EntityFormField
                            entity="employee"
                            name="employeeId"
                            dualWriteName="employeeName"
                            initialId={initialData?.employeeId ?? null}
                            initialLabel={initialData?.employeeName ?? ''}
                            allowCreate
                            placeholder="Select employee"
                            required
                        />
                    </div>
                </div>

                {/* Type + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <EnumFormField
                            enumName="exitType"
                            name="type"
                            initialId={type}
                            onChange={(id) =>
                                setType((id as CrmExitType) ?? 'resignation')
                            }
                            placeholder="Type"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="exitStatus"
                            name="status"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmExitStatus) ?? 'open')
                            }
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="noticeStart">Notice start</Label>
                        <Input
                            id="noticeStart"
                            name="noticeStart"
                            type="date"
                            defaultValue={toDateInput(initialData?.noticeStart)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="lastDay">Last working day</Label>
                        <Input
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
                        <Label>F&amp;F status</Label>
                        <EnumFormField
                            enumName="exitClearanceStatus"
                            name="fnfStatus"
                            initialId={fnfStatus}
                            onChange={(id) => setFnfStatus(id ?? 'pending')}
                            placeholder="F&F status"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>NOC status</Label>
                        <EnumFormField
                            enumName="nocStatus"
                            name="nocStatus"
                            initialId={nocStatus}
                            onChange={(id) => setNocStatus(id ?? 'pending')}
                            placeholder="NOC status"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Asset return</Label>
                        <EnumFormField
                            enumName="assetReturnStatus"
                            name="assetReturnStatus"
                            initialId={assetReturnStatus}
                            onChange={(id) =>
                                setAssetReturnStatus(id ?? 'pending')
                            }
                            placeholder="Asset return"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Knowledge transfer</Label>
                        <EnumFormField
                            enumName="exitClearanceStatus"
                            name="knowledgeTransferStatus"
                            initialId={knowledgeTransferStatus}
                            onChange={(id) =>
                                setKnowledgeTransferStatus(id ?? 'pending')
                            }
                            placeholder="KT status"
                        />
                    </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                    <Label htmlFor="reason">Reason</Label>
                    <Input
                        id="reason"
                        name="reason"
                        placeholder="Short summary"
                        defaultValue={initialData?.reason ?? ''}
                    />
                </div>

                {/* Exit interview notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="exitInterviewNotes">
                        Exit interview notes
                    </Label>
                    <Textarea
                        id="exitInterviewNotes"
                        name="exitInterviewNotes"
                        rows={4}
                        defaultValue={initialData?.exitInterviewNotes ?? ''}
                    />
                </div>

                {/* Notes */}
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
                            Back to exits
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
