
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, IndianRupee, Banknote, User, GitCompare, Landmark, ReceiptText, NotebookText, Contact, UserCog, Settings } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { CrmAddPaymentAccountDialog } from '@/components/wabasimplify/crm-add-payment-account-dialog';

export default function RecordPaymentPage() {
    const { toast } = useToast();
    
    // Form State
    const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());
    const [amount, setAmount] = useState(0);
    const [tdsPercentage, setTdsPercentage] = useState(0);

    const tdsWithheld = (amount * tdsPercentage) / 100;

    return (
        <form>
            <div className="max-w-2xl mx-auto space-y-6">
                 <div className="flex justify-between items-center">
                     <div>
                        <Button variant="ghost" asChild className="-ml-4">
                            <Link href="/dashboard/crm/sales/receipts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Receipts</Link>
                        </Button>
                        <h1 className="text-3xl font-bold font-headline mt-2">Record Payment Received</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline">Cancel</Button>
                        <Button>
                            <Save className="mr-2 h-4 w-4" />
                            Save & Continue
                        </Button>
                    </div>
                 </div>

                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <Label htmlFor="receiptDate">Payment Receipt Date</Label>
                                <DatePicker id="receiptDate" date={receiptDate} setDate={setReceiptDate} />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="paymentMethod">Payment Method *</Label>
                                <Select name="paymentMethod" required>
                                    <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="cheque">Cheque</SelectItem>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="upi">UPI</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="depositedTo">Deposited To *</Label>
                            <div className="flex gap-2">
                                <Select name="depositedTo" required>
                                    <SelectTrigger><SelectValue placeholder="Select Payment Account"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hdfc_bank">HDFC Bank</SelectItem>
                                        <SelectItem value="cash_in_hand">Cash In Hand</SelectItem>
                                    </SelectContent>
                                </Select>
                                <CrmAddPaymentAccountDialog />
                            </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-2">
                            <Label htmlFor="paymentLedger">Payment Ledger *</Label>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-md">
                                <Settings className="h-4 w-4" />
                                <span>Enable Advanced Accounting to maintain Payment Ledgers. <a href="#" className="text-primary hover:underline">Go to Settings</a></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <Label htmlFor="amountReceived">Amount Received (A) *</Label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                    <Input id="amountReceived" name="amountReceived" type="number" placeholder="0.00" className="pl-8" value={amount} onChange={e => setAmount(Number(e.target.value))} required/>
                                </div>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="tdsPercentage">TDS (%)</Label>
                                <Input id="tdsPercentage" name="tdsPercentage" type="number" placeholder="0" value={tdsPercentage} onChange={e => setTdsPercentage(Number(e.target.value))}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <Label htmlFor="tdsWithheld">TDS Withheld (B)</Label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                    <Input id="tdsWithheld" name="tdsWithheld" type="number" placeholder="0.00" className="pl-8" value={tdsWithheld.toFixed(2)} readOnly/>
                                </div>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="transactionCharge">Transaction Charge (C)</Label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                    <Input id="transactionCharge" name="transactionCharge" type="number" placeholder="0.00" className="pl-8" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label htmlFor="referenceId">Add Reference ID</Label>
                            <Input id="referenceId" name="referenceId" />
                        </div>

                         <div className="space-y-1.5">
                            <Label htmlFor="notes">Add Additional Notes</Label>
                            <Textarea id="notes" name="notes" placeholder="Add any extra notes about this payment..."/>
                        </div>

                    </CardContent>
                    <CardFooter className="bg-muted/50 p-3">
                         <p className="text-xs text-muted-foreground">This is not an online payment through SabNode. This is a record of payment made by a client to you directly.</p>
                    </CardFooter>
                </Card>
            </div>
        </form>
    );
}
