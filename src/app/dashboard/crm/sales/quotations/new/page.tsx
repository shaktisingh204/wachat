'use client';

import { useState, useEffect, useActionState, useRef, useCallback } from 'react';
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
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, Image as ImageIcon, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, QuotationLineItem } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { saveQuotation } from '@/app/actions/crm-quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { useRouter, usePathname } from 'next/navigation';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EntityPicker } from '@/components/crm/entity-picker';
import { CustomFieldInput, type CustomFieldValue } from '@/components/crm/custom-field-input';
import type { LookupItem } from '@/lib/lookup-registry';

type TermItem = { id: string; text: string; }
type AdditionalInfoItem = { id: string; key: string; value: string; }

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
            Save & Continue
        </ZoruButton>
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

const TermsAndConditions = ({ terms, setTerms }: { terms: TermItem[], setTerms: React.Dispatch<React.SetStateAction<TermItem[]>> }) => {
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
            <ZoruLabel className="text-zoru-ink">Terms & Conditions</ZoruLabel>
            {terms.map((term, index) => (
                <div key={term.id} className="flex items-center gap-2">
                    <span className="text-sm text-zoru-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                    <ZoruInput value={term.text} onChange={(e) => handleTermChange(term.id, e.target.value)} maxLength={500} />
                    <ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveTerm(term.id)}><Trash2 className="h-4 w-4" /></ZoruButton>
                </div>
            ))}
            <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddTerm}><PlusCircle className="h-4 w-4" />Add New Term</ZoruButton>
        </div>
    );
};

const AdditionalInfo = ({ fields, setFields }: { fields: AdditionalInfoItem[], setFields: React.Dispatch<React.SetStateAction<AdditionalInfoItem[]>> }) => {
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
            <ZoruLabel className="text-zoru-ink">Additional Info</ZoruLabel>
            {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                    <ZoruInput placeholder="Field Name" value={field.key} onChange={e => handleFieldChange(field.id, 'key', e.target.value)} maxLength={100} />
                    <ZoruInput placeholder="Value" value={field.value} onChange={e => handleFieldChange(field.id, 'value', e.target.value)} maxLength={100} />
                    <ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveField(field.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton>
                </div>
            ))}
            <ZoruButton type="button" variant="outline" className="w-full" onClick={handleAddField}><PlusCircle className="h-4 w-4" />Add More Fields</ZoruButton>
        </div>
    );
}

