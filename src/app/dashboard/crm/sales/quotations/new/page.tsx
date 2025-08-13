
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ArrowLeft, Save, File, Edit, ChevronDown, Info, Upload, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Mock data, to be replaced with data fetching
const mockClients = [
    { id: '1', name: 'Gaurav Singh', address: 'Pratap Nagar, Jaipur, Rajasthan, India - 302033', phone: '+91 92570 62030' },
    { id: '2', name: 'Acme Inc.', address: '123 Business Rd, San Francisco, CA 94105', phone: '+1 415-555-1234' },
];

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
    pan: 'FNSPK2133N'
}

type LineItem = {
    id: string;
    name: string;
    description: string;
    quantity: number;
    rate: number;
};

type TermItem = {
    id: string;
    text: string;
}

type AdditionalInfoItem = {
    id: string;
    key: string;
    value: string;
}

const QuotationLineItems = () => {
    const [items, setItems] = useState<LineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 1 }]);

    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', description: '', quantity: 1, rate: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const calculateAmount = (quantity: number, rate: number) => {
        return (quantity * rate).toFixed(2);
    };
    
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

    return (
        <Card>
            <CardContent className="p-0">
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
                                    <td className="p-2"><Input placeholder="Name/SKU Id" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} /></td>
                                    <td className="p-2"><Input type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                    <td className="p-2"><Input type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                    <td className="p-2 text-right font-medium">₹{calculateAmount(item.quantity, item.rate)}</td>
                                    <td className="p-2"><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 space-y-2">
                    <Button variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Add New Line</Button>
                </div>
                <Separator />
                <div className="p-4 flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Total (INR)</span><span className="font-bold text-lg">₹{totalAmount.toFixed(2)}</span></div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const AddressCard = ({ title, name, address, gstin, pan }: { title: string, name: string, address: string, gstin?: string, pan?: string }) => (
    <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center">{title} <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><Edit className="h-4 w-4"/></Button></h3>
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                <p>{address}</p>
                {gstin && <p>GSTIN: {gstin}</p>}
                {pan && <p>PAN: {pan}</p>}
            </CardContent>
        </Card>
    </div>
)

const TermsAndConditions = () => {
    const [terms, setTerms] = useState<TermItem[]>([
        { id: '1', text: 'Applicable taxes will be extra.' },
        { id: '2', text: 'Work will resume after advance payment.' },
    ]);

    const handleAddTerm = () => {
        setTerms([...terms, { id: `term-${Date.now()}`, text: '' }]);
    };

    const handleRemoveTerm = (id: string) => {
        setTerms(terms.filter(term => term.id !== id));
    };

    const handleTermChange = (id: string, value: string) => {
        setTerms(terms.map(term => term.id === id ? { ...term, text: value } : term));
    };

    return (
        <div className="space-y-2">
            <Label>Terms & Conditions</Label>
            {terms.map((term, index) => (
                <div key={term.id} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <Input value={term.text} onChange={(e) => handleTermChange(term.id, e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveTerm(term.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddTerm}><PlusCircle className="mr-2 h-4 w-4"/>Add New Term</Button>
        </div>
    );
};

const AdditionalInfo = () => {
    const [fields, setFields] = useState<AdditionalInfoItem[]>([]);
     const handleAddField = () => {
        setFields([...fields, { id: `field-${Date.now()}`, key: '', value: '' }]);
    };
    const handleRemoveField = (id: string) => {
        setFields(fields.filter(field => field.id !== id));
    };
     const handleFieldChange = (id: string, field: 'key' | 'value', value: string) => {
        setFields(fields.map(f => f.id === id ? { ...f, [field]: value } : f));
    };
    return (
        <div className="space-y-2">
            <Label>Additional Info</Label>
             {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                    <Input placeholder="Field Name" value={field.key} onChange={e => handleFieldChange(field.id, 'key', e.target.value)} />
                    <Input placeholder="Value" value={field.value} onChange={e => handleFieldChange(field.id, 'value', e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveField(field.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddField}><PlusCircle className="mr-2 h-4 w-4"/>Add More Fields</Button>
        </div>
    );
}

export default function NewQuotationPage() {
    const [selectedClient, setSelectedClient] = useState(mockClients[0]);
    const [quotationDate, setQuotationDate] = useState<Date | undefined>(new Date());
    const [validTillDate, setValidTillDate] = useState<Date | undefined>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <div>
                    <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/crm/sales/quotations"><ArrowLeft className="mr-2 h-4 w-4" />Back to Quotations</Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline">New Quotation</h1>
                    <Input placeholder="Add Subtitle (e.g. For Website Redesign)" className="border-0 shadow-none -ml-3 p-0 h-auto text-muted-foreground focus-visible:ring-0" />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">Save As Draft</Button>
                    <Button><Save className="mr-2 h-4 w-4" />Save & Continue</Button>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="quotationNo">Quotation No *</Label>
                        <Input id="quotationNo" defaultValue="A00001" />
                    </div>
                    <div className="space-y-2">
                        <Label>Quotation Date *</Label>
                        <DatePicker date={quotationDate} setDate={setQuotationDate} />
                    </div>
                     <div className="space-y-2">
                        <Label>Valid Till Date</Label>
                        <DatePicker date={validTillDate} setDate={setValidTillDate} />
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <AddressCard title="Quotation From" {...yourBusinessDetails} />
                 <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Quotation For</h3>
                    <Select value={selectedClient.id} onValueChange={id => setSelectedClient(mockClients.find(c => c.id === id)!)}>
                        <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
                        <SelectContent>
                            {mockClients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Card className="mt-2">
                        <CardHeader><CardTitle className="text-base">{selectedClient.name}</CardTitle></CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            <p>{selectedClient.address}</p>
                            <p>{selectedClient.phone}</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <QuotationLineItems />
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <Card>
                         <CardHeader><CardTitle>Signature</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4">
                                <Button variant="outline" className="flex-1"><Upload className="mr-2 h-4 w-4"/> Upload Signature</Button>
                                <Button variant="outline" className="flex-1" disabled>Use Signature Pad</Button>
                            </div>
                            <div className="space-y-2">
                                <Label>Signature Label</Label>
                                <Input defaultValue="Authorised Signatory" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-muted-foreground">Max file size 10 MB</p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" />
                                </label>
                            </div> 
                        </CardContent>
                    </Card>
                </div>
                 <Card>
                    <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <TermsAndConditions />
                        <Separator />
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea />
                        </div>
                        <Separator />
                        <AdditionalInfo />
                        <Separator />
                        <div className="space-y-2">
                             <Label>Your Contact Details</Label>
                             <div className="space-y-2">
                                <Input type="email" placeholder="Your Email (optional)" />
                                <Input type="tel" placeholder="Your Phone (optional)" />
                             </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
