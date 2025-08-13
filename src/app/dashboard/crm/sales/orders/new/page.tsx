
'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount, SalesOrderLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { saveSalesOrder } from '@/app/actions/crm-sales-orders.actions';
import { useRouter } from 'next/navigation';

const initialState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Order
    </Button>
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
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted">
                        <tr className="border-b">
                            <th className="p-3 text-left font-medium">Item</th>
                            <th className="p-3 text-right font-medium">Quantity</th>
                            <th className="p-3 text-right font-medium">Rate</th>
                            <th className="p-3 text-right font-medium">Amount</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b">
                                <td className="p-2"><Input placeholder="Item Name/Description" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required/></td>
                                <td className="p-2"><Input type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                <td className="p-2"><Input type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                <td className="p-2 text-right font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(item.quantity * item.rate)}</td>
                                <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Add New Line</Button>
            </div>
            <Separator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Total ({currency})</span><span className="font-bold text-lg">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
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

            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/orders"><ArrowLeft className="mr-2 h-4 w-4" />Back to Sales Orders</Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline">Save As Draft</Button>
                            <SaveButton />
                        </div>
                     </header>
                    <Card className="max-w-4xl mx-auto shadow-2xl p-4 sm:p-8 md:p-12">
                        <CardContent className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl font-bold text-primary">Sales Order</h1>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2">Customer Details:</h3>
                                     <Select name="accountId" required value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger><SelectValue placeholder="Select a Client..."/></SelectTrigger>
                                        <SelectContent>{clients.map(client => <SelectItem key={client._id.toString()} value={client._id.toString()}>{client.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {selectedClient && (
                                        <div className="mt-2 text-muted-foreground">
                                            <p>{selectedClient.phone}</p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label htmlFor="orderNumber">Order #</Label><Input id="orderNumber" name="orderNumber" defaultValue="SO-0001" className="h-8"/></div>
                                        <div className="space-y-1"><Label className="text-xs">Order Date *</Label><DatePicker date={orderDate} setDate={setOrderDate} /></div>
                                    </div>
                                    <div className="mt-2 space-y-1"><Label className="text-xs">Expected Delivery Date</Label><DatePicker date={deliveryDate} setDate={setDeliveryDate} /></div>
                                </div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>
                            
                            <Separator className="my-8"/>
                            
                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                 <div className="space-y-4">
                                    <div className="space-y-2"><Label className="font-semibold">Payment Terms</Label><Textarea name="paymentTerms" placeholder="e.g. 50% advance, 50% on delivery." /></div>
                                    <div className="space-y-2"><Label className="font-semibold">Shipping Details</Label><Textarea name="shippingDetails" placeholder="e.g. Shipping method, tracking information..." /></div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Notes</Label>
                                    <Textarea placeholder="Any special instructions for this order..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                                </div>
                            </section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