export default function NewQuotationPage() {
    const [state, formAction] = useActionState(saveQuotation, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useZoruToast();

    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [pickedClient, setPickedClient] = useState<LookupItem | null>(null);
    const [quotationDate, setQuotationDate] = useState<Date | undefined>(new Date());
    const [validTillDate, setValidTillDate] = useState<Date | undefined>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    const [lineItems, setLineItems] = useState<QuotationLineItem[]>([{ id: '1', name: '', description: '', quantity: 1, rate: 0 }]);
    const [terms, setTerms] = useState<TermItem[]>([
        { id: '1', text: 'Applicable taxes will be extra.' },
        { id: '2', text: 'Work will resume after advance payment.' },
    ]);
    const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfoItem[]>([]);
    const [notes, setNotes] = useState('');
    const [contactDetails, setContactDetails] = useState({ email: '', phone: '' });
    const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);

    // Custom-field definitions configured in CRM Settings → Custom Fields
    // for entity=quotation. Loaded once on mount.
    const [customFields, setCustomFields] = useState<WsCustomField[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<
        Record<string, CustomFieldValue>
    >({});

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const defs = await getCustomFieldsFor('quotation');
                if (!cancelled) setCustomFields((defs as WsCustomField[]) ?? []);
            } catch {
                // Non-fatal — the rest of the form still works.
                if (!cancelled) setCustomFields([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleCustomFieldChange = useCallback(
        (slug: string, next: CustomFieldValue) => {
            setCustomFieldValues((prev) => ({ ...prev, [slug]: next }));
        },
        [],
    );

    // Wrap the server action so we can serialize per-slug custom-field
    // values into the FormData under the `customFields` key (JSON-encoded
    // object keyed by `WsCustomField.name`). Matches the storage contract
    // consumed by `applyCustomFieldsToEntity`.
    const handleFormAction = useCallback(
        (formData: FormData) => {
            formData.set('customFields', JSON.stringify(customFieldValues));
            formAction(formData);
        },
        [formAction, customFieldValues],
    );

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
        <form action={handleFormAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="quotationDate" value={quotationDate?.toISOString()} />
            <input type="hidden" name="validTillDate" value={validTillDate?.toISOString()} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
            <input type="hidden" name="termsAndConditions" value={JSON.stringify(terms.map(t => t.text))} />
            <input type="hidden" name="additionalInfo" value={JSON.stringify(additionalInfo.map(f => ({ key: f.key, value: f.value })))} />
            <input type="hidden" name="notes" value={notes} />
            <input type="hidden" name="attachmentUrls" value={JSON.stringify(attachments.map(a => a.url))} />

            <div>
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/crm/sales/quotations">
                                <ZoruButton variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back to Quotations</ZoruButton>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruButton variant="outline">Save As Draft</ZoruButton>
                            <SaveButton />
                        </div>
                    </header>
                    <ZoruCard className="p-0 max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                        <div className="p-0">
                            <header className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h1 className="text-3xl text-zoru-ink">QUOTATION</h1>
                                    <ZoruInput placeholder="Add Subtitle (e.g. For Website Redesign)" className="border-0 shadow-none -ml-3 p-0 h-auto text-zoru-ink-muted text-base" />
                                </div>
                                <div className="flex justify-end">
                                    <div className="w-32 h-32 bg-zoru-surface-2 flex items-center justify-center rounded-lg"><ImageIcon className="h-12 w-12 text-zoru-ink-muted" /></div>
                                </div>
                            </header>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm mb-8">
                                <div>
                                    <h3 className="mb-2 text-zoru-ink">From:</h3>
                                    <p className="text-zoru-ink">{yourBusinessDetails.name}</p>
                                    <p className="text-zoru-ink-muted">{yourBusinessDetails.address}</p>
                                    <p className="text-zoru-ink-muted">GSTIN: {yourBusinessDetails.gstin}</p>
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
                                    {(() => {
                                        const pickedRaw = pickedClient && pickedClient.id === selectedClientId
                                            ? (pickedClient.raw as Record<string, any> | undefined)
                                            : undefined;
                                        const billedToAddress = selectedClient?.address
                                            ?? (pickedRaw?.billingAddress as string | undefined)
                                            ?? (pickedRaw?.address as string | undefined);
                                        const billedToPhone = selectedClient?.phone
                                            ?? (pickedRaw?.phone as string | undefined);
                                        if (!billedToAddress && !billedToPhone) return null;
                                        return (
                                            <div className="mt-2">
                                                {billedToAddress && <p className="text-zoru-ink-muted">{billedToAddress}</p>}
                                                {billedToPhone && <p className="text-zoru-ink-muted">{billedToPhone}</p>}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>

                            <section className="grid grid-cols-3 gap-4 mb-8">
                                <div className="space-y-1"><ZoruLabel htmlFor="quotationNumber" className="text-xs text-zoru-ink">Quotation No.</ZoruLabel><ZoruInput id="quotationNumber" name="quotationNumber" placeholder="Leave blank to auto-generate" className="h-8" maxLength={50} /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Quotation Date *</ZoruLabel><DatePicker date={quotationDate} setDate={setQuotationDate} className="h-8" /></div>
                                <div className="space-y-1"><ZoruLabel className="text-xs text-zoru-ink">Valid Till Date</ZoruLabel><DatePicker date={validTillDate} setDate={setValidTillDate} className="h-8" /></div>
                            </section>

                            <section>
                                <QuotationLineItems items={lineItems} setItems={setLineItems} currency="INR" />
                            </section>

                            <ZoruSeparator className="my-8" />

                            <section className="grid md:grid-cols-2 gap-8 text-sm">
                                <div className="space-y-6">
                                    <TermsAndConditions terms={terms} setTerms={setTerms} />
                                    <div className="space-y-2"><ZoruLabel className="text-zoru-ink">Additional Notes</ZoruLabel><ZoruTextarea placeholder="Any additional notes for the client..." value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
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
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-zoru-ink">Your Contact Details</ZoruLabel>
                                        <div className="space-y-2">
                                            <ZoruInput type="email" placeholder="Your Email (optional)" value={contactDetails.email} onChange={e => setContactDetails(prev => ({ ...prev, email: e.target.value }))} />
                                            <ZoruInput type="tel" placeholder="Your Phone (optional)" value={contactDetails.phone} onChange={e => setContactDetails(prev => ({ ...prev, phone: e.target.value }))} />
                                        </div>
                                    </div>
                                    <AdditionalInfo fields={additionalInfo} setFields={setAdditionalInfo} />
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-zoru-ink">Signature</ZoruLabel>
                                        <div className="h-24 border border-zoru-line rounded-lg bg-zoru-surface-2 flex items-center justify-center"><ZoruButton type="button" variant="outline">Upload Signature</ZoruButton></div>
                                    </div>
                                </div>
                            </section>

                            {customFields.length > 0 ? (
                                <section className="mt-8 space-y-3 border-t border-zoru-line pt-6">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                                        Custom Fields
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {customFields.map((f) => (
                                            <CustomFieldInput
                                                key={String(f._id ?? f.name)}
                                                field={f}
                                                value={customFieldValues[f.name]}
                                                onChange={(next) => handleCustomFieldChange(f.name, next)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ) : null}
                        </div>
                    </ZoruCard>
                </div>
            </div>
        </form>
    );
}
