'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { saveDebitNote } from '@/app/actions/crm-debit-notes.actions';
import { Button } from '@/components/ui/button';
import { ClayCard, ClayButton } from '@/components/clay';
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
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Debit Note
        </ClayButton>
    );
}

export function NewDebitNoteForm() {
    const [state, formAction] = useActionState(saveDebitNote, initialState);
    const { toast } = useToast();
    const router = useRouter();

    const [noteDate, setNoteDate] = useState<Date | undefined>(new Date());
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
        router.push('/dashboard/crm/purchases/debit-notes');
    }

    if (state.error) {
        toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="vendorId" value={vendorId} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />

            <div className="grid gap-6">
                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[15px] font-semibold text-foreground">Debit Note Details</h2>
                        <p className="text-[12.5px] text-muted-foreground mt-1">Enter details for vendor return or adjustment.</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Vendor</Label>
                            <SmartVendorSelect
                                value={vendorId}
                                onSelect={setVendorId}
                                onVendorAdded={(newVendor) => {
                                    setVendorId(newVendor._id.toString());
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Currency</Label>
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
                            <Label className="text-foreground">Date</Label>
                            <DatePicker date={noteDate} setDate={setNoteDate} />
                            <input type="hidden" name="noteDate" value={noteDate?.toISOString()} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Reason</Label>
                            <Input name="reason" placeholder="e.g. Damaged Goods, Pricing Error" />
                        </div>
                    </div>
                </ClayCard>

                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[15px] font-semibold text-foreground">Items</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <div className="grid grid-cols-12 gap-2 bg-secondary p-3 text-sm font-medium text-foreground">
                                <div className="col-span-5">Description</div>
                                <div className="col-span-2 text-right">Qty</div>
                                <div className="col-span-2 text-right">Rate</div>
                                <div className="col-span-2 text-right">Amount</div>
                                <div className="col-span-1"></div>
                            </div>
                            {lineItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 p-3 border-t border-border items-center">
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
                        <ClayButton type="button" variant="pill" size="sm" onClick={addLineItem} leading={<Plus className="h-4 w-4" />}>
                            Add Item
                        </ClayButton>

                        <div className="flex justify-end pt-4">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between font-bold text-lg text-foreground">
                                    <span>Total</span>
                                    <span>{calculateTotal().toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </ClayCard>

                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[15px] font-semibold text-foreground">Additional Notes</h2>
                    </div>
                    <Textarea name="notes" placeholder="Any additional comments..." />
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
                        <ClayButton type="button" variant="pill" onClick={() => router.back()}>Cancel</ClayButton>
                        <SubmitButton />
                    </div>
                </ClayCard>
            </div>
        </form>
    );
}
