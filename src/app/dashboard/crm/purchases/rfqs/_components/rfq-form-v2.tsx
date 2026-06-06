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
  FileUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * <RfqForm /> — create + edit form for CRM RFQs.
 *
 * Binds to the `saveRfq` server action via `useActionState`. The line-
 * item repeater stores its array in local React state and serialises
 * to a hidden JSON input on submit. Attachments use
 * `<SabFilePickerButton>` per the SabFiles policy — no free-text URL
 * paste.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveRfq } from '@/app/actions/crm-rfqs-v2.actions';
import type {
    CrmRfqAttachment,
    CrmRfqDoc,
    CrmRfqStatus,
} from '@/lib/rust-client/crm-rfqs';

const BASE = '/dashboard/crm/purchases/rfqs';

const STATUS_OPTIONS: Array<{ value: CrmRfqStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'awarded', label: 'Awarded' },
    { value: 'cancelled', label: 'Cancelled' },
];

interface LineRow {
    itemId: string;
    description: string;
    qty: number;
    unit: string;
    specs: string;
}

interface RfqFormProps {
    initialData?: CrmRfqDoc | null;
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
            {isEditing ? 'Save changes' : 'Create RFQ'}
        </Button>
    );
}

export function RfqForm({ initialData }: RfqFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveRfq, initialState);

    const [items, setItems] = useState<LineRow[]>(() => {
        const seed = initialData?.items ?? [];
        if (!seed.length) {
            return [{ itemId: '', description: '', qty: 1, unit: '', specs: '' }];
        }
        return seed.map((it) => ({
            itemId: it.itemId ?? '',
            description: it.description ?? '',
            qty: Number(it.qty) || 0,
            unit: it.unit ?? '',
            specs: it.specs ?? '',
        }));
    });

    const [invitedVendors, setInvitedVendors] = useState<string>(
        (initialData?.vendorsInvited ?? []).join(', '),
    );

    const [attachments, setAttachments] = useState<CrmRfqAttachment[]>(
        () => initialData?.attachments ?? [],
    );

    const [status, setStatus] = useState<CrmRfqStatus>(
        (initialData?.status as CrmRfqStatus) ?? 'draft',
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

    const addRow = () => {
        setItems((prev) => [
            ...prev,
            { itemId: '', description: '', qty: 1, unit: '', specs: '' },
        ]);
    };
    const removeRow = (i: number) => {
        setItems((prev) => prev.filter((_, idx) => idx !== i));
    };
    const updateRow = (i: number, patch: Partial<LineRow>) => {
        setItems((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
        );
    };

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
    const removeAttachment = (i: number) => {
        setAttachments((prev) => prev.filter((_, idx) => idx !== i));
    };

    // Serialised hidden inputs.
    const itemsJson = JSON.stringify(
        items.filter((it) => it.itemId.trim() || it.description.trim()),
    );
    const vendorsJson = JSON.stringify(
        invitedVendors
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
    );
    const attachmentsJson = JSON.stringify(attachments);

    const rfqNumber = (initialData as unknown as { rfqNumber?: string })?.rfqNumber ?? '';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="rfqId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="items" value={itemsJson} />
                <input type="hidden" name="vendorsInvited" value={vendorsJson} />
                <input type="hidden" name="attachments" value={attachmentsJson} />
                <input type="hidden" name="status" value={status} />

                {/* Header row */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="rfqNumber">RFQ number</Label>
                        <Input
                            id="rfqNumber"
                            name="rfqNumber"
                            placeholder="Auto-generated"
                            defaultValue={rfqNumber}
                            disabled
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <EnumFormField
                            enumName="rfqStatusV2"
                            name="__status_picker"
                            initialId={status || null}
                            placeholder="Status"
                            onChange={(id) => setStatus((id ?? '') as CrmRfqStatus)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                        id="title"
                        name="title"
                        required
                        placeholder="e.g. Q3 office stationery"
                        defaultValue={initialData?.title ?? ''}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="deadline">Deadline</Label>
                        <Input
                            id="deadline"
                            name="deadline"
                            type="date"
                            defaultValue={toDateInput(initialData?.deadline)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="requiredBy">Required by</Label>
                        <Input
                            id="requiredBy"
                            name="requiredBy"
                            type="date"
                            defaultValue={toDateInput(initialData?.requiredBy)}
                        />
                    </div>
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
                    <div className="rounded-lg border border-[var(--st-border)]">
                        <div className="grid grid-cols-12 gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] font-medium text-[var(--st-text-secondary)]">
                            <div className="col-span-3">Item id</div>
                            <div className="col-span-3">Description</div>
                            <div className="col-span-2">Qty</div>
                            <div className="col-span-1">Unit</div>
                            <div className="col-span-2">Specs</div>
                            <div className="col-span-1 text-right">·</div>
                        </div>
                        {items.map((row, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-12 gap-2 border-b border-[var(--st-border)] px-3 py-2 last:border-b-0"
                            >
                                <Input
                                    className="col-span-3"
                                    placeholder="catalogue id"
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
                                    className="col-span-2"
                                    type="number"
                                    min={0}
                                    value={row.qty}
                                    onChange={(e) =>
                                        updateRow(i, {
                                            qty: Number(e.target.value) || 0,
                                        })
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
                                    placeholder="Spec notes"
                                    value={row.specs}
                                    onChange={(e) =>
                                        updateRow(i, { specs: e.target.value })
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
                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Invited vendors */}
                <div className="space-y-1.5">
                    <Label htmlFor="invitedVendors">Invited vendors</Label>
                    <Input
                        id="invitedVendors"
                        placeholder="Comma-separated vendor ids"
                        value={invitedVendors}
                        onChange={(e) => setInvitedVendors(e.target.value)}
                    />
                </div>

                {/* Terms / notes */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="terms">Terms</Label>
                        <Textarea
                            id="terms"
                            name="terms"
                            rows={4}
                            placeholder="Payment terms, delivery terms, …"
                            defaultValue={initialData?.terms ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            rows={4}
                            placeholder="Internal notes"
                        />
                    </div>
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
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                No attachments.
                            </span>
                        ) : null}
                    </div>
                    {attachments.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                            {attachments.map((a, i) => (
                                <li
                                    key={`${a.fileId ?? a.url}-${i}`}
                                    className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-1.5 text-[12.5px]"
                                >
                                    <a
                                        href={a.url ?? '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate text-[var(--st-text)] underline-offset-2 hover:underline"
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
                            Back to RFQs
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
