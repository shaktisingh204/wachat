'use client';

import { useState, useEffect, useActionState, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruButton,
    ZoruCard,
    ZoruCheckbox,
    ZoruInput,
    ZoruLabel,
    ZoruSeparator,
    ZoruSwitch,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { PlusCircle, Trash2, ArrowLeft, Save, File as FileIcon, Edit, ChevronDown, Info, Upload, Image as ImageIcon, Settings, Printer, Share2, LoaderCircle, Repeat, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, InvoiceLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { saveInvoice } from '@/app/actions/crm-invoices.actions';
import { useRouter } from 'next/navigation';
import { SmartClientSelect } from '@/components/crm/sales/smart-client-select';
import { SmartProductSelect } from '@/components/crm/inventory/smart-product-select';
import { SabFilePickerButton } from '@/components/sabfiles';

type TermItem = { id: string; text: string; }
type AdditionalInfoItem = { id: string; key: string; value: string; }

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
    pan: 'FNSPK2133N'
}

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save & Continue
        </ZoruButton>
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
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b border-zoru-line">
                                <td className="p-2">
                                    <SmartProductSelect
                                        value={item.id.startsWith('item-') && !item.name ? '' : undefined}
                                        placeholder="Select Product"
                                        onSelect={(val) => { }}
                                        onProductChange={(product) => {
                                            handleItemChange(item.id, 'name', product.name);
                                            handleItemChange(item.id, 'rate', product.sellingPrice);
                                        }}
                                        className="w-full"
                                    />
                                </td>
                                <td className="p-2"><ZoruInput type="number" className="w-24 text-right" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} /></td>
                                <td className="p-2"><ZoruInput type="number" className="w-32 text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', Number(e.target.value))} /></td>
                                <td className="p-2 text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(item.quantity * item.rate)}</td>
                                <td className="p-2"><ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 space-y-2">
                <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="h-4 w-4" />Add New Line</ZoruButton>
            </div>
            <ZoruSeparator />
            <div className="p-4 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center"><span className="text-zoru-ink-muted">Total ({currency})</span><span className="text-lg text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</span></div>
                </div>
            </div>
        </div>
    );
}

