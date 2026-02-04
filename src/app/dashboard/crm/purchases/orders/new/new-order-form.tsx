'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { savePurchaseOrder } from '@/app/actions/crm-purchase-orders.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { SmartVendorSelect } from '@/components/crm/purchases/smart-vendor-select';
import { LoaderCircle, Plus, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Purchase Order
        </Button>
    );
}

export function NewPurchaseOrderForm() {
    const [state, formAction] = useActionState(savePurchaseOrder, initialState);
    const { toast } = useToast();
    const router = useRouter();

    const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
    const [vendorId, setVendorId] = useState('');

    // Line Items State
    const [lineItems, setLineItems] = useState([
        { description: '', quantity: 1, rate: 0, amount: 0 }
    ]);

    const updateLineItem = (index: number, field: string, value: any) => {
        const newItems = [...lineItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Recalculate amount
        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = newItems[index].quantity * newItems[index].rate;
        }

        setLineItems(newItems);
    };

    const addLineItem = () => {
        setLineItems([...lineItems, { description: '', quantity: 1, rate: 0, amount: 0 }]);
    };

    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_, i) => i !== index));
        }
    };

    const calculateTotal = () => {
        return lineItems.reduce((acc, item) => acc + item.amount, 0);
    };

    if (state.message) {
        toast({ title: 'Success', description: state.message });
        router.push('/dashboard/crm/purchases/orders');
    }

    if (state.error) {
        toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="vendorId" value={vendorId} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Order Details</CardTitle>
                        <CardDescription>Basic information about the purchase order.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vendor</Label>
                            <SmartVendorSelect
                                value={vendorId}
                                onSelect={setVendorId}
                                onVendorAdded={(newVendor) => {
                                    setVendorId(newVendor._id.toString());
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select name="currency" defaultValue="INR">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                                    <SelectItem value="USD">US Dollar (USD)</SelectItem>
                                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Order Date</Label>
                            <DatePicker date={orderDate} setDate={setOrderDate} />
                            <input type="hidden" name="orderDate" value={orderDate?.toISOString()} />
                        </div>
                        <div className="space-y-2">
                            <Label>Expected Delivery</Label>
                            <DatePicker date={deliveryDate} setDate={setDeliveryDate} />
                            <input type="hidden" name="expectedDeliveryDate" value={deliveryDate?.toISOString()} />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Terms</Label>
                            <Input name="paymentTerms" placeholder="e.g. Net 30" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border rounded-md overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 bg-muted p-3 text-sm font-medium">
                                <div className="col-span-5">Description</div>
                                <div className="col-span-2 text-right">Qty</div>
                                <div className="col-span-2 text-right">Rate</div>
                                <div className="col-span-2 text-right">Amount</div>
                                <div className="col-span-1"></div>
                            </div>
                            {lineItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 p-3 border-t items-center">
                                    <div className="col-span-5">
                                        <Input
                                            value={item.description}
                                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                            placeholder="Item description"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            className="text-right"
                                            value={item.quantity}
                                            onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="text-right"
                                            value={item.rate}
                                            onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="col-span-2 text-right font-medium">
                                        {item.amount.toFixed(2)}
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLineItem(index)} disabled={lineItems.length === 1}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>

                        <div className="flex justify-end pt-4">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>{calculateTotal().toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Additional Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea name="notes" placeholder="Any shipping instructions or terms..." />
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </div>
        </form>
    );
}
