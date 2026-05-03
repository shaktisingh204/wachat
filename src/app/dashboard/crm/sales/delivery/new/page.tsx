
'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import type { WithId, CrmAccount, DeliveryChallanLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
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
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save
        </ClayButton>
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
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-secondary">
                        <tr className="border-b border-border">
                            <th className="p-3 text-left font-medium text-foreground">Item Name*</th>
                            <th className="p-3 text-left font-medium text-foreground">HSN Code</th>
                            <th className="p-3 text-right font-medium text-foreground">Quantity*</th>
                            <th className="p-3 text-left font-medium text-foreground">Unit</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b border-border">
                                <td className="p-2"><Input placeholder="Item Name" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required maxLength={100} /></td>
                                <td className="p-2"><Input placeholder="e.g. 998314" value={item.hsnCode} onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)} maxLength={20} /></td>
                                <td className="p-2"><Input type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} required /></td>
                                <td className="p-2"><Input placeholder="e.g. PCS, Kgs" value={item.unit} onChange={e => handleItemChange(item.id, 'unit', e.target.value)} maxLength={20} /></td>
                                <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ClayButton type="button" variant="pill" size="sm" onClick={handleAddItem} leading={<PlusCircle className="h-4 w-4" />}>Add New Line</ClayButton>
            </div>
        </div>
    );
}

export default function NewDeliveryChallanPage() {
    const [state, formAction] = useActionState(saveDeliveryChallan, initialState);
    const router = useRouter();
    const { toast } = useToast();

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
                                <ClayButton variant="pill" size="sm" leading={<ArrowLeft className="h-4 w-4" />}>Back to Delivery Challans</ClayButton>
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
                                <h1 className="text-3xl font-bold text-foreground">Delivery Challan</h1>
                            </header>

                            <Separator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2 text-foreground">From (Consignor):</h3>
                                    <p className="font-bold">{yourBusinessDetails.name}</p>
                                    <p className="text-muted-foreground">{yourBusinessDetails.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2 text-foreground">To (Consignee):</h3>
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
                                        <p className="text-muted-foreground mt-1">{selectedClient?.phone}</p>
                                    )}
                                </div>
                            </section>

                            <section className="grid grid-cols-2 gap-4 mb-8">
                                <div className="space-y-1"><Label className="text-xs text-foreground">Challan No *</Label><Input name="challanNumber" defaultValue="DC-00001" className="h-8" required maxLength={50} /></div>
                                <div className="space-y-1"><Label className="text-xs text-foreground">Challan Date *</Label><DatePicker date={challanDate} setDate={setChallanDate} /></div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} />
                            </section>

                            <Separator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label className="text-foreground">Reason for Delivery</Label><Input name="reason" placeholder="e.g. For Job Work, Sale on Approval" maxLength={200} /></div>
                                    <div className="space-y-2"><Label className="text-foreground">Notes (Optional)</Label><Textarea name="notes" placeholder="Any special instructions..." maxLength={500} /></div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-foreground">Transport Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label className="text-foreground">Vehicle Number</Label><Input name="vehicleNumber" placeholder="e.g. RJ14 AB 1234" maxLength={20} /></div>
                                        <div className="space-y-2"><Label className="text-foreground">Driver Name</Label><Input name="driverName" placeholder="e.g. John Doe" maxLength={100} /></div>
                                    </div>
                                    <div className="space-y-2"><Label className="text-foreground">Transport Mode</Label><Input name="mode" placeholder="e.g. By Road" maxLength={100} /></div>
                                </div>
                            </section>
                            <Separator className="my-8" />
                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-2">
                                    <Label className="text-foreground">Signature (Consignor)</Label>
                                    <div className="h-24 border border-border rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-sm">Authorized Signatory</div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">Signature (Consignee)</Label>
                                    <div className="h-24 border border-border rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-sm">Receiver&apos;s Signature</div>
                                </div>
                            </section>
                        </div>
                    </ClayCard>
                </div>
            </div>
        </form>
    );
}
