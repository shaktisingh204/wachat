
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BankAccountDetails } from '@/lib/definitions';
import { CrmAddBankAccountDialog } from '@/components/wabasimplify/crm-add-bank-account-dialog';
import { DatePicker } from '@/components/ui/date-picker';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Add Account
    </Button>
  );
}

export default function NewPaymentAccountPage() {
    const [state, formAction] = useActionState(saveCrmPaymentAccount, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [accountType, setAccountType] = useState<string>('bank');
    const [bankDetails, setBankDetails] = useState<Partial<BankAccountDetails>>({});
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [openingBalanceDate, setOpeningBalanceDate] = useState<Date | undefined>(new Date());

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/banking/all');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <div className="max-w-2xl mx-auto">
             <CrmAddBankAccountDialog
                isOpen={isBankDialogOpen}
                onOpenChange={setIsBankDialogOpen}
                onSave={(details) => setBankDetails(details)}
            />
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/banking/all"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Accounts</Link>
                </Button>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="bankAccountDetails" value={JSON.stringify(bankDetails)} />
                <input type="hidden" name="openingBalanceDate" value={openingBalanceDate?.toISOString()} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-6 w-6" />
                            New Payment Account
                        </CardTitle>
                        <CardDescription>Enter the details for the new account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Account Type *</Label>
                            <Select name="accountType" required value={accountType} onValueChange={setAccountType}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bank">Bank</SelectItem>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="employee">Employee</SelectItem>
                                    <SelectItem value="wallet">Wallet</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accountName">Account Name *</Label>
                            <Input id="accountName" name="accountName" required />
                        </div>

                        {accountType === 'bank' && (
                            <div className="p-4 border rounded-md space-y-3 bg-muted/50">
                                <h4 className="font-semibold">Bank Details</h4>
                                {bankDetails.accountNumber ? (
                                    <div className="text-sm">
                                        <p><strong>Holder:</strong> {bankDetails.accountHolder}</p>
                                        <p><strong>Account:</strong> {bankDetails.accountNumber}</p>
                                        <p><strong>IFSC:</strong> {bankDetails.ifsc}</p>
                                        <Button variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsBankDialogOpen(true)}>Edit Details</Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="outline" onClick={() => setIsBankDialogOpen(true)}>
                                        Add Bank Details
                                    </Button>
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Opening Balance *</Label>
                                <Input name="openingBalance" type="number" defaultValue="0" required />
                            </div>
                             <div className="space-y-2">
                                <Label>As of *</Label>
                                <DatePicker date={openingBalanceDate} setDate={setOpeningBalanceDate} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Currency *</Label>
                            <Select name="currency" defaultValue="INR" required>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="isDefault" name="isDefault" />
                            <Label htmlFor="isDefault">Set as default account</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Switch id="status" name="status" defaultChecked={true} />
                            <Label htmlFor="status">Set as Active</Label>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
