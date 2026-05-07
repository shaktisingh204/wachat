'use client';

import { useState, useEffect, useActionState, Suspense } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSeparator,
    useZoruToast,
} from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { saveGrn } from '@/app/actions/crm-grn.actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EntityPicker } from '@/components/crm/entity-picker';

type GrnItemRow = {
    id: string;
    itemId: string;
    orderedQty: number;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty: number;
    batch: string;
    expiry: Date | undefined;
    serialNos: string;
};

const initialState = { message: '', error: '' };

function PostButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Post GRN
        </ZoruButton>
    );
}

function NewGrnPageInner() {
    const [state, formAction] = useActionState(saveGrn, initialState);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();

    const fromKind = searchParams.get('fromKind');
    const fromId = searchParams.get('fromId');

    const [grnDate, setGrnDate] = useState<Date | undefined>(new Date());
    const [poId, setPoId] = useState<string>(fromKind === 'purchaseOrder' && fromId ? fromId : '');
    const [vendorId, setVendorId] = useState<string>('');
    const [warehouseId, setWarehouseId] = useState<string>('');
    const [inspectorId, setInspectorId] = useState<string>('');
    const [items, setItems] = useState<GrnItemRow[]>([
        { id: `row-${Date.now()}`, itemId: '', orderedQty: 0, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, batch: '', expiry: undefined, serialNos: '' },
    ]);
    const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/inventory/grn');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            { id: `row-${Date.now()}`, itemId: '', orderedQty: 0, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, batch: '', expiry: undefined, serialNos: '' },
        ]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(it => it.id !== id));
    };

    const updateItem = <K extends keyof GrnItemRow>(id: string, field: K, value: GrnItemRow[K]) => {
        setItems(prev => prev.map(it => (it.id === id ? { ...it, [field]: value } : it)));
    };

    const itemsForSubmit = items.map(it => ({
        itemId: it.itemId,
        orderedQty: it.orderedQty,
        receivedQty: it.receivedQty,
        acceptedQty: it.acceptedQty,
        rejectedQty: it.rejectedQty,
        batch: it.batch || undefined,
        expiry: it.expiry ? it.expiry.toISOString() : undefined,
        serialNos: it.serialNos
            ? it.serialNos.split(',').map(s => s.trim()).filter(Boolean)
            : [],
    }));

    return (
        <form action={formAction}>
            <input type="hidden" name="poId" value={poId} />
            <input type="hidden" name="vendorId" value={vendorId} />
            <input type="hidden" name="warehouseId" value={warehouseId} />
            <input type="hidden" name="inspectorId" value={inspectorId} />
            <input type="hidden" name="date" value={grnDate?.toISOString() ?? ''} />
            <input type="hidden" name="items" value={JSON.stringify(itemsForSubmit)} />
            <input type="hidden" name="attachments" value={JSON.stringify(attachments)} />

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/inventory/grn">
                                <ZoruButton variant="outline" size="sm">
                                    <ArrowLeft className="h-4 w-4" />Back to GRNs
                                </ZoruButton>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <PostButton />
                        </div>
                    </header>

                    <ZoruCard className="p-0 max-w-4xl mx-auto p-4 sm:p-8 md:p-12 w-full">
                        <header className="mb-8">
                            <h1 className="text-3xl text-zoru-ink">GOODS RECEIPT NOTE</h1>
                            <p className="text-zoru-ink-muted text-sm">
                                Record items received against a purchase order.
                            </p>
                        </header>

                        <ZoruSeparator className="my-8" />

                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="grnNo" className="text-xs text-zoru-ink">
                                    GRN No. *
                                </ZoruLabel>
                                <ZoruInput
                                    id="grnNo"
                                    name="grnNo"
                                    required
                                    placeholder="e.g. GRN-2026-001"
                                    className="h-9"
                                    maxLength={64}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs text-zoru-ink">Date *</ZoruLabel>
                                <DatePicker date={grnDate} setDate={setGrnDate} className="h-9" />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs text-zoru-ink">Purchase Order</ZoruLabel>
                                {/* `purchaseOrder` is not yet in the TS lookup registry. */}
                                {/* When this page is opened with `?fromKind=purchaseOrder&fromId=...` */}
                                {/* (e.g. via the PO detail page's "+ Create GRN" button), the id is */}
                                {/* read from the query string and submitted via the hidden input below. */}
                                <ZoruInput
                                    type="text"
                                    placeholder="Link to a PO (optional, 24-char ObjectId)…"
                                    value={poId}
                                    onChange={e => setPoId(e.target.value.trim())}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs text-zoru-ink">Vendor *</ZoruLabel>
                                <EntityPicker
                                    entity="vendor"
                                    value={vendorId || null}
                                    placeholder="Select vendor…"
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                        setVendorId(id);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs text-zoru-ink">Warehouse *</ZoruLabel>
                                <EntityPicker
                                    entity="warehouse"
                                    value={warehouseId || null}
                                    placeholder="Select warehouse…"
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                        setWarehouseId(id);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs text-zoru-ink">Inspector</ZoruLabel>
                                <EntityPicker
                                    entity="employee"
                                    value={inspectorId || null}
                                    placeholder="Assign inspector (optional)…"
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                        setInspectorId(id);
                                    }}
                                />
                            </div>
                        </section>

                        <ZoruSeparator className="my-8" />

                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg text-zoru-ink">Items Received</h2>
                            </div>
                            <div className="space-y-4">
                                {items.map((row, index) => (
                                    <div key={row.id} className="rounded-lg border border-zoru-line p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-zoru-ink-muted">
                                                Line {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <ZoruButton
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Remove line"
                                                onClick={() => handleRemoveItem(row.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                            </ZoruButton>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1 md:col-span-2">
                                                <ZoruLabel className="text-xs text-zoru-ink">Item</ZoruLabel>
                                                <EntityPicker
                                                    entity="item"
                                                    value={row.itemId || null}
                                                    placeholder="Select item / SKU…"
                                                    onChange={(next) => {
                                                        const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                        updateItem(row.id, 'itemId', id);
                                                    }}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <ZoruLabel className="text-xs text-zoru-ink">Ordered Qty</ZoruLabel>
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    value={row.orderedQty}
                                                    onChange={e => updateItem(row.id, 'orderedQty', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <ZoruLabel className="text-xs text-zoru-ink">Received Qty</ZoruLabel>
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    value={row.receivedQty}
                                                    onChange={e => updateItem(row.id, 'receivedQty', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <ZoruLabel className="text-xs text-zoru-ink">Accepted Qty</ZoruLabel>
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    value={row.acceptedQty}
                                                    onChange={e => updateItem(row.id, 'acceptedQty', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <ZoruLabel className="text-xs text-zoru-ink">Rejected Qty</ZoruLabel>
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    value={row.rejectedQty}
                                                    onChange={e => updateItem(row.id, 'rejectedQty', Number(e.target.value))}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <ZoruLabel className="text-xs text-zoru-ink">Batch</ZoruLabel>
                                                <ZoruInput
                                                    value={row.batch}
                                                    placeholder="Batch / lot no."
                                                    maxLength={120}
                                                    onChange={e => updateItem(row.id, 'batch', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <ZoruLabel className="text-xs text-zoru-ink">Expiry</ZoruLabel>
                                                <DatePicker
                                                    date={row.expiry}
                                                    setDate={(d: Date | undefined) => updateItem(row.id, 'expiry', d)}
                                                />
                                            </div>

                                            <div className="space-y-1 md:col-span-2">
                                                <ZoruLabel className="text-xs text-zoru-ink">
                                                    Serial Numbers (comma-separated)
                                                </ZoruLabel>
                                                <ZoruInput
                                                    value={row.serialNos}
                                                    placeholder="SN001, SN002, SN003"
                                                    onChange={e => updateItem(row.id, 'serialNos', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4">
                                <ZoruButton
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddItem}
                                >
                                    <PlusCircle className="h-4 w-4" />Add Line
                                </ZoruButton>
                            </div>
                        </section>

                        <ZoruSeparator className="my-8" />

                        <section className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Attachments</ZoruLabel>
                            <SabFilePickerButton
                                accept="all"
                                title="Attach files"
                                onPick={(picked) => {
                                    const list = Array.isArray(picked) ? picked : [picked];
                                    setAttachments(prev => [
                                        ...prev,
                                        ...list.map(p => ({ url: p.url, name: p.name })),
                                    ]);
                                }}
                            >
                                <Upload className="h-4 w-4" /> Add attachments
                            </SabFilePickerButton>
                            {attachments.length > 0 && (
                                <ul className="flex flex-col gap-1.5">
                                    {attachments.map((a, idx) => (
                                        <li
                                            key={`${a.url}-${idx}`}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-2 py-1.5"
                                        >
                                            <span className="text-xs text-zoru-ink truncate">{a.name}</span>
                                            <ZoruButton
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Remove ${a.name}`}
                                                onClick={() =>
                                                    setAttachments(prev => prev.filter((_, i) => i !== idx))
                                                }
                                            >
                                                <X className="h-4 w-4" />
                                            </ZoruButton>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="text-xs text-zoru-ink-muted">
                                Files are stored in your SabFiles library.
                            </p>
                        </section>
                    </ZoruCard>
                </div>
            </div>
        </form>
    );
}

export default function NewGrnPage() {
    return (
        <Suspense fallback={null}>
            <NewGrnPageInner />
        </Suspense>
    );
}
