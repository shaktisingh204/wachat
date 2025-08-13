
'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, File as FileIcon, Edit, ChevronDown, Info, Upload, Image as ImageIcon, Settings, Printer, Share2, LoaderCircle, Repeat, Checkbox, IndianRupee, Banknote, User, GitCompare, Landmark, ReceiptText, NotebookText, Contact, UserCog, BadgeInfo } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmAccount } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const StepIndicator = ({ step, title, active }: { step: number; title: string; active: boolean }) => (
    <div className="flex items-center gap-4">
        <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2",
            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"
        )}>
            <span className="font-bold">{step}</span>
        </div>
        <div>
            <h3 className={cn("font-semibold", active ? "text-primary" : "text-muted-foreground")}>{title}</h3>
        </div>
    </div>
);

export default function NewPaymentReceiptPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [clients, setClients] = useState<WithId<CrmAccount>[]>([]);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const { accounts } = await getCrmAccounts();
            setClients(accounts);
        });
    }, []);

    const handleNextStep = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto space-y-8">
             <header className="flex justify-between items-center">
                <div>
                    <Button variant="ghost" asChild className="-ml-4">
                        <Link href="/dashboard/crm/sales/receipts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Receipts</Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline mt-2">Record Payment Receipt</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">Save As Draft</Button>
                    <Button onClick={handleNextStep}>
                        {currentStep < 3 ? 'Save & Continue' : 'Save'}
                    </Button>
                </div>
            </header>
            
            <div className="flex flex-col md:flex-row gap-8">
                {/* Step Indicators */}
                <div className="w-full md:w-1/4 space-y-6">
                    <StepIndicator step={1} title="Select Client" active={currentStep >= 1} />
                    <StepIndicator step={2} title="Add Payment Records" active={currentStep >= 2} />
                    <StepIndicator step={3} title="Settle Unpaid Invoices" active={currentStep >= 3} />
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {currentStep === 1 && (
                         <Card>
                            <CardContent className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Payment Receipt No *</Label>
                                        <Input defaultValue="A00001" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Receipt Date *</Label>
                                        <DatePicker />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Payment Received From *</Label>
                                        <Select>
                                            <SelectTrigger><SelectValue placeholder="Select Client..."/></SelectTrigger>
                                            <SelectContent>
                                                {clients.map(c => <SelectItem key={c._id.toString()} value={c._id.toString()}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Currency *</Label>
                                        <Select defaultValue="INR">
                                             <SelectTrigger><SelectValue/></SelectTrigger>
                                             <SelectContent>
                                                 <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                                                 <SelectItem value="USD">US Dollar (USD)</SelectItem>
                                             </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                     {currentStep === 2 && (
                         <Card>
                            <CardHeader>
                                <CardTitle>Record Payments</CardTitle>
                                <CardDescription>Record multiple payments against multiple invoices.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline">Add New Payment Record</Button>
                            </CardContent>
                        </Card>
                    )}
                     {currentStep === 3 && (
                         <Card>
                             <CardHeader>
                                <CardTitle>Settle Unpaid Invoices</CardTitle>
                             </CardHeader>
                            <CardContent>
                                <AlertDialog defaultOpen>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>No unpaid Invoices found</AlertDialogTitle>
                                            <AlertDialogDescription>There are no unpaid Invoices against this client. This payment will be recorded as advance payment.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogAction asChild>
                                                <Button>See Client Statement</Button>
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
            
            <Separator />
            
             <div className="space-y-4">
                 <div className="flex flex-wrap gap-2">
                     <Button variant="link" size="sm">Add Notes</Button>
                    <Button variant="link" size="sm">Add Contact Details</Button>
                    <Button variant="link" size="sm">Add Additional Info</Button>
                    <Button variant="link" size="sm">Add Signature</Button>
                </div>
            </div>
        </div>
    );
}
