

'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Save, LoaderCircle, PlusCircle, Trash2 } from 'lucide-react';
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

const initialState = { message: null, error: null };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Payment
    </Button>
  );
}

const StepIndicator = ({ currentStep, step, title }: { currentStep: number, step: number, title: string }) => (
    <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= step ? 'bg-primary text-primary-foreground' : 'bg-muted border'}`}>
            {currentStep > step ? <Check className="h-5 w-5"/> : step}
        </div>
        <div>
            <p className="text-sm text-muted-foreground">Step {step}</p>
            <p className="font-semibold">{title}</p>
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
    const [settledInvoices, setSettledInvoices] = useState<{invoiceId: string, amountSettled: number}[]>([]);
    
    const [isDataLoading, startDataLoading] = useTransition();

    useEffect(() => {
        startDataLoading(async () => {
            const data = await getCrmAccounts();
            setClients(data.accounts);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            router.push('/dashboard/crm/sales/receipts');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

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
        setPaymentRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSettlementChange = (invoiceId: string, amount: number) => {
        setSettledInvoices(prev => {
            const existing = prev.find(s => s.invoiceId === invoiceId);
            if (existing) {
                return prev.map(s => s.invoiceId === invoiceId ? { ...s, amountSettled: amount } : s);
            } else {
                return [...prev, { invoiceId, amountSettled: amount }];
            }
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

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Button variant="ghost" asChild className="-ml-4">
                            <Link href="/dashboard/crm/sales/receipts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Receipts</Link>
                        </Button>
                        <h1 className="text-3xl font-bold font-headline mt-2">Record Payment Received</h1>
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
                            <Card>
                                <CardContent className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5"><Label htmlFor="receiptNumber">Payment Receipt No *</Label><Input id="receiptNumber" name="receiptNumber" defaultValue="A00001" required/></div>
                                        <div className="space-y-1.5"><Label htmlFor="receiptDate">Receipt Date *</Label><DatePicker id="receiptDate" date={receiptDate} setDate={setReceiptDate} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="client-select">Payment Received From *</Label>
                                            <Select name="accountId" required onValueChange={handleClientChange}>
                                                <SelectTrigger id="client-select"><SelectValue placeholder="Select a Client..."/></SelectTrigger>
                                                <SelectContent>{clients.map(client => <SelectItem key={client._id.toString()} value={client._id.toString()}>{client.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="currency">Currency *</Label>
                                            <Select name="currency" defaultValue={currency} onValueChange={setCurrency} required><SelectTrigger id="currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">Indian Rupee (INR, ₹)</SelectItem><SelectItem value="USD">US Dollar (USD, $)</SelectItem></SelectContent></Select>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="justify-end">
                                    <Button onClick={() => setStep(2)} disabled={!selectedClientId}>Continue</Button>
                                </CardFooter>
                            </Card>
                        )}
                        {step === 2 && (
                            <Card>
                                <CardHeader><CardTitle>Record Payments</CardTitle><CardDescription>Record multiple payments against multiple invoices.</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    {paymentRecords.map((record, index) => (
                                        <div key={record.id} className="p-3 border rounded-lg space-y-3 relative bg-muted/50">
                                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemovePaymentRecord(record.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            <div className="grid md:grid-cols-2 gap-4"><div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={record.amount} onChange={(e) => handleRecordChange(record.id, 'amount', Number(e.target.value))}/></div><div className="space-y-1.5"><Label>Payment Date *</Label><DatePicker date={record.date} setDate={(d) => handleRecordChange(record.id, 'date', d)}/></div></div>
                                            <div className="space-y-1.5"><Label>Mode *</Label><Select value={record.mode} onValueChange={(v) => handleRecordChange(record.id, 'mode', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Cheque">Cheque</SelectItem></SelectContent></Select></div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" onClick={handleAddPaymentRecord}><PlusCircle className="mr-2 h-4 w-4" /> Add New Payment Record</Button>
                                </CardContent>
                                <CardFooter className="justify-between">
                                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                                    <Button onClick={() => setStep(3)} disabled={totalAmountReceived <= 0}>Continue</Button>
                                </CardFooter>
                            </Card>
                        )}
                        {step === 3 && (
                            <Card>
                                <CardHeader><CardTitle>Settle Unpaid Invoices</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <Card className="bg-primary/5 border-primary/20">
                                        <CardContent className="p-3 grid grid-cols-2 gap-4">
                                            <div><Label className="text-xs">Amount Received</Label><p className="font-bold text-lg">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountReceived)}</p></div>
                                            <div><Label className="text-xs">Amount to Settle</Label><p className="font-bold text-lg">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountSettled)}</p></div>
                                            <div className="col-span-2"><Separator/></div>
                                            <div className="col-span-2"><Label className="text-xs">Amount to be recorded as Advance</Label><p className="font-bold text-xl text-primary">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(advanceAmount)}</p></div>
                                        </CardContent>
                                    </Card>
                                    {isDataLoading ? (<LoaderCircle className="animate-spin" />) : unpaidInvoices.length > 0 ? (
                                        <div className="space-y-2">
                                            {unpaidInvoices.map(invoice => (
                                                 <div key={invoice._id.toString()} className="flex items-center gap-2 p-2 border rounded-md">
                                                    <div className="flex-1 space-y-1"><p className="font-medium text-sm">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">Due: {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(invoice.total)}</p></div>
                                                    <Input type="number" placeholder="Settle Amount" className="w-32" max={invoice.total} onChange={(e) => handleSettlementChange(invoice._id.toString(), Number(e.target.value))} />
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
                                        <Label>Notes (Optional)</Label>
                                        <Textarea name="notes" placeholder="e.g. Received via GPay"/>
                                    </div>
                                </CardContent>
                                <CardFooter className="justify-between">
                                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                                    <SaveButton disabled={isDataLoading} />
                                </CardFooter>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