export default function NewInvoicePage() {
    const [state, formAction] = useActionState(saveInvoice, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

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
    const [terms, setTerms] = useState<TermItem[]>([{ id: '1', text: 'Applicable taxes will be extra.' }, { id: '2', text: 'Work will resume after advance payment.' },]);
    const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfoItem[]>([]);
    const [notes, setNotes] = useState('');
    const [contactDetails, setContactDetails] = useState({ email: '', phone: '' });
    const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);

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
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="invoiceDate" value={invoiceDate?.toISOString()} />
            <input type="hidden" name="dueDate" value={dueDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="termsAndConditions" value={JSON.stringify(terms.map(t => t.text))} />
            <input type="hidden" name="additionalInfo" value={JSON.stringify(additionalInfo.map(f => ({ key: f.key, value: f.value })))} />
            <input type="hidden" name="notes" value={notes} />
            <input type="hidden" name="currency" value="INR" />
            <input type="hidden" name="attachmentUrls" value={JSON.stringify(attachments.map(a => a.url))} />

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/invoices">
                                <ZoruButton variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back to Invoices</ZoruButton>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruButton variant="outline" type="button">Save As Draft</ZoruButton>
                            <SaveButton />
                        </div>
                    </header>
                    <ZoruCard className="p-0 max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                        <div className="p-0">
                            <header className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h1 className="text-3xl text-zoru-ink">INVOICE</h1>
                                    <ZoruInput placeholder="Add Subtitle (e.g. For Website Redesign)" className="border-0 shadow-none -ml-3 p-0 h-auto text-zoru-ink-muted text-base" />
                                </div>
                                <div className="flex justify-end">
                                    <div className="w-32 h-32 bg-zoru-surface-2 flex items-center justify-center rounded-lg"><ImageIcon className="h-12 w-12 text-zoru-ink-muted" /></div>
                                </div>
                            </header>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">Billed By:</h3>
                                    <p className="text-zoru-ink">{yourBusinessDetails.name}</p>
                                    <p className="text-zoru-ink-muted">{yourBusinessDetails.address}</p>
                                    <p className="text-zoru-ink-muted">GSTIN: {yourBusinessDetails.gstin}</p>
                                </div>
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">Billed To:</h3>
                                    <SmartClientSelect
                                        value={selectedClientId}
                                        onSelect={setSelectedClientId}
                                        initialOptions={clients.map(c => ({ value: c._id.toString(), label: c.name }))}
                                        onClientAdded={(newClient) => {
                                            if (newClient) {
                                                setClients(prev => [...prev, { ...newClient, _id: newClient._id || newClient.insertedId }]);
                                                setSelectedClientId(newClient._id?.toString() || newClient.insertedId?.toString());
                                            }
                                        }}
                                    />
                                    {selectedClient && (
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p className="text-zoru-ink">{selectedClient.name}</p>
                                            <p className="text-zoru-ink-muted">{selectedClient.address}</p>
                                            <p className="text-zoru-ink-muted">{selectedClient.phone}</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="grid grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><ZoruLabel htmlFor="invoiceNumber" className="text-xs text-zoru-ink">Invoice No *</ZoruLabel><ZoruInput id="invoiceNumber" name="invoiceNumber" defaultValue="A00001" className="h-8" maxLength={50} /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Invoice Date *</ZoruLabel><DatePicker date={invoiceDate} setDate={setInvoiceDate} className="h-8" /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Due Date</ZoruLabel><DatePicker date={dueDate} setDate={setDueDate} className="h-8" /></div>
                            </section>

                            <section>
                                <LineItemsTable items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                            <ZoruSeparator className="my-8" />

                            <section className="mt-8 space-y-4">
                                {showTerms ? (<div className="space-y-2"><ZoruLabel className="text-zoru-ink">Terms & Conditions</ZoruLabel>{terms.map((term, index) => (<div key={term.id} className="flex items-center gap-2"><span className="text-sm text-zoru-ink-muted">{String(index + 1).padStart(2, '0')}</span><ZoruInput value={term.text} onChange={(e) => setTerms(terms.map(t => t.id === term.id ? { ...t, text: e.target.value } : t))} maxLength={500} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => setTerms(terms.filter(t => t.id !== term.id))}><Trash2 className="h-4 w-4" /></ZoruButton></div>))}<ZoruButton type="button" variant="outline" size="sm" onClick={() => setTerms([...terms, { id: `term-${Date.now()}`, text: '' }])}><PlusCircle className="h-4 w-4" />Add New Term</ZoruButton></div>) : (<ZoruButton type="button" variant="ghost" size="sm" onClick={() => setShowTerms(true)}>Add Terms & Conditions</ZoruButton>)}
                                {showNotes ? (<div className="space-y-2"><ZoruLabel className="text-zoru-ink">Additional Notes</ZoruLabel><ZoruTextarea placeholder="Any additional notes for the client..." value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>) : (<ZoruButton type="button" variant="ghost" size="sm" onClick={() => setShowNotes(true)}>Add Notes</ZoruButton>)}
                                {showAttachments ? (
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-zoru-ink">Attachments</ZoruLabel>
                                        <SabFilePickerButton
                                            accept="all"
                                            title="Attach a file"
                                            onPick={({ url, name }) => {
                                                setAttachments((prev) => [...prev, { url, name }]);
                                            }}
                                        >
                                            <Upload className="h-4 w-4" /> Add attachment
                                        </SabFilePickerButton>
                                        {attachments.length > 0 && (
                                            <ul className="flex flex-col gap-1.5">
                                                {attachments.map((a, idx) => (
                                                    <li key={`${a.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-2 py-1.5">
                                                        <span className="text-xs text-zoru-ink truncate">{a.name}</span>
                                                        <ZoruButton
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Remove ${a.name}`}
                                                            onClick={() =>
                                                                setAttachments((prev) => prev.filter((_, i) => i !== idx))
                                                            }
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </ZoruButton>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <p className="text-xs text-zoru-ink-muted">Files are stored in your SabFiles library.</p>
                                    </div>
                                ) : (<ZoruButton type="button" variant="ghost" size="sm" onClick={() => setShowAttachments(true)}>Add Attachments</ZoruButton>)}
                                {showAdditionalInfo ? (<div className="space-y-2"><ZoruLabel className="text-zoru-ink">Additional Info</ZoruLabel>{additionalInfo.map((field, index) => (<div key={field.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><ZoruInput placeholder="Field Name" value={field.key} onChange={e => setAdditionalInfo(additionalInfo.map(f => f.id === field.id ? { ...f, key: e.target.value } : f))} maxLength={100} /><ZoruInput placeholder="Value" value={field.value} onChange={e => setAdditionalInfo(additionalInfo.map(f => f.id === field.id ? { ...f, value: e.target.value } : f))} maxLength={100} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => setAdditionalInfo(additionalInfo.filter(f => f.id !== field.id))}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton></div>))}<ZoruButton type="button" variant="outline" size="sm" onClick={() => setAdditionalInfo([...additionalInfo, { id: uuidv4(), key: '', value: '' }])}><PlusCircle className="h-4 w-4" />Add More Fields</ZoruButton></div>) : (<ZoruButton type="button" variant="ghost" size="sm" onClick={() => setShowAdditionalInfo(true)}>Add Additional Info</ZoruButton>)}
                                {showContactDetails ? (<div className="space-y-2"><ZoruLabel className="text-zoru-ink">Your Contact Details</ZoruLabel><div className="space-y-2"><ZoruInput type="email" placeholder="Your Email (optional)" value={contactDetails.email} onChange={e => setContactDetails(prev => ({ ...prev, email: e.target.value }))} /><ZoruInput type="tel" placeholder="Your Phone (optional)" value={contactDetails.phone} onChange={e => setContactDetails(prev => ({ ...prev, phone: e.target.value }))} /></div></div>) : (<ZoruButton type="button" variant="ghost" size="sm" onClick={() => setShowContactDetails(true)}>Add Contact Details</ZoruButton>)}
                                {showSignature ? (<div className="space-y-2"><ZoruLabel className="text-zoru-ink">Signature</ZoruLabel><div className="h-24 border border-zoru-line rounded-lg bg-zoru-surface-2 flex items-center justify-center"><ZoruButton type="button" variant="outline">Upload Signature</ZoruButton></div></div>) : (<ZoruButton type="button" variant="ghost" size="sm" onClick={() => setShowSignature(true)}>Add Signature</ZoruButton>)}
                            </section>
                            <ZoruSeparator className="my-8" />
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <ZoruSwitch id="recurring-invoice" />
                                    <ZoruLabel htmlFor="recurring-invoice" className="text-zoru-ink">This is a Recurring Invoice</ZoruLabel>
                                </div>
                                <p className="text-xs text-zoru-ink-muted pl-7">
                                    A draft invoice will be created with the same details every next period.
                                </p>
                            </div>
                            <ZoruSeparator className="my-8" />
                            <div className="space-y-2">
                                <h3 className="text-zoru-ink">Advanced Options</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                    <div className="flex items-center space-x-2"><ZoruCheckbox id="show-tax" /><ZoruLabel htmlFor="show-tax">Show tax summary</ZoruLabel></div>
                                    <div className="flex items-center space-x-2"><ZoruCheckbox id="hide-country" /><ZoruLabel htmlFor="hide-country">Hide place/country of supply</ZoruLabel></div>
                                    <div className="flex items-center space-x-2"><ZoruCheckbox id="show-images" /><ZoruLabel htmlFor="show-images">Show original images</ZoruLabel></div>
                                    <div className="flex items-center space-x-2"><ZoruCheckbox id="show-thumbnails" /><ZoruLabel htmlFor="show-thumbnails">Show thumbnails</ZoruLabel></div>
                                    <div className="flex items-center space-x-2"><ZoruCheckbox id="full-width-desc" /><ZoruLabel htmlFor="full-width-desc">Full width description</ZoruLabel></div>
                                    <div className="flex items-center space-x-2"><ZoruCheckbox id="show-sku" /><ZoruLabel htmlFor="show-sku">Show SKU in Invoice</ZoruLabel></div>
                                </div>
                            </div>
                        </div>
                    </ZoruCard>
                </div>
            </div>
        </form>
    );
}
