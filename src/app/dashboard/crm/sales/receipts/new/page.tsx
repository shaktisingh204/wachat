

'use client';

import { useState, useEffect, useActionState, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Trash2, ArrowLeft, Save, File as FileIcon, Edit, ChevronDown, Info, Upload, Image as ImageIcon, Settings, Printer, Share2, LoaderCircle, Repeat, Checkbox, IndianRupee, Banknote, User, GitCompare, Landmark, ReceiptText, NotebookText, Contact, UserCog, BadgeInfo } from 'lucide-react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import type { WithId, CrmAccount, PaymentRecord, CrmInvoice } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getUnpaidInvoicesByAccount } from '@/app/actions/crm-invoices.actions';
import { useToast } from '@/hooks/use-toast';
import { savePaymentReceipt } from '@/app/actions/crm-payment-receipts.actions';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const initialState = { message: null, error: null };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Receipt
    </Button>
  );
}

const StepIndicator = ({ step, title, active, complete }: { step: number; title: string; active: boolean; complete: boolean; }) => (
    <div className="flex items-center gap-4">
        <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2",
            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
            complete && "border-green-500 bg-green-500 text-white"
        )}>
            {complete ? <Check className="h-5 w-5"/> : <span className="font-bold">{step}</span>}
        </div>
        <div>
            <h3 className={cn("font-semibold", active ? "text-primary" : "text-muted-foreground")}>{title}</h3>
        </div>
    </div>
);

type SettledInvoice = {
    invoiceId: string;
    totalAmount: number;
    amountToSettle: number;
};

