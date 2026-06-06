'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
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
 * <PayoutForm /> — create + edit form for payouts (outgoing vendor
 * payments).
 *
 * Binds to the `savePayout` server action via `useActionState`.
 * Attachments use SabFiles only.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { savePayout } from '@/app/actions/crm-payouts-v2.actions';
import type {
    CrmPayoutDoc,
    CrmPayoutMode,
    CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';

const BASE = '/dashboard/crm/purchases/payouts';

const METHOD_OPTIONS: Array<{ value: CrmPayoutMode; label: string }> = [
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'upi', label: 'UPI' },
    { value: 'neft', label: 'NEFT' },
    { value: 'rtgs', label: 'RTGS' },
    { value: 'imps', label: 'IMPS' },
    { value: 'card', label: 'Card' },
    { value: 'wallet', label: 'Wallet' },
];

const STATUS_OPTIONS: Array<{ value: CrmPayoutStatus; label: string }> = [
    { value: 'sent', label: 'Sent' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'failed', label: 'Failed' },
];

interface AttachmentRef {
    fileId?: string;
    name?: string;
    url?: string;
    mime?: string;
    size?: number;
}

interface PayoutFormProps {
    initialData?: CrmPayoutDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Record payout'}
        </Button>
    );
}

export function PayoutForm({ initialData }: PayoutFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePayout, initialState);

    const [paymentMethod, setPaymentMethod] = useState<CrmPayoutMode>(
        (initialData?.mode as CrmPayoutMode) ?? 'neft',
    );
    const [status, setStatus] = useState<CrmPayoutStatus>(
        (initialData?.status as CrmPayoutStatus) ?? 'sent',
    );

    const [attachments, setAttachments] = useState<AttachmentRef[]>(() => {
        const seed = (initialData?.attachments ?? []) as unknown as AttachmentRef[];
        return Array.isArray(seed) ? seed : [];
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const onAttach = (pick: SabFilePick) => {
        setAttachments((prev) => [
            ...prev,
            {
                fileId: pick.id ?? pick.url,
                name: pick.name,
                url: pick.url,
                mime: pick.mime,
                size: pick.size,
            },
        ]);
    };
    const removeAttachment = (i: number) =>
        setAttachments((prev) => prev.filter((_, idx) => idx !== i));

    const attachmentsJson = JSON.stringify(attachments);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="payoutId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="attachments" value={attachmentsJson} />
                <input type="hidden" name="paymentMethod" value={paymentMethod} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="payoutNumber">Payout number</Label>
                        <Input
                            id="payoutNumber"
                            name="payoutNumber"
                            placeholder="PAY-…"
                            defaultValue={initialData?.paymentNo ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <EnumFormField
                            enumName="payoutStatus"
                            name="__status_picker"
                            initialId={status || null}
                            placeholder="Status"
                            onChange={(id) => setStatus((id ?? 'sent') as CrmPayoutStatus)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="vendor_id">Vendor id *</Label>
                    <Input
                        id="vendor_id"
                        name="vendor_id"
                        required
                        placeholder="Vendor id"
                        defaultValue={initialData?.vendorId ?? ''}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="amount">Amount *</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            step="0.01"
                            min={0}
                            required
                            defaultValue={initialData?.amount ?? ''}
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
                    <div className="space-y-1.5">
                        <Label htmlFor="paidAt">Paid at *</Label>
                        <Input
                            id="paidAt"
                            name="paidAt"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.date)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="paymentMethod-trigger">Payment method</Label>
                        <EnumFormField
                            enumName="paymentMode"
                            name="__paymentMethod_picker"
                            initialId={paymentMethod || null}
                            placeholder="Method"
                            onChange={(id) => setPaymentMethod((id ?? 'cash') as CrmPayoutMode)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="paymentAccountId">Payment account id</Label>
                        <Input
                            id="paymentAccountId"
                            name="paymentAccountId"
                            placeholder="Bank account id"
                            defaultValue={initialData?.bankAccountId ?? ''}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="referenceNumber">Reference number</Label>
                    <Input
                        id="referenceNumber"
                        name="referenceNumber"
                        placeholder="Txn id / cheque no / UTR"
                        defaultValue={initialData?.reference ?? ''}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Attachments */}
                <div className="space-y-1.5">
                    <Label>Attachments</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton onPick={onAttach}>
                            <FileUp className="mr-1.5 h-4 w-4" />
                            Add from SabFiles
                        </SabFilePickerButton>
                        {attachments.length === 0 ? (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No attachments.
                            </span>
                        ) : null}
                    </div>
                    {attachments.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                            {attachments.map((a, i) => (
                                <li
                                    key={`${a.fileId ?? a.url}-${i}`}
                                    className="flex items-center justify-between rounded-md border border-zoru-line px-3 py-1.5 text-[12.5px]"
                                >
                                    <a
                                        href={a.url ?? '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate text-zoru-ink underline-offset-2 hover:underline"
                                    >
                                        {a.name ?? a.fileId ?? a.url}
                                    </a>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeAttachment(i)}
                                    >
                                        Remove
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to payouts
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
