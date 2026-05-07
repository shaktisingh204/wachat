'use client';

import { useState, useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSeparator,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EntityPicker } from '@/components/crm/entity-picker';
import type { LookupItem } from '@/lib/lookup-registry';
import { saveVendorBid } from '@/app/actions/crm-vendor-bids.actions';
import { getRfqById } from '@/app/actions/crm-rfq.actions';

type BidLineItem = {
    id: string;
    itemId: string;
    itemName: string;
    qty: number;
    rate: number;
    leadTimeDays: number;
    notes: string;
};

type AttachmentRef = { url: string; name: string };

const initialState: { message?: string; error?: string } = { message: '', error: '' };

function SubmitBidButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Submit Bid
        </ZoruButton>
    );
}

const BidLineItems = ({
    items,
    setItems,
    currency,
}: {
    items: BidLineItem[];
    setItems: React.Dispatch<React.SetStateAction<BidLineItem[]>>;
    currency: string;
}) => {
    const handleAddItem = () => {
        setItems([
            ...items,
            {
                id: `item-${Date.now()}`,
                itemId: '',
                itemName: '',
                qty: 1,
                rate: 0,
                leadTimeDays: 0,
                notes: '',
            },
        ]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter((item) => item.id !== id));
    };

    const handleItemChange = <K extends keyof Omit<BidLineItem, 'id'>>(
        id: string,
        field: K,
        value: BidLineItem[K],
    ) => {
        setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };

    const totalAmount = items.reduce((sum, item) => sum + item.qty * item.rate, 0);

    return (
        <div className="mt-6">
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <table className="w-full text-sm">
                    <thead className="bg-zoru-surface-2">
                        <tr className="border-b border-zoru-line">
                            <th className="p-3 text-left text-zoru-ink">Item</th>
                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                            <th className="p-3 text-right text-zoru-ink">Lead (days)</th>
                            <th className="p-3 text-left text-zoru-ink">Notes</th>
                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-zoru-line">
                                <td className="p-2 min-w-[220px]">
                                    <EntityPicker
                                        entity="item"
                                        value={item.itemId || null}
                                        placeholder="Name/SKU"
                                        onChange={(next, hydrated) => {
                                            const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                            handleItemChange(item.id, 'itemId', id);
                                            const picked = Array.isArray(hydrated) ? hydrated[0] : hydrated;
                                            const raw = (picked as LookupItem | undefined)?.raw as
                                                | Record<string, any>
                                                | undefined;
                                            if (raw) {
                                                handleItemChange(item.id, 'itemName', String(raw.name ?? ''));
                                                if (raw.sellingPrice !== undefined) {
                                                    handleItemChange(
                                                        item.id,
                                                        'rate',
                                                        Number(raw.sellingPrice) || 0,
                                                    );
                                                }
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-2">
                                    <ZoruInput
                                        type="number"
                                        className="w-20 text-right"
                                        value={item.qty}
                                        onChange={(e) =>
                                            handleItemChange(item.id, 'qty', Number(e.target.value))
                                        }
                                    />
                                </td>
                                <td className="p-2">
                                    <ZoruInput
                                        type="number"
                                        className="w-28 text-right"
                                        value={item.rate}
                                        onChange={(e) =>
                                            handleItemChange(item.id, 'rate', Number(e.target.value))
                                        }
                                    />
                                </td>
                                <td className="p-2">
                                    <ZoruInput
                                        type="number"
                                        className="w-20 text-right"
                                        value={item.leadTimeDays}
                                        onChange={(e) =>
                                            handleItemChange(
                                                item.id,
                                                'leadTimeDays',
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                </td>
                                <td className="p-2 min-w-[160px]">
                                    <ZoruInput
                                        value={item.notes}
                                        placeholder="Optional"
                                        maxLength={250}
                                        onChange={(e) =>
                                            handleItemChange(item.id, 'notes', e.target.value)
                                        }
                                    />
                                </td>
                                <td className="p-2 text-right text-zoru-ink">
                                    {new Intl.NumberFormat('en-IN', {
                                        style: 'currency',
                                        currency,
                                    }).format(item.qty * item.rate)}
                                </td>
                                <td className="p-2">
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                    </ZoruButton>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <PlusCircle className="h-4 w-4" />
                    Add Bid Line
                </ZoruButton>
            </div>
            <ZoruSeparator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-zoru-ink-muted">Total ({currency})</span>
                        <span className="text-lg text-zoru-ink">
                            {new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency,
                            }).format(totalAmount)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function NewVendorBidPage() {
    const [state, formAction] = useActionState(saveVendorBid, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();

    // RFQ pre-fill from query string. `rfq` is NOT in the lookup-registry
    // EntityKey union, so we cannot use <EntityPicker entity="rfq" />.
    // Fallback: read `?fromKind=rfq&fromId=...` and render read-only.
    const fromKind = searchParams?.get('fromKind') ?? '';
    const fromId = searchParams?.get('fromId') ?? '';
    const seedRfqId = fromKind === 'rfq' && fromId ? fromId : '';

    const [rfqId] = useState<string>(seedRfqId);
    const [rfqLabel, setRfqLabel] = useState<string>(seedRfqId ? 'Loading RFQ…' : '');
    const [vendorId, setVendorId] = useState<string>('');
    const [pickedVendor, setPickedVendor] = useState<LookupItem | null>(null);
    const [vendorName, setVendorName] = useState<string>('');
    const [currency, setCurrency] = useState<string>('INR');
    const [terms, setTerms] = useState<string>('');
    const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
    const [lineItems, setLineItems] = useState<BidLineItem[]>([
        {
            id: 'line-1',
            itemId: '',
            itemName: '',
            qty: 1,
            rate: 0,
            leadTimeDays: 0,
            notes: '',
        },
    ]);

    // Hydrate the pre-filled RFQ display label.
    useEffect(() => {
        if (!seedRfqId) return;
        let cancelled = false;
        getRfqById(seedRfqId)
            .then((doc) => {
                if (cancelled) return;
                if (doc) {
                    setRfqLabel(doc.title || `RFQ ${doc._id.toString()}`);
                } else {
                    setRfqLabel('RFQ not found');
                }
            })
            .catch(() => {
                if (!cancelled) setRfqLabel('Could not load RFQ');
            });
        return () => {
            cancelled = true;
        };
    }, [seedRfqId]);

    // Auto-fill vendorName from the picked vendor as a sensible default.
    useEffect(() => {
        if (!pickedVendor) return;
        if (pickedVendor.id !== vendorId) return;
        const raw = pickedVendor.raw as Record<string, any> | undefined;
        const name = pickedVendor.chip?.primary ?? (raw?.name as string | undefined) ?? '';
        if (name && !vendorName) {
            setVendorName(name);
        }
    }, [pickedVendor, vendorId, vendorName]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/purchases/vendor-bids');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    // Items payload submitted to the server action.
    const itemsPayload = lineItems
        .filter((l) => l.itemId)
        .map((l) => ({
            itemId: l.itemId,
            qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
            leadTimeDays: Number(l.leadTimeDays) || 0,
            notes: l.notes || undefined,
        }));

    return (
        <form action={formAction}>
            <input type="hidden" name="rfqId" value={rfqId} />
            <input type="hidden" name="vendorId" value={vendorId} />
            <input type="hidden" name="vendorName" value={vendorName} />
            <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
            <input
                type="hidden"
                name="attachments"
                value={JSON.stringify(attachments.map((a) => a.url))}
            />

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/purchases/vendor-bids">
                                <ZoruButton variant="outline" size="sm">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to Vendor Bids
                                </ZoruButton>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <SubmitBidButton />
                        </div>
                    </header>

                    <ZoruCard className="p-0 max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                        <div className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl text-zoru-ink">VENDOR BID</h1>
                                <p className="text-zoru-ink-muted text-sm">
                                    Submit a vendor's response to an RFQ.
                                </p>
                            </header>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <ZoruLabel className="text-zoru-ink mb-2 block">RFQ *</ZoruLabel>
                                    {seedRfqId ? (
                                        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2">
                                            <div className="text-zoru-ink text-sm">{rfqLabel}</div>
                                            <div className="text-zoru-ink-muted text-xs mt-0.5">
                                                ID: {seedRfqId}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-zoru-ink-muted text-sm">
                                            No RFQ pre-selected. Open this page from an RFQ via
                                            <code className="mx-1">?fromKind=rfq&amp;fromId=…</code>
                                            to attach the bid.
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <ZoruLabel className="text-zoru-ink mb-2 block">Vendor *</ZoruLabel>
                                    <EntityPicker
                                        entity="vendor"
                                        value={vendorId || null}
                                        allowCreate
                                        placeholder="Select vendor…"
                                        onCreateClick={() => {
                                            const ret = encodeURIComponent(pathname ?? '');
                                            router.push(
                                                `/dashboard/crm/purchases/vendors/new?return=${ret}`,
                                            );
                                        }}
                                        onChange={(next, hydrated) => {
                                            const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                            setVendorId(id);
                                            const item = Array.isArray(hydrated) ? hydrated[0] : hydrated;
                                            setPickedVendor(item ?? null);
                                        }}
                                    />
                                    <div className="mt-3 space-y-1">
                                        <ZoruLabel
                                            htmlFor="vendorName"
                                            className="text-xs text-zoru-ink"
                                        >
                                            Vendor display name (optional, used as bid back-link label)
                                        </ZoruLabel>
                                        <ZoruInput
                                            id="vendorName"
                                            value={vendorName}
                                            onChange={(e) => setVendorName(e.target.value)}
                                            placeholder="Defaults to picked vendor's name"
                                            maxLength={150}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="grid grid-cols-3 gap-4 mb-4">
                                <div className="space-y-1">
                                    <ZoruLabel htmlFor="currency" className="text-xs text-zoru-ink">
                                        Currency *
                                    </ZoruLabel>
                                    <ZoruInput
                                        id="currency"
                                        name="currency"
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                                        maxLength={3}
                                        required
                                        className="h-8"
                                    />
                                </div>
                            </section>

                            <section>
                                <BidLineItems
                                    items={lineItems}
                                    setItems={setLineItems}
                                    currency={currency || 'INR'}
                                />
                            </section>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="terms" className="text-zoru-ink">
                                            Terms
                                        </ZoruLabel>
                                        <ZoruTextarea
                                            id="terms"
                                            name="terms"
                                            placeholder="Payment terms, delivery terms, validity, etc."
                                            value={terms}
                                            onChange={(e) => setTerms(e.target.value)}
                                            maxLength={2000}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-zoru-ink">Attachments</ZoruLabel>
                                        <SabFilePickerButton
                                            accept="all"
                                            title="Attach files"
                                            onPick={(picked) => {
                                                const next = Array.isArray(picked) ? picked : [picked];
                                                setAttachments((prev) => [
                                                    ...prev,
                                                    ...next.map((f) => ({ url: f.url, name: f.name })),
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
                                                        <span className="text-xs text-zoru-ink truncate">
                                                            {a.name}
                                                        </span>
                                                        <ZoruButton
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Remove ${a.name}`}
                                                            onClick={() =>
                                                                setAttachments((prev) =>
                                                                    prev.filter((_, i) => i !== idx),
                                                                )
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
                                    </div>
                                </div>
                            </section>
                        </div>
                    </ZoruCard>
                </div>
            </div>
        </form>
    );
}
