'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruAlert,
    ZoruAlertDescription,
    ZoruAlertTitle,
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSeparator,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Save, LoaderCircle, PlusCircle, Trash2, Check } from 'lucide-react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, CrmInvoice, PaymentRecord } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getUnpaidInvoicesByAccount } from '@/app/actions/crm-invoices.actions';
import { savePaymentReceipt } from '@/app/actions/crm-payment-receipts.actions';
import { useRouter, usePathname } from 'next/navigation';
import { NotebookText } from 'lucide-react';
import { EntityPicker } from '@/components/crm/entity-picker';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState = { message: '', error: '' };

function SaveButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending || disabled}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Payment
        </ZoruButton>
    );
}

const StepIndicator = ({ currentStep, step, title }: { currentStep: number, step: number, title: string }) => (
    <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= step ? 'bg-zoru-ink text-white' : 'bg-zoru-surface-2 border border-zoru-line'}`}>
            {currentStep > step ? <Check className="h-5 w-5" /> : step}
        </div>
        <div>
            <p className="text-sm text-zoru-ink-muted">Step {step}</p>
            <p className="text-zoru-ink">{title}</p>
        </div>
    </div>
);

export default function RecordPaymentPage() {
    const [state, formAction] = useActionState(savePaymentReceipt, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [step, setStep] = useState(1);
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [bankAccountId, setBankAccountId] = useState<string>('');
    const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());
    const [currency, setCurrency] = useState<string>('INR');

    const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([{ id: uuidv4(), date: new Date(), amount: 0, mode: 'Bank Transfer' }]);

    const [unpaidInvoices, setUnpaidInvoices] = useState<WithId<CrmInvoice>[]>([]);
    const [settledInvoices, setSettledInvoices] = useState<{ invoiceId: string, amountSettled: number }[]>([]);

    const [isDataLoading, startDataLoading] = useTransition();

    useEffect(() => {
        startDataLoading(async () => {
            const data = await getCrmAccounts();
            setClients(data.accounts);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            router.push('/dashboard/crm/sales/receipts');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const fetchInvoices = async (accountId: string) => {
        if (!accountId) return;
        startDataLoading(async () => {
            const data = await getUnpaidInvoicesByAccount(accountId);
            setUnpaidInvoices(data);
        });
    }

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId);
        fetchInvoices(clientId);
    }

    const handleAddPaymentRecord = () => {
        setPaymentRecords(prev => [...prev, { id: uuidv4(), date: new Date(), amount: 0, mode: 'Bank Transfer' }]);
    };

    const handleRemovePaymentRecord = (id: string) => {
        setPaymentRecords(prev => prev.filter(r => r.id !== id));
    };

    const handleRecordChange = (id: string, field: keyof PaymentRecord, value: any) => {
        setPaymentRecords(prev =>
            prev.map(r => {
                if (r.id === id) {
                    let processedValue = value;
                    if (field === 'amount') {
                        const amount = parseFloat(value);
                        processedValue = isNaN(amount) ? 0 : amount;
                    }
                    return { ...r, [field]: processedValue };
                }
                return r;
            })
        );
    };

    const handleSettlementChange = (invoiceId: string, value: string) => {
        const amount = parseFloat(value);
        const settledAmount = isNaN(amount) ? 0 : amount;

        setSettledInvoices(prev => {
            const existingIndex = prev.findIndex(item => item.invoiceId === invoiceId);

            if (settledAmount <= 0) {
                if (existingIndex > -1) {
                    return prev.filter((_, index) => index !== existingIndex);
                }
                return prev;
            }

            if (existingIndex > -1) {
                const updated = [...prev];
                updated[existingIndex].amountSettled = settledAmount;
                return updated;
            }

            return [...prev, { invoiceId, amountSettled: settledAmount }];
        });
    };

    const totalAmountReceived = paymentRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const totalAmountSettled = settledInvoices.reduce((sum, s) => sum + s.amountSettled, 0);
    const advanceAmount = totalAmountReceived - totalAmountSettled;


    return (
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="bankAccountId" value={bankAccountId} />
            <input type="hidden" name="receiptDate" value={receiptDate?.toISOString()} />
            <input type="hidden" name="currency" value={currency} />
            <input type="hidden" name="paymentRecords" value={JSON.stringify(paymentRecords)} />
            <input type="hidden" name="settledInvoices" value={JSON.stringify(settledInvoices)} />
            <input type="hidden" name="notes" value={(typeof document !== 'undefined' ? (document.getElementById('notes') as HTMLTextAreaElement)?.value : '') || ''} />

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Link href="/dashboard/crm/sales/receipts">
                            <ZoruButton variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back to Receipts</ZoruButton>
                        </Link>
                        <h1 className="text-[26px] text-zoru-ink mt-2">Record Payment Received</h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-4">
                        <div className="space-y-6 sticky top-24">
                            <StepIndicator currentStep={step} step={1} title="Select Client" />
                            <StepIndicator currentStep={step} step={2} title="Add Payment Records" />
                            <StepIndicator currentStep={step} step={3} title="Settle Unpaid Invoices" />
                        </div>
                    </div>
                    <div className="md:col-span-8">
                        {step === 1 && (
                            <ZoruCard className="p-0">
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5"><ZoruLabel htmlFor="receiptNumber" className="text-zoru-ink">Payment Receipt No *</ZoruLabel><ZoruInput id="receiptNumber" name="receiptNumber" defaultValue="A00001" required maxLength={50} /></div>
                                        <div className="space-y-1.5"><ZoruLabel htmlFor="receiptDate" className="text-zoru-ink">Receipt Date *</ZoruLabel><DatePicker date={receiptDate} setDate={setReceiptDate} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <ZoruLabel htmlFor="client-select" className="text-zoru-ink">Payment Received From *</ZoruLabel>
                                            <EntityPicker
                                                entity="client"
                                                value={selectedClientId || null}
                                                allowCreate
                                                placeholder="Select client…"
                                                onCreateClick={() => {
                                                    const ret = encodeURIComponent(pathname);
                                                    router.push(`/dashboard/crm/sales/clients/new?return=${ret}`);
                                                }}
                                                onChange={(next) => {
                                                    const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                    handleClientChange(id);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel className="text-zoru-ink">Currency *</ZoruLabel>
                                            <EntityFormField
                                                entity="currency"
                                                name="__currency_picker"
                                                initialId={currency}
                                                onChange={(id) => setCurrency(id || 'INR')}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <ZoruLabel htmlFor="bank-account-select" className="text-zoru-ink">Deposit To (Bank Account)</ZoruLabel>
                                            <EntityPicker
                                                entity="bankAccount"
                                                value={bankAccountId || null}
                                                placeholder="Select bank account…"
                                                onChange={(next) => {
                                                    const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                    setBankAccountId(id);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end p-6 pt-0">
                                    <ZoruButton type="button" onClick={() => setStep(2)} disabled={!selectedClientId}>Continue</ZoruButton>
                                </div>
                            </ZoruCard>
                        )}
                        {step === 2 && (
                            <ZoruCard className="p-0">
                                <div className="p-6">
                                    <h2 className="text-[15px] text-zoru-ink">Record Payments</h2>
                                    <p className="text-[12.5px] text-zoru-ink-muted mt-1">Record multiple payments against multiple invoices.</p>
                                </div>
                                <div className="space-y-4 px-6">
                                    {paymentRecords.map((record, index) => (
                                        <div key={record.id} className="p-3 border border-zoru-line rounded-lg space-y-3 relative bg-zoru-surface-2">
                                            <ZoruButton variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemovePaymentRecord(record.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton>
                                            <div className="grid md:grid-cols-2 gap-4"><div className="space-y-1.5"><ZoruLabel className="text-zoru-ink">Amount *</ZoruLabel><ZoruInput type="number" value={record.amount} onChange={(e) => handleRecordChange(record.id, 'amount', e.target.value)} /></div><div className="space-y-1.5"><ZoruLabel className="text-zoru-ink">Payment Date *</ZoruLabel><DatePicker date={record.date} setDate={(d: any) => handleRecordChange(record.id, 'date', d)} /></div></div>
                                            <div className="space-y-1.5"><ZoruLabel className="text-zoru-ink">Mode *</ZoruLabel><ZoruSelect value={record.mode} onValueChange={(v) => handleRecordChange(record.id, 'mode', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="Bank Transfer">Bank Transfer</ZoruSelectItem><ZoruSelectItem value="Cash">Cash</ZoruSelectItem><ZoruSelectItem value="Cheque">Cheque</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                            <div className="space-y-1.5"><ZoruLabel className="text-zoru-ink">Reference # (Optional)</ZoruLabel><ZoruInput value={record.reference || ''} onChange={(e) => handleRecordChange(record.id, 'reference', e.target.value)} maxLength={100} /></div>
                                        </div>
                                    ))}
                                    <ZoruButton type="button" variant="outline" onClick={handleAddPaymentRecord}><PlusCircle className="h-4 w-4" />Add New Payment Record</ZoruButton>
                                </div>
                                <div className="flex justify-between p-6">
                                    <ZoruButton type="button" variant="outline" onClick={() => setStep(1)}>Back</ZoruButton>
                                    <ZoruButton type="button" onClick={() => setStep(3)} disabled={totalAmountReceived <= 0}>Continue</ZoruButton>
                                </div>
                            </ZoruCard>
                        )}
                        {step === 3 && (
                            <ZoruCard className="p-0">
                                <div className="p-6">
                                    <h2 className="text-[15px] text-zoru-ink">Settle Unpaid Invoices</h2>
                                </div>
                                <div className="space-y-6 px-6">
                                    <ZoruCard className="p-0 bg-zoru-surface-2 border border-zoru-line">
                                        <div className="p-3 grid grid-cols-2 gap-4">
                                            <div><ZoruLabel className="text-xs text-zoru-ink">Amount Received</ZoruLabel><p className="text-lg text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountReceived)}</p></div>
                                            <div><ZoruLabel className="text-xs text-zoru-ink">Amount to Settle</ZoruLabel><p className="text-lg text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountSettled)}</p></div>
                                            <div className="col-span-2"><ZoruSeparator /></div>
                                            <div className="col-span-2"><ZoruLabel className="text-xs text-zoru-ink">Amount to be recorded as Advance</ZoruLabel><p className="text-xl text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(advanceAmount)}</p></div>
                                        </div>
                                    </ZoruCard>
                                    {isDataLoading ? (<LoaderCircle className="animate-spin" />) : unpaidInvoices.length > 0 ? (
                                        <div className="space-y-2">
                                            {unpaidInvoices.map(invoice => (
                                                <div key={invoice._id.toString()} className="flex items-center gap-2 p-2 border border-zoru-line rounded-lg">
                                                    <div className="flex-1 space-y-1"><p className="text-sm text-zoru-ink">{invoice.invoiceNumber}</p><p className="text-xs text-zoru-ink-muted">Due: {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(invoice.total)}</p></div>
                                                    <ZoruInput type="number" placeholder="Settle Amount" className="w-32" max={invoice.total} onChange={(e) => handleSettlementChange(invoice._id.toString(), e.target.value)} />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <ZoruAlert>
                                            <NotebookText className="h-4 w-4" />
                                            <ZoruAlertTitle>No Unpaid Invoices Found</ZoruAlertTitle>
                                            <ZoruAlertDescription>This payment will be recorded as an advance.</ZoruAlertDescription>
                                        </ZoruAlert>
                                    )}
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="notes" className="text-zoru-ink">Notes (Optional)</ZoruLabel>
                                        <ZoruTextarea id="notes" name="notes" placeholder="e.g. Received via GPay" maxLength={500} />
                                    </div>
                                </div>
                                <div className="flex justify-between p-6">
                                    <ZoruButton type="button" variant="outline" onClick={() => setStep(2)}>Back</ZoruButton>
                                    <SaveButton disabled={isDataLoading} />
                                </div>
                            </ZoruCard>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
