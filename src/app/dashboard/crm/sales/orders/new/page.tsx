'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
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
import { DatePicker } from '@/components/ui/date-picker';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount, SalesOrderLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { saveSalesOrder } from '@/app/actions/crm-sales-orders.actions';
import { useRouter, usePathname } from 'next/navigation';
import { EntityPicker } from '@/components/crm/entity-picker';
import type { LookupItem } from '@/lib/lookup-registry';

const initialState = { message: '', error: '' };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Order
        </ZoruButton>
    );
}

const LineItemsTable = ({ items, setItems, currency }: { items: SalesOrderLineItem[], setItems: React.Dispatch<React.SetStateAction<SalesOrderLineItem[]>>, currency: string }) => {
    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', description: '', quantity: 1, rate: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<SalesOrderLineItem, 'id'>, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

    return (
        <div className="mt-6">
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <table className="w-full text-sm">
                    <thead className="bg-zoru-surface-2">
                        <tr className="border-b border-zoru-line">
                            <th className="p-3 text-left text-zoru-ink">Item</th>
                            <th className="p-3 text-right text-zoru-ink">Quantity</th>
                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b border-zoru-line">
                                <td className="p-2">
                                    <EntityPicker
                                        entity="item"
                                        value={null}
                                        placeholder="Item Name"
                                        onChange={(_id, hydrated) => {
                                            const raw = (hydrated as LookupItem | undefined)?.raw as any;
                                            if (raw) {
                                                handleItemChange(item.id, 'name', raw.name ?? '');
                                                handleItemChange(item.id, 'rate', raw.sellingPrice ?? 0);
                                                if (raw.description !== undefined) {
                                                    handleItemChange(item.id, 'description', raw.description ?? '');
                                                }
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-2"><ZoruInput type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                <td className="p-2"><ZoruInput type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                <td className="p-2 text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(item.quantity * item.rate)}</td>
                                <td className="p-2"><ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="h-4 w-4" />Add New Line</ZoruButton>
            </div>
            <ZoruSeparator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center"><span className="text-zoru-ink-muted">Total ({currency})</span><span className="text-lg text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
                </div>
            </div>
        </div>
    );
}

export default function NewSalesOrderPage() {
    const [state, formAction] = useActionState(saveSalesOrder, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useZoruToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [pickedClient, setPickedClient] = useState<LookupItem | null>(null);
    const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
    const [lineItems, setLineItems] = useState<SalesOrderLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/sales/orders');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="orderDate" value={orderDate?.toISOString()} />
            <input type="hidden" name="deliveryDate" value={deliveryDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="notes" value={notes} />

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/orders">
                                <ZoruButton variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back to Sales Orders</ZoruButton>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruButton variant="outline" type="button">Save As Draft</ZoruButton>
                            <SaveButton />
                        </div>
                    </header>
                    <ZoruCard className="p-0 max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                        <div className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl text-zoru-ink">Sales Order</h1>
                            </header>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">Customer Details:</h3>
                                    <EntityPicker
                                        entity="client"
                                        value={selectedClientId || null}
                                        allowCreate
                                        placeholder="Select client…"
                                        onCreateClick={() => {
                                            const ret = encodeURIComponent(pathname);
                                            router.push(`/dashboard/crm/sales/clients/new?return=${ret}`);
                                        }}
                                        onChange={(next, hydrated) => {
                                            const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                            setSelectedClientId(id);
                                            const item = Array.isArray(hydrated) ? hydrated[0] : hydrated;
                                            setPickedClient(item ?? null);
                                        }}
                                    />
                                    {(() => {
                                        const pickedRaw = pickedClient && pickedClient.id === selectedClientId
                                            ? (pickedClient.raw as Record<string, any> | undefined)
                                            : undefined;
                                        const phone = selectedClient?.phone ?? (pickedRaw?.phone as string | undefined);
                                        if (!phone) return null;
                                        return (
                                            <div className="mt-2 text-zoru-ink-muted">
                                                <p>{phone}</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><ZoruLabel htmlFor="orderNumber" className="text-zoru-ink">Order #</ZoruLabel><ZoruInput id="orderNumber" name="orderNumber" placeholder="Leave blank to auto-generate" className="h-8" maxLength={50} /></div>
                                        <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Order Date *</ZoruLabel><DatePicker date={orderDate} setDate={setOrderDate} /></div>
                                    </div>
                                    <div className="mt-2 space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Expected Delivery Date</ZoruLabel><DatePicker date={deliveryDate} setDate={setDeliveryDate} /></div>
                                </div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-4">
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Payment Terms</ZoruLabel><ZoruTextarea name="paymentTerms" placeholder="e.g. 50% advance, 50% on delivery." maxLength={500} /></div>
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Shipping Address</ZoruLabel><ZoruTextarea name="shippingAddress" placeholder="Ship to address (street, city, state, postal code, country)." maxLength={500} /></div>
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Billing Address</ZoruLabel><ZoruTextarea name="billingAddress" placeholder="Billing address (if different from shipping)." maxLength={500} /></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Tax Rate (%)</ZoruLabel><ZoruInput name="taxRate" type="number" step="0.01" placeholder="0" /></div>
                                        <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Discount</ZoruLabel><ZoruInput name="discount" type="number" step="0.01" placeholder="0" /></div>
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-zoru-ink">Notes</ZoruLabel>
                                        <ZoruTextarea placeholder="Any special instructions for this order..." value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
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
