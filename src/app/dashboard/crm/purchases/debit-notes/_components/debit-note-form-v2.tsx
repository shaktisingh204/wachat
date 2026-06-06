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
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * <DebitNoteForm /> — create + edit form for debit notes.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveDebitNote } from '@/app/actions/crm-debit-notes-v2.actions';
import type {
    CrmDebitNoteDoc,
    DebitNoteReason,
    DebitNoteRefundMode,
    DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';

const BASE = '/dashboard/crm/purchases/debit-notes';

const REASON_OPTIONS: Array<{ value: DebitNoteReason; label: string }> = [
    { value: 'return', label: 'Return' },
    { value: 'discount', label: 'Discount' },
    { value: 'price_adjust', label: 'Price adjustment' },
    { value: 'cancel', label: 'Cancellation' },
    { value: 'other', label: 'Other' },
];

const REFUND_MODE_OPTIONS: Array<{ value: DebitNoteRefundMode; label: string }> = [
    { value: 'cash', label: 'Cash refund' },
    { value: 'credit', label: 'Credit balance' },
    { value: 'replacement', label: 'Replacement' },
];

const STATUS_OPTIONS: Array<{ value: DebitNoteStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'cancelled', label: 'Cancelled' },
];

interface LineRow {
    itemId: string;
    description: string;
    qty: number;
    unit: string;
    rate: number;
    total: number;
}

interface AttachmentRef {
    fileId?: string;
    name?: string;
    url?: string;
    mime?: string;
    size?: number;
}

interface DebitNoteFormProps {
    initialData?: CrmDebitNoteDoc | null;
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
            {isEditing ? 'Save changes' : 'Create debit note'}
        </Button>
    );
}

