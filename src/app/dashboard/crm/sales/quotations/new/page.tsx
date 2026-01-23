
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
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, File as FileIcon, Edit, ChevronDown, Info, Upload, Image as ImageIcon, Settings, Printer, Share2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, QuotationLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useToast } from '@/hooks/use-toast';
import { saveQuotation } from '@/app/actions/crm-quotations.actions';
import { useRouter } from 'next/navigation';

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

const QuotationLineItems = ({ items, setItems, currency }: { items: QuotationLineItem[], setItems: React.Dispatch<React.SetStateAction<QuotationLineItem[]>>, currency: string }) => {
    const handleAddItem = () => {
        setItems([...items, { id: `item-${Date.now()}`, name: '', description: '', quantity: 1, rate: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof Omit<QuotationLineItem, 'id'>, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const calculateAmount = (quantity: number, rate: number) => {
        return (quantity * rate).toFixed(2);
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
                                <td className="p-2"><Input placeholder="Name/SKU Id (Required)" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required maxLength={100} /></td>
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

const TermsAndConditions = ({ terms, setTerms }: { terms: TermItem[], setTerms: React.Dispatch<React.SetStateAction<TermItem[]>>}) => {
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
            <Label className="font-semibold">Terms & Conditions</Label>
            {terms.map((term, index) => (
                <div key={term.id} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <Input value={term.text} onChange={(e) => handleTermChange(term.id, e.target.value)} maxLength={500} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTerm(term.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddTerm}><PlusCircle className="mr-2 h-4 w-4"/>Add New Term</Button>
        </div>
    );
};

const AdditionalInfo = ({ fields, setFields }: { fields: AdditionalInfoItem[], setFields: React.Dispatch<React.SetStateAction<AdditionalInfoItem[]>>}) => {
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
            <Label className="font-semibold">Additional Info</Label>
             {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                    <Input placeholder="Field Name" value={field.key} onChange={e => handleFieldChange(field.id, 'key', e.target.value)} maxLength={100} />
                    <Input placeholder="Value" value={field.value} onChange={e => handleFieldChange(field.id, 'value', e.target.value)} maxLength={100} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveField(field.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
             ))}
             <Button type="button" variant="outline" className="w-full" onClick={handleAddField}><PlusCircle className="mr-2 h-4 w-4"/>Add More Fields</Button>
        </div>
    );
}

export default function NewQuotationPage() {
    const [state, formAction] = useActionState(saveQuotation, initialState);
    const router = useRouter();
    const { toast } = useToast();
    
    // Form State
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [quotationDate, setQuotationDate] = useState<Date | undefined>(new Date());
    const [validTillDate, setValidTillDate] = useState<Date | undefined>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    const [lineItems, setLineItems] = useState<QuotationLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    const [terms, setTerms] = useState<TermItem[]>([
        { id: '1', text: 'Applicable taxes will be extra.' },
        { id: '2', text: 'Work will resume after advance payment.' },
    ]);
    const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfoItem[]>([]);
    const [notes, setNotes] = useState('');
    const [contactDetails, setContactDetails] = useState({email: '', phone: ''});

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (state.message) {
          toast({ title: 'Success!', description: state.message });
          router.push('/dashboard/crm/sales/quotations');
        }
        if (state.error) {
          toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
      }, [state, toast, router]);
      
    const selectedClient = clients.find(c => c._id.toString() === selectedClientId);

    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="quotationDate" value={quotationDate?.toISOString()} />
            <input type="hidden" name="validTillDate" value={validTillDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="termsAndConditions" value={JSON.stringify(terms.map(t => t.text))} />
            <input type="hidden" name="additionalInfo" value={JSON.stringify(additionalInfo.map(f => ({key: f.key, value: f.value})))} />
            <input type="hidden" name="notes" value={notes} />

            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/quotations"><ArrowLeft className="mr-2 h-4 w-4" />Back to Quotations</Link>
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
                                    <h1 className="text-3xl font-bold text-primary">QUOTATION</h1>
                                    <Input placeholder="Add Subtitle (e.g. For Website Redesign)" className="border-0 shadow-none -ml-3 p-0 h-auto text-muted-foreground focus-visible:ring-0 text-base" />
                                </div>
                                <div className="flex justify-end">
                                    <div className="w-32 h-32 bg-muted flex items-center justify-center rounded-md"><ImageIcon className="h-12 w-12 text-muted-foreground/50"/></div>
                                </div>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="font-semibold mb-2">From:</h3>
                                    <p className="font-bold">{yourBusinessDetails.name}</p>
                                    <p className="text-muted-foreground">{yourBusinessDetails.address}</p>
                                    <p className="text-muted-foreground">GSTIN: {yourBusinessDetails.gstin}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2">To:</h3>
                                     <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger><SelectValue placeholder="Select a Client..."/></SelectTrigger>
                                        <SelectContent>{clients.map(client => <SelectItem key={client._id.toString()} value={client._id.toString()}>{client.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {selectedClient && (
                                        <>
                                            <p className="text-muted-foreground">{selectedClient.address}</p>
                                            <p className="text-muted-foreground">{selectedClient.phone}</p>
                                        </>
                                    )}
                                </div>
                            </section>

                            <section className="grid grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><Label htmlFor="quotationNumber" className="text-xs">Quotation No.</Label><Input id="quotationNumber" name="quotationNumber" placeholder="Leave blank to auto-generate" className="h-8" maxLength={50} /></div>
                                 <div className="space-y-1"><Label className="text-xs">Quotation Date *</Label><DatePicker date={quotationDate} setDate={setQuotationDate} className="h-8"/></div>
                                <div className="space-y-1"><Label className="text-xs">Valid Till Date</Label><DatePicker date={validTillDate} setDate={setValidTillDate} className="h-8"/></div>
                            </section>

                            <section>
                                <QuotationLineItems items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>
                            
                            <Separator className="my-8"/>
                            
                            <section className="grid md:grid-cols-2 gap-8 text-sm">
                                 <div className="space-y-6">
                                    <TermsAndConditions terms={terms} setTerms={setTerms} />
                                    <div className="space-y-2"><Label className="font-semibold">Additional Notes</Label><Textarea placeholder="Any additional notes for the client..." value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
                                    <div className="space-y-2">
                                        <Label className="font-semibold">Attachments</Label>
                                        <div className="flex items-center justify-center w-full">
                                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"><div className="flex flex-col items-center justify-center"><Upload className="w-6 h-6 mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p></div><input id="dropzone-file" type="file" className="hidden" /></label>
                                        </div>
                                         <p className="text-xs text-muted-foreground">Max file size is 10 MB.</p>
                                    </div>
                                </div>
                                 <div className="space-y-6">
                                     <div className="space-y-2">
                                        <Label className="font-semibold">Your Contact Details</Label>
                                        <div className="space-y-2">
                                            <Input type="email" placeholder="Your Email (optional)" value={contactDetails.email} onChange={e => setContactDetails(prev => ({...prev, email: e.target.value}))}/>
                                            <Input type="tel" placeholder="Your Phone (optional)" value={contactDetails.phone} onChange={e => setContactDetails(prev => ({...prev, phone: e.target.value}))}/>
                                        </div>
                                    </div>
                                    <AdditionalInfo fields={additionalInfo} setFields={setAdditionalInfo} />
                                    <div className="space-y-2">
                                        <Label className="font-semibold">Signature</Label>
                                        <div className="h-24 border rounded-md bg-muted/50 flex items-center justify-center"><Button type="button" variant="outline">Upload Signature</Button></div>
                                    </div>
                                </div>
                            </section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
