'use client';

import { Button, Card, Input, Label, Separator, Textarea, useZoruToast, Select } from '@/components/zoruui';
import {
  useState,
  useEffect,
  useActionState,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { DatePicker } from '@/components/ui/date-picker';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount, InvoiceLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { saveProformaInvoice } from '@/app/actions/crm-proforma-invoices.actions';
import { useRouter, usePathname } from 'next/navigation';
import { EntityPicker } from '@/components/crm/entity-picker';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { LookupItem } from '@/lib/lookup-registry';

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
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-zoru-line">
                                <td className="p-2">
                                    <EntityPicker
                                        entity="item"
                                        value={null}
                                        placeholder="Name/SKU"
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
                                <td className="p-2"><Input type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                <td className="p-2"><Input type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                <td className="p-2 text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(item.quantity * item.rate)}</td>
                                <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="h-4 w-4" />Add New Line</Button>
            </div>
            <Separator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center"><span className="text-zoru-ink-muted">Total ({currency})</span><span className="text-lg text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
                </div>
            </div>
        </div>
    );
};

export default function NewProformaInvoicePage() {
    const [state, formAction] = useActionState(saveProformaInvoice, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useZoruToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [pickedClient, setPickedClient] = useState<LookupItem | null>(null);
    const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
    const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    const [terms, setTerms] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [currency, setCurrency] = useState<string>('INR');

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/sales/proforma');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="proformaDate" value={invoiceDate?.toISOString()} />
            <input type="hidden" name="validTillDate" value={dueDate?.toISOString()} />
            <input type="hidden" name="currency" value={currency} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="termsAndConditions" value={JSON.stringify(terms)} />
            <input type="hidden" name="notes" value={notes} />

            <div>
                <div className="w-full flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/proforma">
                                <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back to Proforma Invoices</Button>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" type="button">Save As Draft</Button>
                            <SaveButton />
                        </div>
                    </header>
                    <Card className="w-full p-4 sm:p-8 md:p-12">
                        <div className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl text-zoru-ink">Proforma Invoice</h1>
                            </header>

                            <Separator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">From:</h3>
                                    <p className="text-zoru-ink">{yourBusinessDetails.name}</p>
                                    <p className="text-zoru-ink-muted">{yourBusinessDetails.address}</p>
                                </div>
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">To:</h3>
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
                                </div>
                            </section>

                            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="space-y-1"><Label className="text-xs text-zoru-ink">Proforma No.</Label><Input name="invoiceNumber" defaultValue="PI-00001" className="h-8" /></div>
                                <div className="space-y-1"><Label className="text-xs text-zoru-ink">Date</Label><DatePicker date={invoiceDate} setDate={setInvoiceDate} className="h-8" /></div>
                                <div className="space-y-1"><Label className="text-xs text-zoru-ink">Due Date</Label><DatePicker date={dueDate} setDate={setDueDate} className="h-8" /></div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-zoru-ink">Currency</Label>
                                    <EntityFormField
                                        entity="currency"
                                        name="currency"
                                        initialId={currency}
                                        onChange={(id) => setCurrency(id || 'INR')}
                                    />
                                </div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency={currency} />
                            </section>

                        </div>
                    </Card>
                </div>
            </div>
        </form>
    );
}
