
'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, ShoppingBag } from 'lucide-react';
import { SmartClientSelect } from '@/components/crm/sales/smart-client-select';
import { SmartProductSelect } from '@/components/crm/inventory/smart-product-select';
import Link from 'next/link';
import type { WithId, CrmAccount, SalesOrderLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { saveSalesOrder } from '@/app/actions/crm-sales-orders.actions';
import { useRouter } from 'next/navigation';

const initialState = { message: '', error: '' };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Order
        </ClayButton>
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
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-secondary">
                        <tr className="border-b border-border">
                            <th className="p-3 text-left font-medium text-foreground">Item</th>
                            <th className="p-3 text-right font-medium text-foreground">Quantity</th>
                            <th className="p-3 text-right font-medium text-foreground">Rate</th>
                            <th className="p-3 text-right font-medium text-foreground">Amount</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b border-border">
                                <td className="p-2">
                                    <SmartProductSelect
                                        value={item.id.startsWith('item-') && !item.name ? '' : undefined}
                                        placeholder="Item Name"
                                        onSelect={(val) => { }}
                                        onProductChange={(product) => {
                                            handleItemChange(item.id, 'name', product.name);
                                            handleItemChange(item.id, 'rate', product.sellingPrice);
                                        }}
                                        className="w-full"
                                    />
                                </td>
                                <td className="p-2"><Input type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                <td className="p-2"><Input type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                <td className="p-2 text-right font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(item.quantity * item.rate)}</td>
                                <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ClayButton type="button" variant="pill" size="sm" onClick={handleAddItem} leading={<PlusCircle className="h-4 w-4" />}>Add New Line</ClayButton>
            </div>
            <Separator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Total ({currency})</span><span className="font-bold text-lg text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
                </div>
            </div>
        </div>
    );
}

export default function NewSalesOrderPage() {
    const [state, formAction] = useActionState(saveSalesOrder, initialState);
    const router = useRouter();
    const { toast } = useToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
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
                                <ClayButton variant="pill" size="sm" leading={<ArrowLeft className="h-4 w-4" />}>Back to Sales Orders</ClayButton>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <ClayButton variant="pill" type="button">Save As Draft</ClayButton>
                            <SaveButton />
                        </div>
                    </header>
                    <ClayCard variant="floating" padded={false} className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                        <div className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl font-bold text-foreground">Sales Order</h1>
                            </header>

                            <Separator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2 text-foreground">Customer Details:</h3>
                                    <SmartClientSelect
                                        value={selectedClientId}
                                        onSelect={setSelectedClientId}
                                        initialOptions={clients.map(c => ({ value: c._id.toString(), label: c.name }))}
                                        onClientAdded={(newClient: any) => {
                                            if (newClient) {
                                                setClients(prev => [...prev, { ...newClient, _id: newClient._id || newClient.insertedId }]);
                                                setSelectedClientId(newClient._id?.toString() || newClient.insertedId?.toString());
                                            }
                                        }}
                                    />
                                    {selectedClient && (
                                        <div className="mt-2 text-muted-foreground">
                                            <p>{selectedClient.phone}</p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label htmlFor="orderNumber" className="text-foreground">Order #</Label><Input id="orderNumber" name="orderNumber" placeholder="Leave blank to auto-generate" className="h-8" maxLength={50} /></div>
                                        <div className="space-y-1"><Label className="text-xs text-foreground">Order Date *</Label><DatePicker date={orderDate} setDate={setOrderDate} /></div>
                                    </div>
                                    <div className="mt-2 space-y-1"><Label className="text-xs text-foreground">Expected Delivery Date</Label><DatePicker date={deliveryDate} setDate={setDeliveryDate} /></div>
                                </div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                            <Separator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label className="font-semibold text-foreground">Payment Terms</Label><Textarea name="paymentTerms" placeholder="e.g. 50% advance, 50% on delivery." maxLength={500} /></div>
                                    <div className="space-y-2"><Label className="font-semibold text-foreground">Shipping Address</Label><Textarea name="shippingAddress" placeholder="Ship to address (street, city, state, postal code, country)." maxLength={500} /></div>
                                    <div className="space-y-2"><Label className="font-semibold text-foreground">Billing Address</Label><Textarea name="billingAddress" placeholder="Billing address (if different from shipping)." maxLength={500} /></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label className="font-semibold text-foreground">Tax Rate (%)</Label><Input name="taxRate" type="number" step="0.01" placeholder="0" /></div>
                                        <div className="space-y-2"><Label className="font-semibold text-foreground">Discount</Label><Input name="discount" type="number" step="0.01" placeholder="0" /></div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-semibold text-foreground">Notes</Label>
                                        <Textarea placeholder="Any special instructions for this order..." value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
                                    </div>
                                </div>
                            </section>
                        </div>
                    </ClayCard>
                </div>
            </div>
        </form>
    );
}
