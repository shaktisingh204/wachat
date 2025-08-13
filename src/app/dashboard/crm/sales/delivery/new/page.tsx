
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
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, Truck } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
    pan: 'FNSPK2133N'
}

type LineItem = {
    id: string;
    name: string;
    hsnCode?: string;
    quantity: number;
    unit?: string;
    rate?: number;
};

const LineItemsTable = ({ items, setItems }: { items: LineItem[], setItems: React.Dispatch<React.SetStateAction<LineItem[]>>}) => {
    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', quantity: 1 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    
    return (
        <div className="mt-6">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted">
                        <tr className="border-b">
                            <th className="p-3 text-left font-medium">Item Name*</th>
                            <th className="p-3 text-left font-medium">HSN Code</th>
                            <th className="p-3 text-right font-medium">Quantity*</th>
                            <th className="p-3 text-left font-medium">Unit</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b">
                                <td className="p-2"><Input placeholder="Item Name" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required/></td>
                                <td className="p-2"><Input placeholder="e.g. 998314" value={item.hsnCode} onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)} /></td>
                                <td className="p-2"><Input type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} required /></td>
                                <td className="p-2"><Input placeholder="e.g. PCS, Kgs" value={item.unit} onChange={e => handleItemChange(item.id, 'unit', e.target.value)} /></td>
                                <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Add New Line</Button>
            </div>
        </div>
    );
}

export default function NewDeliveryChallanPage() {
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [challanDate, setChallanDate] = useState<Date | undefined>(new Date());
    const [lineItems, setLineItems] = useState<LineItem[]>([{ id: '1', name: '', quantity: 1 }]);
    
    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={() => {}}>
            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/delivery"><ArrowLeft className="mr-2 h-4 w-4" />Back to Delivery Challans</Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" disabled>Save As Draft</Button>
                             <Button type="submit" disabled>
                                <Save className="mr-2 h-4 w-4" />
                                Save
                            </Button>
                        </div>
                     </header>
                    <Card className="max-w-4xl mx-auto shadow-2xl p-4 sm:p-8 md:p-12">
                        <CardContent className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl font-bold text-primary">Delivery Challan</h1>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2">From (Consignor):</h3>
                                    <p className="font-bold">{yourBusinessDetails.name}</p>
                                    <p className="text-muted-foreground">{yourBusinessDetails.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2">To (Consignee):</h3>
                                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger><SelectValue placeholder="Select a Client..."/></SelectTrigger>
                                        <SelectContent>{clients.map(client => <SelectItem key={client._id.toString()} value={client._id.toString()}>{client.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {selectedClient && (
                                        <p className="text-muted-foreground mt-1">{selectedClient?.phone}</p>
                                    )}
                                </div>
                            </section>

                            <section className="grid grid-cols-2 gap-4 mb-8">
                                <div className="space-y-1"><Label className="text-xs">Challan No *</Label><Input defaultValue="DC-00001" className="h-8"/></div>
                                <div className="space-y-1"><Label className="text-xs">Challan Date *</Label><DatePicker date={challanDate} setDate={setChallanDate} /></div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} />
                            </section>

                            <Separator className="my-8"/>
                            
                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label>Reason for Delivery</Label><Input placeholder="e.g. For Job Work, Sale on Approval" /></div>
                                    <div className="space-y-2"><Label>Notes (Optional)</Label><Textarea placeholder="Any special instructions..." /></div>
                                </div>
                                <div className="space-y-4">
                                     <h3 className="font-semibold">Transport Details</h3>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Vehicle Number</Label><Input placeholder="e.g. RJ14 AB 1234"/></div>
                                        <div className="space-y-2"><Label>Driver Name</Label><Input placeholder="e.g. John Doe"/></div>
                                     </div>
                                      <div className="space-y-2"><Label>Transport Mode</Label><Input placeholder="e.g. By Road"/></div>
                                </div>
                            </section>
                            <Separator className="my-8"/>
                            <section className="grid md:grid-cols-2 gap-8 mt-8">
                                <div className="space-y-2">
                                    <Label>Signature (Consignor)</Label>
                                    <div className="h-24 border rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">Authorized Signatory</div>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Signature (Consignee)</Label>
                                    <div className="h-24 border rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">Receiver's Signature</div>
                                </div>
                            </section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