export function DebitNoteForm({ initialData }: DebitNoteFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveDebitNote, initialState);

    const [items, setItems] = useState<LineRow[]>(() => {
        const seed = initialData?.items ?? [];
        if (!seed.length) {
            return [{ itemId: '', description: '', qty: 1, unit: '', rate: 0, total: 0 }];
        }
        return seed.map((it) => ({
            itemId: it.itemId ?? '',
            description: it.description ?? '',
            qty: Number(it.qty) || 0,
            unit: it.unit ?? '',
            rate: Number(it.rate) || 0,
            total:
                Number.isFinite(it.total)
                    ? Number(it.total)
                    : (Number(it.qty) || 0) * (Number(it.rate) || 0),
        }));
    });

    const [reason, setReason] = useState<DebitNoteReason>(
        (initialData?.reason as DebitNoteReason) ?? 'other',
    );
    const [refundMode, setRefundMode] = useState<DebitNoteRefundMode>(
        (initialData?.refundMode as DebitNoteRefundMode) ?? 'credit',
    );
    const [status, setStatus] = useState<DebitNoteStatus>(
        (initialData?.status as DebitNoteStatus) ?? 'draft',
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

    const addRow = () =>
        setItems((prev) => [
            ...prev,
            { itemId: '', description: '', qty: 1, unit: '', rate: 0, total: 0 },
        ]);
    const removeRow = (i: number) =>
        setItems((prev) => prev.filter((_, idx) => idx !== i));
    const updateRow = (i: number, patch: Partial<LineRow>) =>
        setItems((prev) =>
            prev.map((r, idx) => {
                if (idx !== i) return r;
                const merged = { ...r, ...patch };
                if (patch.qty != null || patch.rate != null) {
                    merged.total = (Number(merged.qty) || 0) * (Number(merged.rate) || 0);
                }
                return merged;
            }),
        );

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

    const itemsJson = JSON.stringify(items.filter((it) => it.qty > 0 || it.rate > 0));
    const subTotal = items.reduce((s, it) => s + (it.total || 0), 0);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="debitNoteId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="items" value={itemsJson} />
                <input type="hidden" name="reason" value={reason} />
                <input type="hidden" name="refundMode" value={refundMode} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="debitNoteNumber">Debit note number</Label>
                        <Input
                            id="debitNoteNumber"
                            name="debitNoteNumber"
                            placeholder="DN-…"
                            defaultValue={initialData?.dnNo ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <EnumFormField
                            enumName="debitNoteStatusV2"
                            name="__status_picker"
                            initialId={status || null}
                            placeholder="Status"
                            onChange={(id) => setStatus((id ?? 'draft') as DebitNoteStatus)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
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
                    <div className="space-y-1.5">
                        <Label htmlFor="billNumber">Bill number</Label>
                        <Input
                            id="billNumber"
                            name="billNumber"
                            placeholder="Linked bill id"
                            defaultValue={initialData?.linkedBillId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="date">Date *</Label>
                        <Input
                            id="date"
                            name="date"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.date)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="reason-trigger">Reason</Label>
                        <EnumFormField
                            enumName="debitNoteReason"
                            name="__reason_picker"
                            initialId={reason || null}
                            placeholder="Reason"
                            onChange={(id) => setReason((id ?? 'other') as DebitNoteReason)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="refundMode-trigger">Refund mode</Label>
                        <EnumFormField
                            enumName="debitNoteRefundMode"
                            name="__refundMode_picker"
                            initialId={refundMode || null}
                            placeholder="Refund mode"
                            onChange={(id) => setRefundMode((id ?? 'cash') as DebitNoteRefundMode)}
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

                <div className="space-y-1.5">
                    <Label htmlFor="reasonText">Reason detail</Label>
                    <Textarea
                        id="reasonText"
                        name="reasonText"
                        rows={2}
                        placeholder="Free-text reason / context"
                    />
                </div>

                {/* Line items */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Line items *</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add row
                        </Button>
                    </div>
                    <div className="rounded-lg border border-zoru-line">
                        <div className="grid grid-cols-12 gap-2 border-b border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[11.5px] font-medium text-zoru-ink-muted">
                            <div className="col-span-2">Item id</div>
                            <div className="col-span-3">Description</div>
                            <div className="col-span-1">Qty</div>
                            <div className="col-span-1">Unit</div>
                            <div className="col-span-2">Rate</div>
                            <div className="col-span-2">Total</div>
                            <div className="col-span-1 text-right">·</div>
                        </div>
                        {items.map((row, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-12 gap-2 border-b border-zoru-line px-3 py-2 last:border-b-0"
                            >
                                <Input
                                    className="col-span-2"
                                    placeholder="id"
                                    value={row.itemId}
                                    onChange={(e) =>
                                        updateRow(i, { itemId: e.target.value })
                                    }
                                />
                                <Input
                                    className="col-span-3"
                                    placeholder="Optional"
                                    value={row.description}
                                    onChange={(e) =>
                                        updateRow(i, { description: e.target.value })
                                    }
                                />
                                <Input
                                    className="col-span-1"
                                    type="number"
                                    min={0}
                                    value={row.qty}
                                    onChange={(e) =>
                                        updateRow(i, { qty: Number(e.target.value) || 0 })
                                    }
                                />
                                <Input
                                    className="col-span-1"
                                    placeholder="ea"
                                    value={row.unit}
                                    onChange={(e) =>
                                        updateRow(i, { unit: e.target.value })
                                    }
                                />
                                <Input
                                    className="col-span-2"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={row.rate}
                                    onChange={(e) =>
                                        updateRow(i, { rate: Number(e.target.value) || 0 })
                                    }
                                />
                                <Input
                                    className="col-span-2"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={row.total}
                                    onChange={(e) =>
                                        updateRow(i, { total: Number(e.target.value) || 0 })
                                    }
                                />
                                <div className="col-span-1 flex items-center justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeRow(i)}
                                        disabled={items.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4 text-zoru-ink" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="totalAmount">Total amount</Label>
                        <Input
                            id="totalAmount"
                            name="totalAmount"
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder={`Computed: ${subTotal.toFixed(2)}`}
                            defaultValue={initialData?.totals?.total ?? ''}
                        />
                    </div>
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
                            Back to debit notes
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
