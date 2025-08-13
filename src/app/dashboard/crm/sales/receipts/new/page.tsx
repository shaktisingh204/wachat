
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Check, IndianRupee, NotebookText, Contact, PlusCircle, Trash2, Save, LoaderCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { WithId, CrmAccount, CrmInvoice, PaymentRecord } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getUnpaidInvoicesByAccount } from '@/app/actions/crm-invoices.actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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
    const [step, setStep] = useState(1);
    
    // Step 1 State
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());

    // Step 2 State
    const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([{ id: `rec-${Date.now()}`, date: new Date(), amount: 0, mode: 'Bank Transfer' }]);
    
    // Step 3 State
    const [unpaidInvoices, setUnpaidInvoices] = useState<WithId<CrmInvoice>[]>([]);
    
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getCrmAccounts();
            setClients(data.accounts);
        });
    }, []);

    const fetchInvoices = async (accountId: string) => {
        if(!accountId) return;
        startTransition(async () => {
            const data = await getUnpaidInvoicesByAccount(accountId);
            setUnpaidInvoices(data);
        });
    }

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId);
        fetchInvoices(clientId);
    }

    const handleAddPaymentRecord = () => {
        setPaymentRecords(prev => [...prev, { id: `rec-${Date.now()}`, date: new Date(), amount: 0, mode: 'Bank Transfer' }]);
    };
    
    const handleRemovePaymentRecord = (id: string) => {
        setPaymentRecords(prev => prev.filter(r => r.id !== id));
    };

    const handleRecordChange = (id: string, field: keyof PaymentRecord, value: any) => {
        setPaymentRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };
    
    const totalAmountReceived = paymentRecords.reduce((sum, record) => sum + record.amount, 0);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                 <div>
                    <Button variant="ghost" asChild className="-ml-4">
                        <Link href="/dashboard/crm/sales/receipts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Receipts</Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline mt-2">Record Payment Received</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">Save as Draft</Button>
                    <Button disabled={step !== 3}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Stepper */}
                <div className="md:col-span-4">
                    <div className="space-y-6 sticky top-24">
                        <StepIndicator currentStep={step} step={1} title="Select Client" />
                        <StepIndicator currentStep={step} step={2} title="Add Payment Records" />
                        <StepIndicator currentStep={step} step={3} title="Settle Unpaid Invoices" />
                    </div>
                </div>

                {/* Form Content */}
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
                                        <Select name="currency" defaultValue="INR" required><SelectTrigger id="currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">Indian Rupee (INR, ₹)</SelectItem><SelectItem value="USD">US Dollar (USD, $)</SelectItem></SelectContent></Select>
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
                            <CardHeader>
                                <CardTitle>Record Payments</CardTitle>
                                <CardDescription>Record multiple payments against multiple invoices.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {paymentRecords.map((record, index) => (
                                    <div key={record.id} className="p-3 border rounded-lg space-y-3 relative bg-muted/50">
                                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemovePaymentRecord(record.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                         <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={record.amount} onChange={(e) => handleRecordChange(record.id, 'amount', Number(e.target.value))}/></div>
                                            <div className="space-y-1.5"><Label>Payment Date *</Label><DatePicker date={record.date} setDate={(d) => handleRecordChange(record.id, 'date', d)}/></div>
                                         </div>
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
                            <CardHeader>
                                <CardTitle>Settle Unpaid Invoices</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {isLoading ? (<LoaderCircle className="animate-spin" />) : unpaidInvoices.length > 0 ? (
                                    <div>Invoices will be listed here.</div>
                                ) : (
                                    <Alert>
                                        <NotebookText className="h-4 w-4" />
                                        <AlertTitle>No Unpaid Invoices Found</AlertTitle>
                                        <AlertDescription>
                                            There are no unpaid invoices against this client. This payment will be recorded as an advance.
                                            <Button variant="link" asChild className="p-0 h-auto ml-2"><Link href="#">See Client Statement</Link></Button>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <Separator />
                                <div className="space-y-2">
                                    <Button variant="link" size="sm">Add Notes</Button>
                                    <Button variant="link" size="sm">Add Contact Details</Button>
                                    <Button variant="link" size="sm">Add Additional Info</Button>
                                    <Button variant="link" size="sm">Add Signature</Button>
                                </div>
                            </CardContent>
                             <CardFooter className="justify-between">
                                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                                <Button>Save Payment</Button>
                            </CardFooter>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
