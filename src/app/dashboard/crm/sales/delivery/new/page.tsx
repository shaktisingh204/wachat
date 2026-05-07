'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { EntityPicker } from '@/components/crm/entity-picker';
import Link from 'next/link';
import type { WithId, CrmAccount, DeliveryChallanLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { saveDeliveryChallan } from '@/app/actions/crm-delivery-challans.actions';


const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
    pan: 'FNSPK2133N'
}

const initialState = { message: '', error: '' };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
        </ZoruButton>
    );
}


const LineItemsTable = ({ items, setItems }: { items: DeliveryChallanLineItem[], setItems: React.Dispatch<React.SetStateAction<DeliveryChallanLineItem[]>> }) => {
    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', quantity: 1 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<DeliveryChallanLineItem, 'id'>, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    return (
        <div className="mt-6">
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <table className="w-full text-sm">
                    <thead className="bg-zoru-surface-2">
                        <tr className="border-b border-zoru-line">
                            <th className="p-3 text-left text-zoru-ink">Item Name*</th>
                            <th className="p-3 text-left text-zoru-ink">HSN Code</th>
                            <th className="p-3 text-right text-zoru-ink">Quantity*</th>
                            <th className="p-3 text-left text-zoru-ink">Unit</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b border-zoru-line">
                                <td className="p-2"><ZoruInput placeholder="Item Name" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required maxLength={100} /></td>
                                <td className="p-2"><ZoruInput placeholder="e.g. 998314" value={item.hsnCode} onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)} maxLength={20} /></td>
                                <td className="p-2"><ZoruInput type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} required /></td>
                                <td className="p-2"><ZoruInput placeholder="e.g. PCS, Kgs" value={item.unit} onChange={e => handleItemChange(item.id, 'unit', e.target.value)} maxLength={20} /></td>
                                <td className="p-2"><ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="h-4 w-4" />Add New Line</ZoruButton>
            </div>
        </div>
    );
}

export default function NewDeliveryChallanPage() {
    const [state, formAction] = useActionState(saveDeliveryChallan, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [challanDate, setChallanDate] = useState<Date | undefined>(new Date());
    const [lineItems, setLineItems] = useState<DeliveryChallanLineItem[]>([{ id: '1', name: '', quantity: 1 }]);

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            router.push('/dashboard/crm/sales/delivery');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="challanDate" value={challanDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/delivery">
                                <ZoruButton variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back to Delivery Challans</ZoruButton>
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
                                <h1 className="text-3xl text-zoru-ink">Delivery Challan</h1>
                            </header>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">From (Consignor):</h3>
                                    <p className="text-zoru-ink">{yourBusinessDetails.name}</p>
                                    <p className="text-zoru-ink-muted">{yourBusinessDetails.address}</p>
                                </div>
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">To (Consignee):</h3>
                                    <EntityPicker
                                        entity="client"
                                        value={selectedClientId || null}
                                        onChange={(next) => setSelectedClientId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                                    />
                                    {selectedClient && (
                                        <p className="text-zoru-ink-muted mt-1">{selectedClient?.phone}</p>
                                    )}
                                </div>
                            </section>

                            <section className="grid grid-cols-2 gap-4 mb-8">
                                <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Challan No *</ZoruLabel><ZoruInput name="challanNumber" defaultValue="DC-00001" className="h-8" required maxLength={50} /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Challan Date *</ZoruLabel><DatePicker date={challanDate} setDate={setChallanDate} /></div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} />
                            </section>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-4">
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Reason for Delivery</ZoruLabel><ZoruInput name="reason" placeholder="e.g. For Job Work, Sale on Approval" maxLength={200} /></div>
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Notes (Optional)</ZoruLabel><ZoruTextarea name="notes" placeholder="Any special instructions..." maxLength={500} /></div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-zoru-ink">Transport Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Vehicle Number</ZoruLabel><ZoruInput name="vehicleNumber" placeholder="e.g. RJ14 AB 1234" maxLength={20} /></div>
                                        <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Driver Name</ZoruLabel><ZoruInput name="driverName" placeholder="e.g. John Doe" maxLength={100} /></div>
                                    </div>
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Transport Mode</ZoruLabel><ZoruInput name="mode" placeholder="e.g. By Road" maxLength={100} /></div>
                                </div>
                            </section>
                            <ZoruSeparator className="my-8" />
                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-2">
                                    <ZoruLabel className="text-zoru-ink">Signature (Consignor)</ZoruLabel>
                                    <div className="h-24 border border-zoru-line rounded-lg bg-zoru-surface-2 flex items-center justify-center text-zoru-ink-muted text-sm">Authorized Signatory</div>
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel className="text-zoru-ink">Signature (Consignee)</ZoruLabel>
                                    <div className="h-24 border border-zoru-line rounded-lg bg-zoru-surface-2 flex items-center justify-center text-zoru-ink-muted text-sm">Receiver&apos;s Signature</div>
                                </div>
                            </section>
                        </div>
                    </ZoruCard>
                </div>
            </div>
        </form>
    );
}
