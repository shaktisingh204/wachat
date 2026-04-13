
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Save, LoaderCircle, PlusCircle, Trash2, Check } from 'lucide-react';
import { SmartClientSelect } from '@/components/crm/sales/smart-client-select';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, CrmInvoice, PaymentRecord } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getUnpaidInvoicesByAccount } from '@/app/actions/crm-invoices.actions';
import { savePaymentReceipt } from '@/app/actions/crm-payment-receipts.actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NotebookText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const initialState = { message: '', error: '' };

function SaveButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending || disabled}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Payment
        </ClayButton>
    );
}

const StepIndicator = ({ currentStep, step, title }: { currentStep: number, step: number, title: string }) => (
    <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= step ? 'bg-clay-obsidian text-white' : 'bg-clay-surface-2 border border-clay-border'}`}>
            {currentStep > step ? <Check className="h-5 w-5" /> : step}
        </div>
        <div>
            <p className="text-sm text-clay-ink-muted">Step {step}</p>
            <p className="font-semibold text-clay-ink">{title}</p>
        </div>
    </div>
);

export default function RecordPaymentPage() {
    const [state, formAction] = useActionState(savePaymentReceipt, initialState);
    const router = useRouter();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [step, setStep] = useState(1);
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
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
                return prev; // Nothing to remove
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
            <input type="hidden" name="receiptDate" value={receiptDate?.toISOString()} />
            <input type="hidden" name="currency" value={currency} />
            <input type="hidden" name="paymentRecords" value={JSON.stringify(paymentRecords)} />
            <input type="hidden" name="settledInvoices" value={JSON.stringify(settledInvoices)} />
            <input type="hidden" name="notes" value={(typeof document !== 'undefined' ? (document.getElementById('notes') as HTMLTextAreaElement)?.value : '') || ''} />

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Link href="/dashboard/crm/sales/receipts">
                            <ClayButton variant="pill" size="sm" leading={<ArrowLeft className="h-4 w-4" />}>Back to Receipts</ClayButton>
                        </Link>
                        <h1 className="text-[26px] font-semibold tracking-tight text-clay-ink mt-2">Record Payment Received</h1>
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
                            <ClayCard padded={false}>
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5"><Label htmlFor="receiptNumber" className="text-clay-ink">Payment Receipt No *</Label><Input id="receiptNumber" name="receiptNumber" defaultValue="A00001" required maxLength={50} /></div>
                                        <div className="space-y-1.5"><Label htmlFor="receiptDate" className="text-clay-ink">Receipt Date *</Label><DatePicker date={receiptDate} setDate={setReceiptDate} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="client-select" className="text-clay-ink">Payment Received From *</Label>
                                            <SmartClientSelect
                                                value={selectedClientId}
                                                onSelect={handleClientChange}
                                                initialOptions={clients.map(c => ({ value: c._id.toString(), label: c.name }))}
                                                onClientAdded={(newClient: any) => {
                                                    if (newClient) {
                                                        const newId = newClient._id?.toString() || newClient.insertedId?.toString();
                                                        setClients(prev => [...prev, { ...newClient, _id: newId }]);
                                                        handleClientChange(newId);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="currency" className="text-clay-ink">Currency *</Label>
                                            <Select name="currency" defaultValue={currency} onValueChange={setCurrency} required><SelectTrigger id="currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">Indian Rupee (INR, ₹)</SelectItem><SelectItem value="USD">US Dollar (USD, $)</SelectItem></SelectContent></Select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end p-6 pt-0">
                                    <ClayButton type="button" variant="obsidian" onClick={() => setStep(2)} disabled={!selectedClientId}>Continue</ClayButton>
                                </div>
                            </ClayCard>
                        )}
                        {step === 2 && (
                            <ClayCard padded={false}>
                                <div className="p-6">
                                    <h2 className="text-[15px] font-semibold text-clay-ink">Record Payments</h2>
                                    <p className="text-[12.5px] text-clay-ink-muted mt-1">Record multiple payments against multiple invoices.</p>
                                </div>
                                <div className="space-y-4 px-6">
                                    {paymentRecords.map((record, index) => (
                                        <div key={record.id} className="p-3 border border-clay-border rounded-clay-md space-y-3 relative bg-clay-surface-2">
                                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemovePaymentRecord(record.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            <div className="grid md:grid-cols-2 gap-4"><div className="space-y-1.5"><Label className="text-clay-ink">Amount *</Label><Input type="number" value={record.amount} onChange={(e) => handleRecordChange(record.id, 'amount', e.target.value)} /></div><div className="space-y-1.5"><Label className="text-clay-ink">Payment Date *</Label><DatePicker date={record.date} setDate={(d: any) => handleRecordChange(record.id, 'date', d)} /></div></div>
                                            <div className="space-y-1.5"><Label className="text-clay-ink">Mode *</Label><Select value={record.mode} onValueChange={(v) => handleRecordChange(record.id, 'mode', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Cheque">Cheque</SelectItem></SelectContent></Select></div>
                                            <div className="space-y-1.5"><Label className="text-clay-ink">Reference # (Optional)</Label><Input value={record.reference || ''} onChange={(e) => handleRecordChange(record.id, 'reference', e.target.value)} maxLength={100} /></div>
                                        </div>
                                    ))}
                                    <ClayButton type="button" variant="pill" onClick={handleAddPaymentRecord} leading={<PlusCircle className="h-4 w-4" />}>Add New Payment Record</ClayButton>
                                </div>
                                <div className="flex justify-between p-6">
                                    <ClayButton type="button" variant="pill" onClick={() => setStep(1)}>Back</ClayButton>
                                    <ClayButton type="button" variant="obsidian" onClick={() => setStep(3)} disabled={totalAmountReceived <= 0}>Continue</ClayButton>
                                </div>
                            </ClayCard>
                        )}
                        {step === 3 && (
                            <ClayCard padded={false}>
                                <div className="p-6">
                                    <h2 className="text-[15px] font-semibold text-clay-ink">Settle Unpaid Invoices</h2>
                                </div>
                                <div className="space-y-6 px-6">
                                    <ClayCard variant="soft" padded={false} className="bg-clay-rose-soft/30 border-clay-rose-soft">
                                        <div className="p-3 grid grid-cols-2 gap-4">
                                            <div><Label className="text-xs text-clay-ink">Amount Received</Label><p className="font-bold text-lg text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountReceived)}</p></div>
                                            <div><Label className="text-xs text-clay-ink">Amount to Settle</Label><p className="font-bold text-lg text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountSettled)}</p></div>
                                            <div className="col-span-2"><Separator /></div>
                                            <div className="col-span-2"><Label className="text-xs text-clay-ink">Amount to be recorded as Advance</Label><p className="font-bold text-xl text-clay-rose-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(advanceAmount)}</p></div>
                                        </div>
                                    </ClayCard>
                                    {isDataLoading ? (<LoaderCircle className="animate-spin" />) : unpaidInvoices.length > 0 ? (
                                        <div className="space-y-2">
                                            {unpaidInvoices.map(invoice => (
                                                <div key={invoice._id.toString()} className="flex items-center gap-2 p-2 border border-clay-border rounded-clay-md">
                                                    <div className="flex-1 space-y-1"><p className="font-medium text-sm text-clay-ink">{invoice.invoiceNumber}</p><p className="text-xs text-clay-ink-muted">Due: {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(invoice.total)}</p></div>
                                                    <Input type="number" placeholder="Settle Amount" className="w-32" max={invoice.total} onChange={(e) => handleSettlementChange(invoice._id.toString(), e.target.value)} />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Alert>
                                            <NotebookText className="h-4 w-4" />
                                            <AlertTitle>No Unpaid Invoices Found</AlertTitle>
                                            <AlertDescription>This payment will be recorded as an advance.</AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="notes" className="text-clay-ink">Notes (Optional)</Label>
                                        <Textarea id="notes" name="notes" placeholder="e.g. Received via GPay" maxLength={500} />
                                    </div>
                                </div>
                                <div className="flex justify-between p-6">
                                    <ClayButton type="button" variant="pill" onClick={() => setStep(2)}>Back</ClayButton>
                                    <SaveButton disabled={isDataLoading} />
                                </div>
                            </ClayCard>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
