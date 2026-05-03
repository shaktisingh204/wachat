'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, Landmark } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BankAccountDetails } from '@/lib/definitions';
import { CrmAddBankAccountDialog } from '@/components/wabasimplify/crm-add-bank-account-dialog';
import { DatePicker } from '@/components/ui/date-picker';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Add Account
        </ClayButton>
    );
}

export default function NewPaymentAccountPage() {
    const [state, formAction] = useActionState(saveCrmPaymentAccount as any, initialState as any);
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
        <div className="max-w-2xl flex w-full flex-col gap-6">
            <CrmAddBankAccountDialog
                isOpen={isBankDialogOpen}
                onOpenChange={setIsBankDialogOpen}
                onSave={(details) => setBankDetails(details)}
            />
            <div>
                <Link href="/dashboard/crm/banking/all" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to All Accounts
                </Link>
            </div>

            <CrmPageHeader
                title="New Payment Account"
                subtitle="Enter the details for the new account."
                icon={Landmark}
            />

            <form action={formAction} ref={formRef}>
                <input type="hidden" name="bankAccountDetails" value={JSON.stringify(bankDetails)} />
                <input type="hidden" name="openingBalanceDate" value={openingBalanceDate?.toISOString()} />
                <ClayCard>
                    <div className="space-y-6">
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
                            <Input id="accountName" name="accountName" required className="h-10 rounded-lg border-border bg-card text-[13px]" />
                        </div>

                        {accountType === 'bank' && (
                            <div className="p-4 rounded-lg border border-border bg-secondary space-y-3">
                                <h4 className="font-semibold text-foreground">Bank Details</h4>
                                {bankDetails.accountNumber ? (
                                    <div className="text-[13px] text-foreground">
                                        <p><strong>Holder:</strong> {bankDetails.accountHolder}</p>
                                        <p><strong>Account:</strong> {bankDetails.accountNumber}</p>
                                        <p><strong>IFSC:</strong> {bankDetails.ifsc}</p>
                                        <Button variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsBankDialogOpen(true)}>Edit Details</Button>
                                    </div>
                                ) : (
                                    <ClayButton type="button" variant="pill" onClick={() => setIsBankDialogOpen(true)}>
                                        Add Bank Details
                                    </ClayButton>
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Opening Balance *</Label>
                                <Input name="openingBalance" type="number" defaultValue="0" required className="h-10 rounded-lg border-border bg-card text-[13px]" />
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
                    </div>
                    <div className="flex justify-end pt-6">
                        <SubmitButton />
                    </div>
                </ClayCard>
            </form>
        </div>
    );
}