export default function NewPaymentReceiptPage() {
    const [state, formAction] = useActionState(savePaymentReceipt, initialState);
    const router = useRouter();
    const { toast } = useToast();

    // Form State
    const [currentStep, setCurrentStep] = useState(1);
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [unpaidInvoices, setUnpaidInvoices] = useState<WithId<CrmInvoice>[]>([]);
    const [isDataLoading, startDataLoading] = useTransition();

    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());
    const [currency, setCurrency] = useState('INR');
    const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([{ id: uuidv4(), date: new Date(), amount: 0, mode: 'Cash' }]);
    const [settledInvoices, setSettledInvoices] = useState<SettledInvoice[]>([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        getCrmAccounts().then(data => setClients(data.accounts));
    }, []);

    useEffect(() => {
        if (selectedClientId) {
            startDataLoading(async () => {
                const invoices = await getUnpaidInvoicesByAccount(selectedClientId);
                setUnpaidInvoices(invoices);
                // Initialize settlement state
                setSettledInvoices(invoices.map(inv => ({ invoiceId: inv._id.toString(), totalAmount: inv.total, amountToSettle: 0 })));
            });
        } else {
            setUnpaidInvoices([]);
            setSettledInvoices([]);
        }
    }, [selectedClientId]);

    useEffect(() => {
        if (state.message) {
          toast({ title: 'Success!', description: state.message });
          router.push('/dashboard/crm/sales/receipts');
        }
        if (state.error) {
          toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);
    
    const handleNextStep = () => {
        if (currentStep === 1 && !selectedClientId) {
            toast({title: 'Client Required', description: 'Please select a client to proceed.', variant: 'destructive'});
            return;
        }
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    };

    const handleRecordChange = (id: string, field: keyof PaymentRecord, value: any) => {
        setPaymentRecords(prev => prev.map(rec => rec.id === id ? {...rec, [field]: value} : rec));
    }
    const handleAddRecord = () => setPaymentRecords(prev => [...prev, { id: uuidv4(), date: new Date(), amount: 0, mode: 'Cash' }]);
    const handleRemoveRecord = (id: string) => setPaymentRecords(prev => prev.filter(rec => rec.id !== id));
    
    const handleSettlementChange = (invoiceId: string, amount: number) => {
        const totalAmount = unpaidInvoices.find(inv => inv._id.toString() === invoiceId)?.total || 0;
        const settledAmount = Math.max(0, Math.min(amount, totalAmount));
        setSettledInvoices(prev => prev.map(inv => inv.invoiceId === invoiceId ? {...inv, amountToSettle: settledAmount} : inv));
    };

    const totalAmountReceived = paymentRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
    const totalAmountSettled = settledInvoices.reduce((sum, inv) => sum + (inv.amountToSettle || 0), 0);
    const unallocatedAmount = totalAmountReceived - totalAmountSettled;
    
    return (
        <form action={formAction}>
            <input type="hidden" name="accountId" value={selectedClientId} />
            <input type="hidden" name="receiptDate" value={receiptDate?.toISOString()} />
            <input type="hidden" name="currency" value={currency} />
            <input type="hidden" name="paymentRecords" value={JSON.stringify(paymentRecords)} />
            <input type="hidden" name="settledInvoices" value={JSON.stringify(settledInvoices.filter(s => s.amountToSettle > 0))} />
            <input type="hidden" name="notes" value={notes} />
            
            <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/sales/receipts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Receipts</Link>
                            </Button>
                            <h1 className="text-3xl font-bold font-headline mt-2">Record Payment Receipt</h1>
                        </div>
                        <div className="flex items-center gap-2">
                             {currentStep < 3 && <Button type="button" variant="outline" onClick={handleNextStep}>Continue</Button>}
                            <SaveButton disabled={totalAmountReceived <= 0} />
                        </div>
                     </header>
                    
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Step Indicators */}
                        <div className="w-full md:w-1/4 space-y-6">
                            <StepIndicator step={1} title="Client & Date" active={currentStep === 1} complete={currentStep > 1} />
                            <StepIndicator step={2} title="Payment Records" active={currentStep === 2} complete={currentStep > 2}/>
                            <StepIndicator step={3} title="Settle Invoices" active={currentStep === 3} complete={false} />
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 space-y-6">
                            {currentStep === 1 && (
                                 <Card>
                                    <CardHeader><CardTitle>Client Details</CardTitle></CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2"><Label>Payment Receipt No *</Label><Input name="receiptNumber" defaultValue="A00001" /></div>
                                            <div className="space-y-2"><Label>Receipt Date *</Label><DatePicker date={receiptDate} setDate={setReceiptDate} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2"><Label>Payment Received From *</Label><Select onValueChange={setSelectedClientId}><SelectTrigger><SelectValue placeholder="Select Client..."/></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c._id.toString()} value={c._id.toString()}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-2"><Label>Currency *</Label><Select defaultValue="INR" onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">Indian Rupee (INR)</SelectItem><SelectItem value="USD">US Dollar (USD)</SelectItem></SelectContent></Select></div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                             {currentStep === 2 && (
                                 <Card>
                                    <CardHeader><CardTitle>Record Payments</CardTitle><CardDescription>Record multiple payments against multiple invoices.</CardDescription></CardHeader>
                                    <CardContent className="space-y-4">
                                        {paymentRecords.map((record, index) => (
                                            <div key={record.id} className="p-3 border rounded-lg grid md:grid-cols-4 gap-4 items-end relative">
                                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemoveRecord(record.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                <div className="space-y-2"><Label>Date</Label><DatePicker date={record.date} setDate={d => handleRecordChange(record.id, 'date', d)} /></div>
                                                <div className="space-y-2"><Label>Amount</Label><Input type="number" value={record.amount} onChange={e => handleRecordChange(record.id, 'amount', Number(e.target.value))} /></div>
                                                <div className="space-y-2"><Label>Mode</Label><Select value={record.mode} onValueChange={v => handleRecordChange(record.id, 'mode', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Cheque">Cheque</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Credit Card">Credit Card</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                                                <div className="space-y-2"><Label>Reference</Label><Input value={record.reference || ''} onChange={e => handleRecordChange(record.id, 'reference', e.target.value)} /></div>
                                            </div>
                                        ))}
                                        <Button variant="outline" onClick={handleAddRecord}><PlusCircle className="mr-2 h-4 w-4"/>Add Payment Record</Button>
                                    </CardContent>
                                </Card>
                            )}
                             {currentStep === 3 && (
                                 <Card>
                                     <CardHeader>
                                        <CardTitle>Settle Unpaid Invoices</CardTitle>
                                        <div className="flex justify-between items-center text-sm pt-2">
                                            <p>Total Received: <span className="font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmountReceived)}</span></p>
                                            <p className={unallocatedAmount < 0 ? 'text-destructive' : 'text-green-600'}>Unallocated: <span className="font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(unallocatedAmount)}</span></p>
                                        </div>
                                     </CardHeader>
                                    <CardContent>
                                        {isDataLoading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : unpaidInvoices.length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Invoice #</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Amount Due</TableHead>
                                                        <TableHead className="text-right">Payment</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {unpaidInvoices.map(invoice => {
                                                        const settlement = settledInvoices.find(s => s.invoiceId === invoice._id.toString());
                                                        return (
                                                            <TableRow key={invoice._id.toString()}>
                                                                <TableCell>{invoice.invoiceNumber}</TableCell>
                                                                <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                                                                <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(invoice.total)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Input type="number" className="w-24 text-right ml-auto" value={settlement?.amountToSettle || ''} onChange={e => handleSettlementChange(invoice._id.toString(), Number(e.target.value))} max={invoice.total} />
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <div className="text-center text-muted-foreground p-8">
                                                <p>No unpaid invoices found for this client.</p>
                                                <p className="text-xs">Any payment recorded will be considered an advance.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                            <div className="space-y-2 pt-4">
                                <Label>Additional Notes</Label>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Payment for Q3 services."/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
