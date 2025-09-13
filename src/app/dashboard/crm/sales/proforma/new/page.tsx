
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
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount, InvoiceLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { saveInvoice } from '@/app/actions/crm-invoices.actions'; // We can reuse the invoice logic for now
import { useRouter } from 'next/navigation';

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
    pan: 'FNSPK2133N'
};

const initialState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Proforma Invoice
    </Button>
  );
}

const LineItemsTable = ({ items, setItems, currency }: { items: InvoiceLineItem[], setItems: React.Dispatch<React.SetStateAction<InvoiceLineItem[]>>, currency: string }) => {
    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', description: '', quantity: 1, rate: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<InvoiceLineItem, 'id'>, value: string | number) => {
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
                        {items.map((item) => (
                            <tr key={item.id} className="border-b">
                                <td className="p-2"><Input placeholder="Name/SKU Id (Required)" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required/></td>
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
};

export default function NewProformaInvoicePage() {
    const [state, formAction] = useActionState(saveInvoice, initialState);
    const router = useRouter();
    const { toast } = useToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
    const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    const [terms, setTerms] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: "Proforma Invoice saved. Note: This saved as a regular invoice for now." });
            router.push('/dashboard/crm/sales/invoices');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="invoiceDate" value={invoiceDate?.toISOString()} />
            <input type="hidden" name="dueDate" value={dueDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="termsAndConditions" value={JSON.stringify(terms)} />
            <input type="hidden" name="notes" value={notes} />
            <input type="hidden" name="currency" value="INR" />

            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/proforma"><ArrowLeft className="mr-2 h-4 w-4" />Back to Proforma Invoices</Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" type="button">Save As Draft</Button>
                            <SaveButton />
                        </div>
                     </header>
                    <Card className="max-w-4xl mx-auto shadow-2xl p-4 sm:p-8 md:p-12">
                        <CardContent className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl font-bold text-primary">Proforma Invoice</h1>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2">From:</h3>
                                    <p className="font-bold">{yourBusinessDetails.name}</p>
                                    <p className="text-muted-foreground">{yourBusinessDetails.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2">To:</h3>
                                     <Select value={selectedClientId} onValueChange={setSelectedClientId} name="accountId" required>
                                        <SelectTrigger><SelectValue placeholder="Select a Client..."/></SelectTrigger>
                                        <SelectContent>{clients.map(client => <SelectItem key={client._id.toString()} value={client._id.toString()}>{client.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </section>

                            <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><Label className="text-xs">Proforma No.</Label><Input name="invoiceNumber" defaultValue="PI-00001" className="h-8"/></div>
                                <div className="space-y-1"><Label className="text-xs">Date</Label><DatePicker date={invoiceDate} setDate={setInvoiceDate} className="h-8"/></div>
                                 <div className="space-y-1"><Label className="text-xs">Due Date</Label><DatePicker date={dueDate} setDate={setDueDate} className="h-8"/></div>
                            </section>
                            
                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
