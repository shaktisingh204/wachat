
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
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle } from 'lucide-react';
import { SmartClientSelect } from '@/components/crm/sales/smart-client-select';
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
            Save Proforma Invoice
        </ClayButton>
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
            <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                <table className="w-full text-sm">
                    <thead className="bg-clay-surface-2">
                        <tr className="border-b border-clay-border">
                            <th className="p-3 text-left font-medium text-clay-ink">Item</th>
                            <th className="p-3 text-right font-medium text-clay-ink">Quantity</th>
                            <th className="p-3 text-right font-medium text-clay-ink">Rate</th>
                            <th className="p-3 text-right font-medium text-clay-ink">Amount</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-clay-border">
                                <td className="p-2"><Input placeholder="Name/SKU Id (Required)" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required /></td>
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
                    <div className="flex justify-between items-center"><span className="text-clay-ink-muted">Total ({currency})</span><span className="font-bold text-lg text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
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

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/proforma">
                                <ClayButton variant="pill" size="sm" leading={<ArrowLeft className="h-4 w-4" />}>Back to Proforma Invoices</ClayButton>
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
                                <h1 className="text-3xl font-bold text-clay-ink">Proforma Invoice</h1>
                            </header>

                            <Separator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2 text-clay-ink">From:</h3>
                                    <p className="font-bold">{yourBusinessDetails.name}</p>
                                    <p className="text-clay-ink-muted">{yourBusinessDetails.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2 text-clay-ink">To:</h3>
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
                                </div>
                            </section>

                            <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><Label className="text-xs text-clay-ink">Proforma No.</Label><Input name="invoiceNumber" defaultValue="PI-00001" className="h-8" /></div>
                                <div className="space-y-1"><Label className="text-xs text-clay-ink">Date</Label><DatePicker date={invoiceDate} setDate={setInvoiceDate} className="h-8" /></div>
                                <div className="space-y-1"><Label className="text-xs text-clay-ink">Due Date</Label><DatePicker date={dueDate} setDate={setDueDate} className="h-8" /></div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                        </div>
                    </ClayCard>
                </div>
            </div>
        </form>
    );
}
