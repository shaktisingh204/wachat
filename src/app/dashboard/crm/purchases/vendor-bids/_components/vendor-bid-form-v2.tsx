'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
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
 * <VendorBidForm /> — create + edit form for vendor bids.
 *
 * Binds to the `saveVendorBid` server action via `useActionState`.
 * Line items repeater stores rows in local state and serialises to a
 * hidden JSON input on submit. Attachments use SabFiles only.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveVendorBid } from '@/app/actions/crm-vendor-bids-v2.actions';
import type {
    CrmVendorBidAttachment,
    CrmVendorBidDoc,
    CrmVendorBidStatus,
} from '@/lib/rust-client/crm-vendor-bids';

const BASE = '/dashboard/crm/purchases/vendor-bids';

const STATUS_OPTIONS: Array<{ value: CrmVendorBidStatus; label: string }> = [
    { value: 'submitted', label: 'Submitted' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'awarded', label: 'Awarded' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' },
];

interface LineRow {
    itemId: string;
    qty: number;
    rate: number;
    leadTimeDays: number;
    notes: string;
}

interface VendorBidFormProps {
    initialData?: CrmVendorBidDoc | null;
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
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create vendor bid'}
        </ZoruButton>
    );
}

export function VendorBidForm({ initialData }: VendorBidFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveVendorBid, initialState);

    const [items, setItems] = useState<LineRow[]>(() => {
        const seed = initialData?.items ?? [];
        if (!seed.length) {
            return [{ itemId: '', qty: 1, rate: 0, leadTimeDays: 0, notes: '' }];
        }
        return seed.map((it) => ({
            itemId: it.itemId ?? '',
            qty: Number(it.qty) || 0,
            rate: Number(it.rate) || 0,
            leadTimeDays: Number(it.leadTimeDays) || 0,
            notes: it.notes ?? '',
        }));
    });

    const [attachments, setAttachments] = useState<CrmVendorBidAttachment[]>(
        () => initialData?.attachments ?? [],
    );

    const [status, setStatus] = useState<CrmVendorBidStatus>(
        (initialData?.status as CrmVendorBidStatus) ?? 'submitted',
    );

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
            { itemId: '', qty: 1, rate: 0, leadTimeDays: 0, notes: '' },
        ]);
    const removeRow = (i: number) =>
        setItems((prev) => prev.filter((_, idx) => idx !== i));
    const updateRow = (i: number, patch: Partial<LineRow>) =>
        setItems((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
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
    const attachmentsJson = JSON.stringify(attachments);

    const subTotal = items.reduce(
        (s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0),
        0,
    );

    const bidNumber = (initialData as unknown as { bidNumber?: string })?.bidNumber ?? '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="bidId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="items" value={itemsJson} />
                <input type="hidden" name="attachments" value={attachmentsJson} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="bidNumber">Bid number</ZoruLabel>
                        <ZoruInput
                            id="bidNumber"
                            name="bidNumber"
                            placeholder="Auto-generated"
                            defaultValue={bidNumber}
                            disabled
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <EnumFormField
                            enumName="vendorBidStatus"
                            name="__status_picker"
                            initialId={status || null}
                            placeholder="Status"
                            onChange={(id) => setStatus((id ?? '') as CrmVendorBidStatus)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>RFQ *</ZoruLabel>
                        {isEditing ? (
                            <>
                                <input type="hidden" name="rfqId" value={initialData?.rfqId ?? ''} />
                                <ZoruInput
                                    value={initialData?.rfqId ?? ''}
                                    readOnly
                                    className="font-mono text-[12.5px]"
                                />
                            </>
                        ) : (
                            <EntityFormField
                                entity="rfq"
                                name="rfqId"
                                initialId={initialData?.rfqId ?? null}
                                required
                                placeholder="Pick an RFQ this bid responds to…"
                            />
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="vendorId">Vendor id *</ZoruLabel>
                        <ZoruInput
                            id="vendorId"
                            name="vendorId"
                            required={!isEditing}
                            placeholder="Vendor id"
                            defaultValue={initialData?.vendorId ?? ''}
                            disabled={isEditing}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="vendorName">Vendor name</ZoruLabel>
                        <ZoruInput
                            id="vendorName"
                            name="vendorName"
                            placeholder="Cached display name"
                            defaultValue={initialData?.vendorName ?? ''}
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
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="validUntil">Valid until</ZoruLabel>
                        <ZoruInput
                            id="validUntil"
                            name="validUntil"
                            type="date"
                            defaultValue={toDateInput(initialData?.submittedAt)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="bidAmount">Bid amount (override)</ZoruLabel>
                    <ZoruInput
                        id="bidAmount"
                        name="bidAmount"
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder={`Computed: ${subTotal.toFixed(2)}`}
                        defaultValue={initialData?.totals?.total ?? ''}
                    />
                </div>

                {/* Line items */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Line items *</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add row
                        </ZoruButton>
                    </div>
                    <div className="rounded-lg border border-zoru-line">
                        <div className="grid grid-cols-12 gap-2 border-b border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[11.5px] font-medium text-zoru-ink-muted">
                            <div className="col-span-3">Item id</div>
                            <div className="col-span-2">Qty</div>
                            <div className="col-span-2">Rate</div>
                            <div className="col-span-2">Lead (days)</div>
                            <div className="col-span-2">Notes</div>
                            <div className="col-span-1 text-right">·</div>
                        </div>
                        {items.map((row, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-12 gap-2 border-b border-zoru-line px-3 py-2 last:border-b-0"
                            >
                                <ZoruInput
                                    className="col-span-3"
                                    placeholder="catalogue id"
                                    value={row.itemId}
                                    onChange={(e) =>
                                        updateRow(i, { itemId: e.target.value })
                                    }
                                />
                                <ZoruInput
                                    className="col-span-2"
                                    type="number"
                                    min={0}
                                    value={row.qty}
                                    onChange={(e) =>
                                        updateRow(i, { qty: Number(e.target.value) || 0 })
                                    }
                                />
                                <ZoruInput
                                    className="col-span-2"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={row.rate}
                                    onChange={(e) =>
                                        updateRow(i, { rate: Number(e.target.value) || 0 })
                                    }
                                />
                                <ZoruInput
                                    className="col-span-2"
                                    type="number"
                                    min={0}
                                    value={row.leadTimeDays}
                                    onChange={(e) =>
                                        updateRow(i, {
                                            leadTimeDays: Number(e.target.value) || 0,
                                        })
                                    }
                                />
                                <ZoruInput
                                    className="col-span-2"
                                    placeholder="Optional"
                                    value={row.notes}
                                    onChange={(e) =>
                                        updateRow(i, { notes: e.target.value })
                                    }
                                />
                                <div className="col-span-1 flex items-center justify-end">
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeRow(i)}
                                        disabled={items.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right text-[12.5px] text-zoru-ink-muted">
                        Computed subTotal: <span className="font-mono text-zoru-ink">{subTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="terms">Terms</ZoruLabel>
                    <ZoruTextarea
                        id="terms"
                        name="terms"
                        rows={3}
                        placeholder="Payment / delivery terms"
                        defaultValue={initialData?.terms ?? ''}
                    />
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes"
                    />
                </div>

                {/* Attachments */}
                <div className="space-y-1.5">
                    <ZoruLabel>Attachments</ZoruLabel>
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
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeAttachment(i)}
                                    >
                                        Remove
                                    </ZoruButton>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to vendor bids
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
