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
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount, CreditNoteLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { saveCreditNote } from '@/app/actions/crm-credit-notes.actions';
import { useRouter, usePathname } from 'next/navigation';
import { EntityPicker } from '@/components/crm/entity-picker';
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
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            Save Credit Note
        </ZoruButton>
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
                    <thead className="bg-zoru-surface-2">
                        <tr className="border-b border-zoru-line">
                            <th className="p-3 text-left">Item</th>
                            <th className="p-3 text-right">Quantity</th>
                            <th className="p-3 text-right">Rate</th>
                            <th className="p-3 text-right">Amount</th>
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
                                <td className="p-2"><ZoruInput type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                <td className="p-2"><ZoruInput type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                <td className="p-2 text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(item.quantity * item.rate)}</td>
                                <td className="p-2"><ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4" />Add New Line</ZoruButton>
            </div>
            <ZoruSeparator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center"><span className="text-zoru-ink-muted">Total Credit ({currency})</span><span className="text-lg text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
                </div>
            </div>
        </div>
    );
};


export default function NewCreditNotePage() {
    const [state, formAction] = useActionState(saveCreditNote, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useZoruToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [pickedClient, setPickedClient] = useState<LookupItem | null>(null);
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

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/credit-notes" className="inline-flex items-center gap-2 text-[13px] text-zoru-ink-muted hover:text-zoru-ink">
                                <ArrowLeft className="h-4 w-4" />Back to Credit Notes
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruButton variant="outline" type="button">Save As Draft</ZoruButton>
                            <SaveButton />
                        </div>
                    </header>
                    <ZoruCard className="p-0 mx-auto max-w-4xl p-4 sm:p-8 md:p-12">
                        <div>
                            <header className="mb-8">
                                <h1 className="text-[28px] text-zoru-ink">Credit Note</h1>
                            </header>

                            <ZoruSeparator className="my-8" />

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

                            <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><ZoruLabel className="text-xs">Credit Note No.</ZoruLabel><ZoruInput name="creditNoteNumber" placeholder="Leave blank to auto-generate" className="h-8" maxLength={50} /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs">Credit Note Date *</ZoruLabel><DatePicker date={creditNoteDate} setDate={setCreditNoteDate} className="h-8" /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs">Original Invoice No.</ZoruLabel><ZoruInput name="originalInvoiceNumber" className="h-8" maxLength={50} /></div>
                            </section>

                            <section className="mb-8">
                                <ZoruLabel>Reason for Issuance</ZoruLabel>
                                <ZoruTextarea name="reason" placeholder="e.g. Return of goods, discount adjustment..." maxLength={500} />
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                        </div>
                    </ZoruCard>
                </div>
            </div>
        </form>
    );
}
