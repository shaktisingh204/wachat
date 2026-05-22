'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useRef,
  useState } from 'react';

import type { BankAccountDetails } from '@/lib/definitions';

interface CrmAddBankAccountDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (details: Partial<BankAccountDetails>) => void;
}

export function CrmAddBankAccountDialog({ isOpen, onOpenChange, onSave }: CrmAddBankAccountDialogProps) {
    const { toast } = useZoruToast();
    const [details, setDetails] = useState<Partial<BankAccountDetails>>({});
    const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
    const [showSwift, setShowSwift] = useState(false);
    const [showIban, setShowIban] = useState(false);

    const handleSave = () => {
        if (details.accountNumber !== confirmAccountNumber) {
            toast({ title: "Error", description: "Account numbers do not match.", variant: "destructive" });
            return;
        }
        onSave(details);
        onOpenChange(false);
    };

    const digitsOnly = (value: string) => value.replace(/\D/g, '');
    const nameOnly = (value: string) => value.replace(/[^a-zA-Z\s'.-]/g, '');

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <ZoruDialogHeader className="px-6 pt-6 pb-2">
                    <ZoruDialogTitle className="text-zoru-ink">Add New Bank Account</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-zoru-ink-muted">
                        Enter the vendor's bank details for payouts.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Country *</ZoruLabel>
                            <ZoruSelect defaultValue="India"><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="India">India</ZoruSelectItem></ZoruSelectContent></ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Bank Name *</ZoruLabel>
                            <ZoruInput placeholder="e.g. HDFC Bank" value={details.bankName || ''} onChange={e => setDetails(prev => ({ ...prev, bankName: e.target.value }))} required maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Account Number *</ZoruLabel>
                            <ZoruInput value={details.accountNumber || ''} inputMode="numeric" pattern="[0-9]*" onChange={e => setDetails(prev => ({ ...prev, accountNumber: digitsOnly(e.target.value) }))} required maxLength={30} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Confirm Account Number *</ZoruLabel>
                            <ZoruInput value={confirmAccountNumber} inputMode="numeric" pattern="[0-9]*" onChange={e => setConfirmAccountNumber(digitsOnly(e.target.value))} required maxLength={30} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">IFSC Code *</ZoruLabel>
                            <ZoruInput value={details.ifsc || ''} onChange={e => setDetails(prev => ({ ...prev, ifsc: e.target.value }))} required maxLength={20} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Account Holder Name *</ZoruLabel>
                            <ZoruInput value={details.accountHolder || ''} pattern="[A-Za-z\\s'.-]+" onChange={e => setDetails(prev => ({ ...prev, accountHolder: nameOnly(e.target.value) }))} required maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Account Type *</ZoruLabel>
                            <ZoruSelect value={details.accountType || ''} onValueChange={val => setDetails(prev => ({ ...prev, accountType: val as any }))} required>
                                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select account type..." /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="current">Current</ZoruSelectItem>
                                    <ZoruSelectItem value="savings">Savings</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel className="text-zoru-ink">Currency *</ZoruLabel>
                            <ZoruSelect value={details.currency || 'INR'} onValueChange={val => setDetails(prev => ({ ...prev, currency: val }))} required>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="INR">Indian Rupee (INR, ₹)</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <ZoruSwitch id="show-swift" checked={showSwift} onCheckedChange={setShowSwift} />
                            <ZoruLabel htmlFor="show-swift" className="text-zoru-ink">Add SWIFT Code</ZoruLabel>
                        </div>
                        {showSwift && <div className="space-y-2"><ZoruInput value={details.swiftCode || ''} onChange={e => setDetails(prev => ({ ...prev, swiftCode: e.target.value }))} maxLength={20} /></div>}
                        <div className="flex items-center space-x-2">
                            <ZoruSwitch id="show-iban" checked={showIban} onCheckedChange={setShowIban} />
                            <ZoruLabel htmlFor="show-iban" className="text-zoru-ink">Add IBAN Code</ZoruLabel>
                        </div>
                        {showIban && <div className="space-y-2"><ZoruInput value={details.ibanCode || ''} onChange={e => setDetails(prev => ({ ...prev, ibanCode: e.target.value }))} maxLength={34} /></div>}
                    </div>
                </div>
                <ZoruDialogFooter className="shrink-0 border-t border-zoru-line bg-zoru-bg px-6 pb-6 pt-4">
                    <ZoruButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                    <ZoruButton type="button" onClick={handleSave}>Add Account</ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
