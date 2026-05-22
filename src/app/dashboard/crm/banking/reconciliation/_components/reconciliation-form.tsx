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
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <ReconciliationForm /> — create + edit form for a bank-reconciliation
 * record.
 *
 * Binds to `saveReconciliationRecord` (Rust-backed) via `useActionState`.
 * The statement upload uses `<SabFilePickerButton>` because the
 * SabFiles project policy forbids any free-text URL paste.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveReconciliationRecord } from '@/app/actions/crm-reconciliation.actions';
import type {
    CrmReconciliationDoc,
    CrmReconciliationStatus,
} from '@/lib/rust-client/crm-reconciliation';

const BASE = '/dashboard/crm/banking/reconciliation';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface ReconciliationFormProps {
    initialData?: CrmReconciliationDoc | null;
    /** Pre-filled statement URL extracted from `notes` on the server. */
    initialStatementUrl?: string;
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
            {isEditing ? 'Save changes' : 'Create reconciliation'}
        </Button>
    );
}

function extractName(url: string): string {
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}

export function ReconciliationForm({
    initialData,
    initialStatementUrl,
}: ReconciliationFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveReconciliationRecord,
        initialState,
    );

    const [status, setStatus] = useState<CrmReconciliationStatus>(
        initialData?.status ?? 'in_progress',
    );

    const [statementUrl, setStatementUrl] = useState<string>(
        initialStatementUrl ?? '',
    );
    const [statementName, setStatementName] = useState<string>(
        initialStatementUrl ? extractName(initialStatementUrl) : '',
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

    const onPickStatement = (pick: SabFilePick) => {
        setStatementUrl(pick.url);
        setStatementName(pick.name);
    };

    const clearStatement = () => {
        setStatementUrl('');
        setStatementName('');
    };

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="reconciliationId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="statementUrl" value={statementUrl} />

                {/* Account + Period */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="accountId">Account *</Label>
                        <EntityFormField
                            entity="bankAccount"
                            name="accountId"
                            initialId={initialData?.accountId ?? null}
                            required
                            allowCreate
                            placeholder="Pick a payment account"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="periodStart">Period start *</Label>
                        <Input
                            id="periodStart"
                            name="periodStart"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.periodStart)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="periodEnd">Period end *</Label>
                        <Input
                            id="periodEnd"
                            name="periodEnd"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.periodEnd)}
                        />
                    </div>
                </div>

                {/* Balances */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="openingBalance">Opening balance</Label>
                        <Input
                            id="openingBalance"
                            name="openingBalance"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.openingBalance ?? '0'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="closingBalance">Closing balance</Label>
                        <Input
                            id="closingBalance"
                            name="closingBalance"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.closingBalance ?? '0'}
                        />
                    </div>
                </div>

                {/* Counts + status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="matchedCount">Matched count</Label>
                        <Input
                            id="matchedCount"
                            name="matchedCount"
                            type="number"
                            step="1"
                            defaultValue={initialData?.matchedCount ?? '0'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="unmatchedCount">Unmatched count</Label>
                        <Input
                            id="unmatchedCount"
                            name="unmatchedCount"
                            type="number"
                            step="1"
                            defaultValue={initialData?.unmatchedCount ?? '0'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="reconciliationStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id ?? 'in_progress') as CrmReconciliationStatus)
                            }
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Statement file (SabFile) */}
                <div className="space-y-1.5">
                    <Label>Bank statement</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickStatement}
                            title="Pick a bank statement"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {statementUrl ? 'Replace statement' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {statementUrl ? (
                            <>
                                <a
                                    href={statementUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[280px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {statementName || statementUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearStatement}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No statement attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={4}
                        placeholder="Variance reasoning, items needing review, sign-off context…"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
