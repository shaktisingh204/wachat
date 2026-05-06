'use client';
import { ZoruButton, ZoruCard, ZoruDatePicker, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruSwitch, useZoruToast } from '@/components/zoruui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save, ArrowLeft, Landmark } from 'lucide-react';

import { saveCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BankAccountDetails } from '@/lib/definitions';
import { CrmAddBankAccountDialog } from '@/components/wabasimplify/crm-add-bank-account-dialog';

import { CrmPageHeader } from '../../../_components/crm-page-header';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton
            type="submit"
           
            disabled={pending}
           
        >
            Add Account
        </ZoruButton>
    );
}

export default function NewPaymentAccountPage() {
    const [state, formAction] = useActionState(saveCrmPaymentAccount as any, initialState as any);
    const { toast } = useZoruToast();
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
                <ZoruCard>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <ZoruLabel>Account Type *</ZoruLabel>
                            <ZoruSelect name="accountType" required value={accountType} onValueChange={setAccountType}>
                                <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="bank">Bank</ZoruSelectItem>
                                    <ZoruSelectItem value="cash">Cash</ZoruSelectItem>
                                    <ZoruSelectItem value="employee">Employee</ZoruSelectItem>
                                    <ZoruSelectItem value="wallet">Wallet</ZoruSelectItem>
                                    <ZoruSelectItem value="other">Other</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="accountName">Account Name *</ZoruLabel>
                            <ZoruInput id="accountName" name="accountName" required className="h-10 rounded-lg border-border bg-card text-[13px]" />
                        </div>

                        {accountType === 'bank' && (
                            <div className="p-4 rounded-lg border border-border bg-secondary space-y-3">
                                <h4 className="font-semibold text-foreground">Bank Details</h4>
                                {bankDetails.accountNumber ? (
                                    <div className="text-[13px] text-foreground">
                                        <p><strong>Holder:</strong> {bankDetails.accountHolder}</p>
                                        <p><strong>Account:</strong> {bankDetails.accountNumber}</p>
                                        <p><strong>IFSC:</strong> {bankDetails.ifsc}</p>
                                        <ZoruButton variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsBankDialogOpen(true)}>Edit Details</ZoruButton>
                                    </div>
                                ) : (
                                    <ZoruButton type="button" variant="outline" onClick={() => setIsBankDialogOpen(true)}>
                                        Add Bank Details
                                    </ZoruButton>
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Opening Balance *</ZoruLabel>
                                <ZoruInput name="openingBalance" type="number" defaultValue="0" required className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>As of *</ZoruLabel>
                                <ZoruDatePicker value={openingBalanceDate} onChange={setOpeningBalanceDate} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Currency *</ZoruLabel>
                            <ZoruSelect name="currency" defaultValue="INR" required>
                                <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="INR">Indian Rupee (INR)</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="flex items-center space-x-2">
                            <ZoruSwitch id="isDefault" name="isDefault" />
                            <ZoruLabel htmlFor="isDefault">Set as default account</ZoruLabel>
                        </div>
                        <div className="flex items-center space-x-2">
                            <ZoruSwitch id="status" name="status" defaultChecked={true} />
                            <ZoruLabel htmlFor="status">Set as Active</ZoruLabel>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6">
                        <SubmitButton />
                    </div>
                </ZoruCard>
            </form>
        </div>
    );
}
