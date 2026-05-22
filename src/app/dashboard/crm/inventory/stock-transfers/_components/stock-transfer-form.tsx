'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Paperclip,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * <StockTransferForm /> — canonical create + edit form for stock transfers.
 *
 * Wired to `saveStockTransfer` via `useActionState`. Line items are a
 * true repeater (one row per item) and post as
 * `lineItems[i][itemId|quantity|unit]` so the server-side parser picks
 * them up unchanged. Attachments come from SabFiles only.
 *
 * Deepened (§3.3.2):
 *  - Sectioned form (Route · Items · Approval · Logistics · Attachments).
 *  - Linked-entity pickers for warehouse / item / requester / approver / receiver.
 *  - Approval workflow gates (Draft → Requested → Approved → InTransit → Received).
 *  - Reason dropdown + carrier / tracking number on the logistics card.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
    saveStockTransfer,
    type CrmStockTransfer,
    type CrmStockTransferAttachment,
    type CrmStockTransferStatus,
} from '@/app/actions/crm-stock-transfers.actions';

const BASE = '/dashboard/crm/inventory/stock-transfers';

interface LineRow {
    rowId: string;
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    availableQty?: number;
}

interface StockTransferFormProps {
    initial?: CrmStockTransfer | null;
}

type SaveState = { message?: string; error?: string; transferId?: string };
const initialState: SaveState = {};

const REASON_OPTIONS: { value: string; label: string }[] = [
    { value: 'rebalance', label: 'Rebalance stock' },
    { value: 'restock', label: 'Restock destination' },
    { value: 'return', label: 'Return to supplier / origin' },
    { value: 'damaged', label: 'Damaged goods recall' },
    { value: 'project', label: 'Project allocation' },
    { value: 'other', label: 'Other' },
];

function emptyRow(): LineRow {
    return {
        rowId: uuidv4(),
        itemId: '',
        itemName: '',
        quantity: 1,
        unit: '',
    };
}

function toDateInput(value: unknown): string {
    if (!value) return new Date().toISOString().slice(0, 10);
    const d = new Date(value as string);
    return Number.isNaN(d.getTime())
        ? new Date().toISOString().slice(0, 10)
        : d.toISOString().slice(0, 10);
}

function toOptionalDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {label}
        </Button>
    );
}

