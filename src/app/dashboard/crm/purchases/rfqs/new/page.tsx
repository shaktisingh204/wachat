'use client';

import { useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSeparator,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import {
    PlusCircle,
    Trash2,
    ArrowLeft,
    Save,
    LoaderCircle,
    Upload,
    X,
} from 'lucide-react';
import { saveRfq } from '@/app/actions/crm-rfq.actions';
import { EntityPicker } from '@/components/crm/entity-picker';
import { SabFilePickerButton } from '@/components/sabfiles';
import type { LookupItem } from '@/lib/lookup-registry';

type RfqLineItem = {
    id: string;
    itemId: string;
    description: string;
    qty: number;
    unit: string;
    specs: string;
};

type AttachedFile = { id: string; url: string; name: string };

const initialState: { message?: string; error?: string } = { message: '', error: '' };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Create RFQ
        </ZoruButton>
    );
}

function RfqLineItemsTable({
    items,
    setItems,
}: {
    items: RfqLineItem[];
    setItems: React.Dispatch<React.SetStateAction<RfqLineItem[]>>;
}) {
    const handleAdd = () => {
        setItems((prev) => [
            ...prev,
            {
                id: `item-${Date.now()}`,
                itemId: '',
                description: '',
                qty: 1,
                unit: '',
                specs: '',
            },
        ]);
    };

    const handleRemove = (id: string) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
    };

    const handleChange = (
        id: string,
        field: keyof Omit<RfqLineItem, 'id'>,
        value: string | number,
    ) => {
        setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
        );
    };

    return (
        <div className="mt-2">
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <table className="w-full text-sm">
                    <thead className="bg-zoru-surface-2">
                        <tr className="border-b border-zoru-line">
                            <th className="p-3 text-left text-zoru-ink">Item</th>
                            <th className="p-3 text-left text-zoru-ink">Description</th>
                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                            <th className="p-3 text-left text-zoru-ink">Unit</th>
                            <th className="p-3 text-left text-zoru-ink">Specs</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-zoru-line">
                                <td className="p-2 min-w-[180px]">
                                    <EntityPicker
                                        entity="item"
                                        value={item.itemId || null}
                                        placeholder="Select item…"
                                        onChange={(next, hydrated) => {
                                            const id = Array.isArray(next)
                                                ? next[0] ?? ''
                                                : (next ?? '');
                                            handleChange(item.id, 'itemId', id);
                                            const raw = (hydrated as LookupItem | undefined)?.raw as
                                                | Record<string, any>
                                                | undefined;
                                            if (raw && !item.description) {
                                                handleChange(
                                                    item.id,
                                                    'description',
                                                    (raw.name as string | undefined) ?? '',
                                                );
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-2 min-w-[180px]">
                                    <ZoruInput
                                        value={item.description}
                                        placeholder="Description"
                                        onChange={(e) =>
                                            handleChange(item.id, 'description', e.target.value)
                                        }
                                        maxLength={500}
                                    />
                                </td>
                                <td className="p-2">
                                    <ZoruInput
                                        type="number"
                                        min={0}
                                        className="w-24 text-right"
                                        value={item.qty}
                                        onChange={(e) =>
                                            handleChange(
                                                item.id,
                                                'qty',
                                                Number(e.target.value) || 0,
                                            )
                                        }
                                    />
                                </td>
                                <td className="p-2">
                                    <ZoruInput
                                        className="w-24"
                                        placeholder="ea, kg…"
                                        value={item.unit}
                                        onChange={(e) =>
                                            handleChange(item.id, 'unit', e.target.value)
                                        }
                                        maxLength={32}
                                    />
                                </td>
                                <td className="p-2 min-w-[180px]">
                                    <ZoruInput
                                        placeholder="Specs / notes"
                                        value={item.specs}
                                        onChange={(e) =>
                                            handleChange(item.id, 'specs', e.target.value)
                                        }
                                        maxLength={500}
                                    />
                                </td>
                                <td className="p-2">
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Remove row"
                                        onClick={() => handleRemove(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                    </ZoruButton>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="p-4 text-center text-sm text-zoru-ink-muted"
                                >
                                    No items yet. Add at least one item to invite quotes on.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-2">
                <ZoruButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdd}
                >
                    <PlusCircle className="h-4 w-4" />
                    Add Item
                </ZoruButton>
            </div>
        </div>
    );
}

export default function NewRfqPage() {
    const [state, formAction] = useActionState(saveRfq, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();

    // Lineage propagation from query string (e.g. ?fromKind=lead&fromId=...).
    const fromKind = searchParams.get('fromKind') ?? '';
    const fromId = searchParams.get('fromId') ?? '';

    const [requiredBy, setRequiredBy] = useState<Date | undefined>(undefined);
    const [deadline, setDeadline] = useState<Date | undefined>(undefined);
    const [vendorIds, setVendorIds] = useState<string[]>([]);
    const [items, setItems] = useState<RfqLineItem[]>([
        {
            id: `item-${Date.now()}`,
            itemId: '',
            description: '',
            qty: 1,
            unit: '',
            specs: '',
        },
    ]);
    const [attachments, setAttachments] = useState<AttachedFile[]>([]);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/purchases/rfqs');
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    // Strip non-payload fields before submitting `items` to the server action.
    const itemsForSubmit = items.map((it) => ({
        itemId: it.itemId || undefined,
        description: it.description || undefined,
        qty: Number(it.qty) || 0,
        unit: it.unit || undefined,
        specs: it.specs || undefined,
    }));

    return (
        <form action={formAction}>
            <input
                type="hidden"
                name="vendorsInvited"
                value={JSON.stringify(vendorIds)}
            />
            <input type="hidden" name="items" value={JSON.stringify(itemsForSubmit)} />
            <input
                type="hidden"
                name="attachments"
                value={JSON.stringify(attachments.map((a) => a.id))}
            />
            <input
                type="hidden"
                name="requiredBy"
                value={requiredBy ? requiredBy.toISOString() : ''}
            />
            <input
                type="hidden"
                name="deadline"
                value={deadline ? deadline.toISOString() : ''}
            />
            {fromKind ? (
                <input type="hidden" name="fromKind" value={fromKind} />
            ) : null}
            {fromId ? <input type="hidden" name="fromId" value={fromId} /> : null}

            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <header className="flex justify-between items-center mb-2">
                    <Link href="/dashboard/crm/purchases/rfqs">
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                            Back to RFQs
                        </ZoruButton>
                    </Link>
                    <SaveButton />
                </header>

                <ZoruCard className="p-6 sm:p-8">
                    <div className="space-y-2 mb-6">
                        <h1 className="text-2xl text-zoru-ink">New Request for Quotation</h1>
                        <p className="text-sm text-zoru-ink-muted">
                            Invite vendors to bid on a list of items. They'll receive your
                            requirements and respond with their best price.
                        </p>
                    </div>

                    <ZoruSeparator className="mb-6" />

                    <section className="grid md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2 md:col-span-2">
                            <ZoruLabel htmlFor="title" className="text-zoru-ink">
                                Title *
                            </ZoruLabel>
                            <ZoruInput
                                id="title"
                                name="title"
                                placeholder="e.g. Q3 Office Supplies — Stationery"
                                required
                                maxLength={200}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Required By</ZoruLabel>
                            <DatePicker date={requiredBy} setDate={setRequiredBy} />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Submission Deadline</ZoruLabel>
                            <DatePicker date={deadline} setDate={setDeadline} />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <ZoruLabel className="text-zoru-ink">Vendors Invited</ZoruLabel>
                            <EntityPicker
                                entity="vendor"
                                value={vendorIds}
                                allowCreate
                                placeholder="Select vendors to invite…"
                                onCreateClick={() => {
                                    const ret = encodeURIComponent(pathname);
                                    router.push(
                                        `/dashboard/crm/purchases/vendors/new?return=${ret}`,
                                    );
                                }}
                                onChange={(next) => {
                                    if (Array.isArray(next)) {
                                        setVendorIds(next);
                                    } else if (typeof next === 'string') {
                                        setVendorIds([next]);
                                    } else {
                                        setVendorIds([]);
                                    }
                                }}
                            />
                            <p className="text-xs text-zoru-ink-muted">
                                Pick one or more vendors. They'll be notified when the RFQ is
                                opened.
                            </p>
                        </div>
                    </section>

                    <ZoruSeparator className="mb-6" />

                    <section className="space-y-2 mb-6">
                        <div className="flex items-center justify-between">
                            <ZoruLabel className="text-zoru-ink">Items</ZoruLabel>
                        </div>
                        <RfqLineItemsTable items={items} setItems={setItems} />
                    </section>

                    <ZoruSeparator className="mb-6" />

                    <section className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="terms" className="text-zoru-ink">
                                Terms
                            </ZoruLabel>
                            <ZoruTextarea
                                id="terms"
                                name="terms"
                                placeholder="Payment, delivery, validity, penalties…"
                                rows={6}
                                maxLength={2000}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Attachments</ZoruLabel>
                            <SabFilePickerButton
                                accept="all"
                                title="Attach a file"
                                onPick={({ id, url, name }) => {
                                    setAttachments((prev) => [...prev, { id, url, name }]);
                                }}
                            >
                                <Upload className="h-4 w-4" />
                                Add attachment
                            </SabFilePickerButton>
                            {attachments.length > 0 && (
                                <ul className="flex flex-col gap-1.5 mt-2">
                                    {attachments.map((a, idx) => (
                                        <li
                                            key={`${a.id}-${idx}`}
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
                    </section>

                    <ZoruSeparator className="my-8" />

                    <div className="flex justify-end gap-2">
                        <Link href="/dashboard/crm/purchases/rfqs">
                            <ZoruButton type="button" variant="outline">
                                Cancel
                            </ZoruButton>
                        </Link>
                        <SaveButton />
                    </div>
                </ZoruCard>
            </div>
        </form>
    );
}
