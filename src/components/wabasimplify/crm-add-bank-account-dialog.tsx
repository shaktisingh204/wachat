
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { BankAccountDetails } from '@/lib/definitions';
import { ClayButton } from '@/components/clay';

interface CrmAddBankAccountDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (details: Partial<BankAccountDetails>) => void;
}

export function CrmAddBankAccountDialog({ isOpen, onOpenChange, onSave }: CrmAddBankAccountDialogProps) {
    const { toast } = useToast();
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

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle className="text-foreground">Add New Bank Account</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Enter the vendor's bank details for payouts.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Country *</Label>
                            <Select defaultValue="India"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="India">India</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Bank Name *</Label>
                            <Input placeholder="e.g. HDFC Bank" value={details.bankName || ''} onChange={e => setDetails(prev => ({ ...prev, bankName: e.target.value }))} required maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Account Number *</Label>
                            <Input value={details.accountNumber || ''} onChange={e => setDetails(prev => ({ ...prev, accountNumber: e.target.value }))} required maxLength={30} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Confirm Account Number *</Label>
                            <Input value={confirmAccountNumber} onChange={e => setConfirmAccountNumber(e.target.value)} required maxLength={30} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">IFSC Code *</Label>
                            <Input value={details.ifsc || ''} onChange={e => setDetails(prev => ({ ...prev, ifsc: e.target.value }))} required maxLength={20} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Account Holder Name *</Label>
                            <Input value={details.accountHolder || ''} onChange={e => setDetails(prev => ({ ...prev, accountHolder: e.target.value }))} required maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Account Type *</Label>
                            <Select value={details.accountType || ''} onValueChange={val => setDetails(prev => ({ ...prev, accountType: val as any }))} required>
                                <SelectTrigger><SelectValue placeholder="Select account type..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current">Current</SelectItem>
                                    <SelectItem value="savings">Savings</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Currency *</Label>
                            <Select value={details.currency || 'INR'} onValueChange={val => setDetails(prev => ({ ...prev, currency: val }))} required>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">Indian Rupee (INR, ₹)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch id="show-swift" checked={showSwift} onCheckedChange={setShowSwift} />
                            <Label htmlFor="show-swift" className="text-foreground">Add SWIFT Code</Label>
                        </div>
                        {showSwift && <div className="space-y-2"><Input value={details.swiftCode || ''} onChange={e => setDetails(prev => ({ ...prev, swiftCode: e.target.value }))} maxLength={20} /></div>}
                        <div className="flex items-center space-x-2">
                            <Switch id="show-iban" checked={showIban} onCheckedChange={setShowIban} />
                            <Label htmlFor="show-iban" className="text-foreground">Add IBAN Code</Label>
                        </div>
                        {showIban && <div className="space-y-2"><Input value={details.ibanCode || ''} onChange={e => setDetails(prev => ({ ...prev, ibanCode: e.target.value }))} maxLength={34} /></div>}
                    </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-2">
                    <ClayButton type="button" variant="pill" onClick={() => onOpenChange(false)}>Cancel</ClayButton>
                    <ClayButton type="button" variant="obsidian" onClick={handleSave}>Add Account</ClayButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