export function StockTransferForm({ initial }: StockTransferFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initial?._id;

    const [state, formAction] = React.useActionState(
        saveStockTransfer,
        initialState,
    );

    const [fromWarehouseId, setFromWarehouseId] = React.useState<string>(
        initial?.fromWarehouseId ? String(initial.fromWarehouseId) : '',
    );
    const [fromWarehouseName, setFromWarehouseName] = React.useState<string>(
        initial?.fromWarehouseName ?? '',
    );
    const [toWarehouseId, setToWarehouseId] = React.useState<string>(
        initial?.toWarehouseId ? String(initial.toWarehouseId) : '',
    );
    const [toWarehouseName, setToWarehouseName] = React.useState<string>(
        initial?.toWarehouseName ?? '',
    );

    const seedRows = React.useMemo<LineRow[]>(() => {
        const seed = initial?.lineItems ?? [];
        if (seed.length === 0) return [emptyRow()];
        return seed.map((l) => ({
            rowId: uuidv4(),
            itemId: l.itemId ? String(l.itemId) : '',
            itemName: l.itemName ?? '',
            quantity: l.quantity ?? 1,
            unit: l.unit ?? '',
        }));
    }, [initial?.lineItems]);

    const [lines, setLines] = React.useState<LineRow[]>(seedRows);
    const [attachments, setAttachments] = React.useState<
        CrmStockTransferAttachment[]
    >(initial?.attachments ?? []);
    const [saveAndNew, setSaveAndNew] = React.useState(false);

    const [requesterId, setRequesterId] = React.useState<string>(
        initial?.requesterId ? String(initial.requesterId) : '',
    );
    const [requesterName, setRequesterName] = React.useState<string>(
        initial?.requesterName ?? '',
    );
    const [approverId, setApproverId] = React.useState<string>(
        initial?.approverId ? String(initial.approverId) : '',
    );
    const [approverName, setApproverName] = React.useState<string>(
        initial?.approverName ?? '',
    );
    const [receivedById, setReceivedById] = React.useState<string>(
        initial?.receivedById ? String(initial.receivedById) : '',
    );
    const [receivedByName, setReceivedByName] = React.useState<string>(
        initial?.receivedByName ?? '',
    );

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            if (saveAndNew) {
                setSaveAndNew(false);
                router.push(`${BASE}/new`);
                router.refresh();
                return;
            }
            const id = state.transferId ?? (initial?._id ? String(initial._id) : '');
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Could not save',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initial?._id, saveAndNew]);

    const updateRow = <K extends keyof LineRow>(
        rowId: string,
        field: K,
        value: LineRow[K],
    ) => {
        setLines((prev) =>
            prev.map((l) => (l.rowId === rowId ? { ...l, [field]: value } : l)),
        );
    };

    const addRow = () => setLines((prev) => [...prev, emptyRow()]);
    const removeRow = (rowId: string) =>
        setLines((prev) =>
            prev.length === 1 ? prev : prev.filter((l) => l.rowId !== rowId),
        );

    const removeAttachment = (id: string) =>
        setAttachments((prev) => prev.filter((a) => a.id !== id));

    const warehousesMatch =
        !!fromWarehouseId &&
        !!toWarehouseId &&
        fromWarehouseId === toWarehouseId;

    const totalUnits = lines.reduce(
        (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0),
        0,
    );

    return (
        <form action={formAction} className="flex w-full flex-col gap-5">
            {isEditing ? (
                <input
                    type="hidden"
                    name="transferId"
                    value={String(initial!._id)}
                />
            ) : null}
            <input
                type="hidden"
                name="requesterName"
                value={requesterName}
            />
            <input
                type="hidden"
                name="approverName"
                value={approverName}
            />
            <input
                type="hidden"
                name="receivedByName"
                value={receivedByName}
            />

            {/* ── Route ───────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Route</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
                        <div className="space-y-1.5">
                            <Label htmlFor="fromWarehouseId">
                                From warehouse *
                            </Label>
                            <EntityFormField
                                entity="warehouse"
                                name="fromWarehouseId"
                                initialId={fromWarehouseId || null}
                                initialLabel={fromWarehouseName}
                                required
                                placeholder="Source warehouse…"
                                onChange={(id, hydrated) => {
                                    setFromWarehouseId(id ?? '');
                                    setFromWarehouseName(
                                        hydrated?.chip.primary ??
                                            fromWarehouseName,
                                    );
                                }}
                            />
                            <input
                                type="hidden"
                                name="fromWarehouseName"
                                value={fromWarehouseName}
                            />
                        </div>
                        <div className="hidden pb-2 text-zoru-ink-muted sm:block">
                            <ArrowRight className="h-5 w-5" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="toWarehouseId">
                                To warehouse *
                            </Label>
                            <EntityFormField
                                entity="warehouse"
                                name="toWarehouseId"
                                initialId={toWarehouseId || null}
                                initialLabel={toWarehouseName}
                                required
                                placeholder="Destination warehouse…"
                                onChange={(id, hydrated) => {
                                    setToWarehouseId(id ?? '');
                                    setToWarehouseName(
                                        hydrated?.chip.primary ??
                                            toWarehouseName,
                                    );
                                }}
                            />
                            <input
                                type="hidden"
                                name="toWarehouseName"
                                value={toWarehouseName}
                            />
                        </div>
                    </div>
                    {warehousesMatch ? (
                        <p
                            role="alert"
                            className="text-[11.5px] text-zoru-danger-ink"
                        >
                            Source and destination must differ.
                        </p>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="transferDate">
                                Transfer date *
                            </Label>
                            <Input
                                id="transferDate"
                                name="transferDate"
                                type="date"
                                required
                                defaultValue={toDateInput(initial?.transferDate)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="expectedDate">
                                Expected at destination
                            </Label>
                            <Input
                                id="expectedDate"
                                name="expectedDate"
                                type="date"
                                defaultValue={toOptionalDateInput(
                                    initial?.expectedDate,
                                )}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reason">Reason</Label>
                            <select
                                id="reason"
                                name="reason"
                                defaultValue={(initial?.reason as string) ?? 'rebalance'}
                                className="h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
                            >
                                {REASON_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Line items ──────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <ZoruCardTitle>Items</ZoruCardTitle>
                        <p className="text-[12px] text-zoru-ink-muted">
                            One row per SKU being moved. Total units:{' '}
                            <span className="font-mono tabular-nums text-zoru-ink">
                                {totalUnits.toLocaleString()}
                            </span>
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                    >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
                    </Button>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="overflow-x-auto rounded-md border border-zoru-line">
                        <table className="w-full text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Item
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Quantity
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Unit
                                    </th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((row, idx) => (
                                    <tr
                                        key={row.rowId}
                                        className="border-t border-zoru-line align-top"
                                    >
                                        <td className="min-w-[260px] px-2 py-2">
                                            <EntityFormField
                                                entity="item"
                                                name={`lineItems[${idx}][itemId]`}
                                                initialId={row.itemId || null}
                                                initialLabel={row.itemName}
                                                placeholder={`Item ${idx + 1}`}
                                                onChange={(id, hydrated) =>
                                                    setLines((prev) =>
                                                        prev.map((l) =>
                                                            l.rowId === row.rowId
                                                                ? {
                                                                      ...l,
                                                                      itemId:
                                                                          id ?? '',
                                                                      itemName:
                                                                          hydrated?.chip
                                                                              .primary ??
                                                                          l.itemName,
                                                                  }
                                                                : l,
                                                        ),
                                                    )
                                                }
                                            />
                                            <input
                                                type="hidden"
                                                name={`lineItems[${idx}][itemName]`}
                                                value={row.itemName}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                step="any"
                                                name={`lineItems[${idx}][quantity]`}
                                                value={row.quantity}
                                                onChange={(e) =>
                                                    updateRow(
                                                        row.rowId,
                                                        'quantity',
                                                        parseFloat(
                                                            e.target.value,
                                                        ) || 0,
                                                    )
                                                }
                                                className="h-8 w-28 text-right"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <Input
                                                name={`lineItems[${idx}][unit]`}
                                                value={row.unit}
                                                onChange={(e) =>
                                                    updateRow(
                                                        row.rowId,
                                                        'unit',
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-8 w-24"
                                                placeholder="e.g. kg, pcs"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    removeRow(row.rowId)
                                                }
                                                disabled={lines.length === 1}
                                                aria-label="Remove line"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Approval workflow ───────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Approval workflow</ZoruCardTitle>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Draft → Requested → Approved → In transit → Received.
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="status">Status</Label>
                            <EnumFormField
                                enumName="stockTransferStatus"
                                name="status"
                                initialId={
                                    (initial?.status &&
                                    initial.status !== 'archived'
                                        ? initial.status
                                        : 'Draft') as CrmStockTransferStatus
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="requesterId">Requester</Label>
                            <EntityFormField
                                entity="employee"
                                name="requesterId"
                                initialId={requesterId || null}
                                initialLabel={requesterName}
                                placeholder="Who requested the transfer?"
                                onChange={(id, hydrated) => {
                                    setRequesterId(id ?? '');
                                    setRequesterName(
                                        hydrated?.chip.primary ?? '',
                                    );
                                }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="approverId">Approver</Label>
                            <EntityFormField
                                entity="employee"
                                name="approverId"
                                initialId={approverId || null}
                                initialLabel={approverName}
                                placeholder="Who signs off?"
                                onChange={(id, hydrated) => {
                                    setApproverId(id ?? '');
                                    setApproverName(
                                        hydrated?.chip.primary ?? '',
                                    );
                                }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="receivedById">
                                Received by
                            </Label>
                            <EntityFormField
                                entity="employee"
                                name="receivedById"
                                initialId={receivedById || null}
                                initialLabel={receivedByName}
                                placeholder="Receiver at destination"
                                onChange={(id, hydrated) => {
                                    setReceivedById(id ?? '');
                                    setReceivedByName(
                                        hydrated?.chip.primary ?? '',
                                    );
                                }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="receivedDate">
                                Received date
                            </Label>
                            <Input
                                id="receivedDate"
                                name="receivedDate"
                                type="date"
                                defaultValue={toOptionalDateInput(
                                    initial?.receivedDate,
                                )}
                            />
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Logistics ───────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Logistics</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="carrier">Carrier</Label>
                            <Input
                                id="carrier"
                                name="carrier"
                                defaultValue={initial?.carrier ?? ''}
                                placeholder="Carrier / freight provider"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="trackingNumber">
                                Tracking number
                            </Label>
                            <Input
                                id="trackingNumber"
                                name="trackingNumber"
                                defaultValue={initial?.trackingNumber ?? ''}
                                placeholder="e.g. 1Z999AA10123456784"
                            />
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Attachments ─────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <ZoruCardTitle>Attachments</ZoruCardTitle>
                        <p className="text-[12px] text-zoru-ink-muted">
                            Picking slips, delivery photos, signed receipts.
                        </p>
                    </div>
                    <SabFilePickerButton
                        onPick={(pick) => {
                            setAttachments((prev) =>
                                prev.some((a) => a.id === pick.id)
                                    ? prev
                                    : [
                                          ...prev,
                                          {
                                              id: pick.id,
                                              url: pick.url,
                                              name: pick.name,
                                              mime: pick.mime,
                                              size: pick.size,
                                          },
                                      ],
                            );
                        }}
                    >
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Add file
                    </SabFilePickerButton>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {attachments.length > 0 ? (
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((a, idx) => (
                                <li
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-zoru-line px-2.5 py-1.5 text-[12.5px]"
                                >
                                    <span className="truncate text-zoru-ink">
                                        {a.name}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAttachment(a.id)}
                                        aria-label={`Remove ${a.name}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                    <input
                                        type="hidden"
                                        name={`attachments[${idx}][id]`}
                                        value={a.id}
                                    />
                                    <input
                                        type="hidden"
                                        name={`attachments[${idx}][url]`}
                                        value={a.url}
                                    />
                                    <input
                                        type="hidden"
                                        name={`attachments[${idx}][name]`}
                                        value={a.name}
                                    />
                                    {a.mime ? (
                                        <input
                                            type="hidden"
                                            name={`attachments[${idx}][mime]`}
                                            value={a.mime}
                                        />
                                    ) : null}
                                    {a.size != null ? (
                                        <input
                                            type="hidden"
                                            name={`attachments[${idx}][size]`}
                                            value={String(a.size)}
                                        />
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-md border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-3 text-center text-[12px] text-zoru-ink-muted">
                            No attachments yet.
                        </p>
                    )}
                </ZoruCardContent>
            </Card>

            {/* ── Notes ───────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Notes</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Context, carrier, receiver instructions…"
                        defaultValue={initial?.notes ?? ''}
                    />
                </ZoruCardContent>
            </Card>

            {/* ── Sticky footer ───────────────────────────────────── */}
            <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-zoru-line bg-zoru-bg px-4 py-3 md:-mx-6 md:px-6">
                <Button variant="ghost" asChild>
                    <Link href={BASE}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                    </Link>
                </Button>
                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <Button
                            type="submit"
                            variant="outline"
                            onClick={() => setSaveAndNew(true)}
                        >
                            Save & New
                        </Button>
                    ) : null}
                    <SubmitButton
                        label={isEditing ? 'Save changes' : 'Create transfer'}
                    />
                </div>
            </div>
        </form>
    );
}

export default StockTransferForm;
