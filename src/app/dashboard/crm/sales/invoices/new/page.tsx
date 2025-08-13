
'use client';

import { useState, useEffect, useActionState, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ArrowLeft, Save, File as FileIcon, Edit, ChevronDown, Info, Upload, Image as ImageIcon, Settings, Printer, Share2, LoaderCircle, Repeat, Checkbox } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, InvoiceLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { saveInvoice } from '@/app/actions/crm-invoices.actions';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';

type TermItem = { id: string; text: string; }
type AdditionalInfoItem = { id: string; key: string; value: string; }

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
    pan: 'FNSPK2133N'
}

const initialState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save & Continue
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
                        {items.map((item, index) => (
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
}

export default function NewInvoicePage() {
    const [state, formAction] = useActionState(saveInvoice, initialState);
    const router = useRouter();
    const { toast } = useToast();
    
    // Form State
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
    const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    const [showTerms, setShowTerms] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
    const [showContactDetails, setShowContactDetails] = useState(false);
    const [terms, setTerms] = useState<TermItem[]>([ { id: '1', text: 'Applicable taxes will be extra.' }, { id: '2', text: 'Work will resume after advance payment.' }, ]);
    const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfoItem[]>([]);
    const [notes, setNotes] = useState('');
    const [contactDetails, setContactDetails] = useState({email: '', phone: ''});

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
          toast({ title: 'Success!', description: state.message });
          router.push('/dashboard/crm/sales/invoices');
        }
        if (state.error) {
          toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);
      
    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
             {/* Hidden inputs for form submission */}
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="invoiceDate" value={invoiceDate?.toISOString()} />
            <input type="hidden" name="dueDate" value={dueDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="termsAndConditions" value={JSON.stringify(terms.map(t => t.text))} />
            <input type="hidden" name="additionalInfo" value={JSON.stringify(additionalInfo.map(f => ({key: f.key, value: f.value})))} />
            <input type="hidden" name="notes" value={notes} />
            
            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to Invoices</Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline">Save As Draft</Button>
                            <SaveButton />
                        </div>
                     </header>
                    <Card className="max-w-4xl mx-auto shadow-2xl p-4 sm:p-8 md:p-12">
                        <CardContent className="p-0">
                            <header className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
                                    <Input placeholder="Add Subtitle (e.g. For Website Redesign)" className="border-0 shadow-none -ml-3 p-0 h-auto text-muted-foreground focus-visible:ring-0 text-base" />
                                </div>
                                <div className="flex justify-end">
                                    <div className="w-32 h-32 bg-muted flex items-center justify-center rounded-md"><ImageIcon className="h-12 w-12 text-muted-foreground/50"/></div>
                                </div>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2">Billed By:</h3>
                                    <p className="font-bold">{yourBusinessDetails.name}</p>
                                    <p className="text-muted-foreground">{yourBusinessDetails.address}</p>
                                    <p className="text-muted-foreground">GSTIN: {yourBusinessDetails.gstin}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2">Billed To:</h3>
                                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger><SelectValue placeholder="Select a Client..."/></SelectTrigger>
                                        <SelectContent>{clients.map(client => <SelectItem key={client._id.toString()} value={client._id.toString()}>{client.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {selectedClient && (
                                        <>
                                            <p className="text-muted-foreground mt-1">{selectedClient?.phone}</p>
                                        </>
                                    )}
                                </div>
                            </section>

                            <section className="grid grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><Label htmlFor="invoiceNumber" className="text-xs">Invoice No *</Label><Input id="invoiceNumber" name="invoiceNumber" defaultValue="A00001" className="h-8"/></div>
                                 <div className="space-y-1"><Label className="text-xs">Invoice Date *</Label><DatePicker date={invoiceDate} setDate={setInvoiceDate} className="h-8"/></div>
                                <div className="space-y-1"><Label className="text-xs">Due Date</Label><DatePicker date={dueDate} setDate={setDueDate} className="h-8"/></div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>
                            
                            <Separator className="my-8"/>
                            
                            {/* Footer Sections */}
                            <section className="mt-8 space-y-4">
                                {showTerms ? ( <div className="space-y-2"><Label className="font-semibold">Terms & Conditions</Label>{terms.map((term, index) => (<div key={term.id} className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><Input value={term.text} onChange={(e) => setTerms(terms.map(t => t.id === term.id ? { ...t, text: e.target.value } : t))} /><Button type="button" variant="ghost" size="icon" onClick={() => setTerms(terms.filter(t => t.id !== term.id))}><Trash2 className="h-4 w-4" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => setTerms([...terms, { id: `term-${Date.now()}`, text: '' }])}><PlusCircle className="mr-2 h-4 w-4"/>Add New Term</Button></div>) : (<Button type="button" variant="link" size="sm" onClick={() => setShowTerms(true)}>Add Terms & Conditions</Button>)}
                                {showNotes ? (<div className="space-y-2"><Label className="font-semibold">Additional Notes</Label><Textarea placeholder="Any additional notes for the client..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>) : (<Button type="button" variant="link" size="sm" onClick={() => setShowNotes(true)}>Add Notes</Button>)}
                                {showAttachments ? (<div className="space-y-2"><Label className="font-semibold">Attachments</Label><div className="flex items-center justify-center w-full"><label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"><div className="flex flex-col items-center justify-center"><Upload className="w-6 h-6 mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p></div><input id="dropzone-file" type="file" className="hidden" /></label></div><p className="text-xs text-muted-foreground">Max file size is 10 MB.</p></div>) : (<Button type="button" variant="link" size="sm" onClick={() => setShowAttachments(true)}>Add Attachments</Button>)}
                                {showAdditionalInfo ? (<div className="space-y-2"><Label className="font-semibold">Additional Info</Label>{additionalInfo.map((field, index) => (<div key={field.id} className="flex items-center gap-2"><Input placeholder="Field Name" value={field.key} onChange={e => setAdditionalInfo(additionalInfo.map(f => f.id === field.id ? {...f, key: e.target.value} : f))} /><Input placeholder="Value" value={field.value} onChange={e => setAdditionalInfo(additionalInfo.map(f => f.id === field.id ? {...f, value: e.target.value} : f))} /><Button type="button" variant="ghost" size="icon" onClick={() => setAdditionalInfo(additionalInfo.filter(f => f.id !== field.id))}><Trash2 className="h-4 w-4" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => setAdditionalInfo([...additionalInfo, {id: uuidv4(), key: '', value: ''}])}><PlusCircle className="mr-2 h-4 w-4"/>Add More Fields</Button></div>) : (<Button type="button" variant="link" size="sm" onClick={() => setShowAdditionalInfo(true)}>Add Additional Info</Button>)}
                                {showContactDetails ? (<div className="space-y-2"><Label className="font-semibold">Your Contact Details</Label><div className="space-y-2"><Input type="email" placeholder="Your Email (optional)" value={contactDetails.email} onChange={e => setContactDetails(prev => ({...prev, email: e.target.value}))}/><Input type="tel" placeholder="Your Phone (optional)" value={contactDetails.phone} onChange={e => setContactDetails(prev => ({...prev, phone: e.target.value}))}/></div></div>) : (<Button type="button" variant="link" size="sm" onClick={() => setShowContactDetails(true)}>Add Contact Details</Button>)}
                                {showSignature ? (<div className="space-y-2"><Label className="font-semibold">Signature</Label><div className="h-24 border rounded-md bg-muted/50 flex items-center justify-center"><Button type="button" variant="outline">Upload Signature</Button></div></div>) : (<Button type="button" variant="link" size="sm" onClick={() => setShowSignature(true)}>Add Signature</Button>)}
                            </section>
                            <Separator className="my-8" />
                             <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Switch id="recurring-invoice" />
                                    <Label htmlFor="recurring-invoice">This is a Recurring Invoice</Label>
                                </div>
                                <p className="text-xs text-muted-foreground pl-7">
                                    A draft invoice will be created with the same details every next period.
                                </p>
                            </div>
                            <Separator className="my-8" />
                            <div className="space-y-2">
                                <h3 className="font-semibold">Advanced Options</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                    <div className="flex items-center space-x-2"><Checkbox id="show-tax" /><Label htmlFor="show-tax" className="font-normal">Show tax summary</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="hide-country" /><Label htmlFor="hide-country" className="font-normal">Hide place/country of supply</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="show-images" /><Label htmlFor="show-images" className="font-normal">Show original images</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="show-thumbnails" /><Label htmlFor="show-thumbnails" className="font-normal">Show thumbnails</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="full-width-desc" /><Label htmlFor="full-width-desc" className="font-normal">Full width description</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="show-sku" /><Label htmlFor="show-sku" className="font-normal">Show SKU in Invoice</Label></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}

