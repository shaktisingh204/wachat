
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
import type { WithId, CrmAccount, CreditNoteLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { saveCreditNote } from '@/app/actions/crm-credit-notes.actions';
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
      Save Credit Note
    </Button>
  );
}

const LineItemsTable = ({ items, setItems, currency }: { items: CreditNoteLineItem[], setItems: React.Dispatch<React.SetStateAction<CreditNoteLineItem[]>>, currency: string }) => {
    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', description: '', quantity: 1, rate: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<CreditNoteLineItem, 'id'>, value: string | number) => {
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
                                <td className="p-2"><Input placeholder="Name/SKU Id" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required maxLength={100}/></td>
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
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Total Credit ({currency})</span><span className="font-bold text-lg">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
                </div>
            </div>
        </div>
    );
};


export default function NewCreditNotePage() {
    const [state, formAction] = useActionState(saveCreditNote, initialState);
    const router = useRouter();
    const { toast } = useToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [creditNoteDate, setCreditNoteDate] = useState<Date | undefined>(new Date());
    const [lineItems, setLineItems] = useState<CreditNoteLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    
    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            router.push('/dashboard/crm/sales/credit-notes');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="creditNoteDate" value={creditNoteDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="currency" value="INR" />

            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/credit-notes"><ArrowLeft className="mr-2 h-4 w-4" />Back to Credit Notes</Link>
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
                                <h1 className="text-3xl font-bold text-primary">Credit Note</h1>
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
                                <div className="space-y-1"><Label className="text-xs">Credit Note No.</Label><Input name="creditNoteNumber" placeholder="Leave blank to auto-generate" className="h-8" maxLength={50} /></div>
                                <div className="space-y-1"><Label className="text-xs">Credit Note Date *</Label><DatePicker date={creditNoteDate} setDate={setCreditNoteDate} className="h-8"/></div>
                                 <div className="space-y-1"><Label className="text-xs">Original Invoice No.</Label><Input name="originalInvoiceNumber" className="h-8" maxLength={50} /></div>
                            </section>
                            
                             <section className="mb-8">
                                <Label>Reason for Issuance</Label>
                                <Textarea name="reason" placeholder="e.g. Return of goods, discount adjustment..." maxLength={500} />
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
