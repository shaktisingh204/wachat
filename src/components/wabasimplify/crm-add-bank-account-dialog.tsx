
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New Bank Account</DialogTitle>
                    <DialogDescription>
                        Enter the vendor's bank details for payouts.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Country *</Label>
                            <Select defaultValue="India"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="India">India</SelectItem></SelectContent></Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Bank Name *</Label>
                            <Input placeholder="e.g. HDFC Bank" value={details.bankName || ''} onChange={e => setDetails(prev => ({...prev, bankName: e.target.value}))} required maxLength={100} />
                        </div>
                         <div className="space-y-2">
                            <Label>Account Number *</Label>
                            <Input value={details.accountNumber || ''} onChange={e => setDetails(prev => ({...prev, accountNumber: e.target.value}))} required maxLength={30} />
                        </div>
                         <div className="space-y-2">
                            <Label>Confirm Account Number *</Label>
                            <Input value={confirmAccountNumber} onChange={e => setConfirmAccountNumber(e.target.value)} required maxLength={30} />
                        </div>
                         <div className="space-y-2">
                            <Label>IFSC Code *</Label>
                            <Input value={details.ifsc || ''} onChange={e => setDetails(prev => ({...prev, ifsc: e.target.value}))} required maxLength={20} />
                        </div>
                         <div className="space-y-2">
                            <Label>Account Holder Name *</Label>
                            <Input value={details.accountHolder || ''} onChange={e => setDetails(prev => ({...prev, accountHolder: e.target.value}))} required maxLength={100} />
                        </div>
                         <div className="space-y-2">
                            <Label>Account Type *</Label>
                            <Select value={details.accountType || ''} onValueChange={val => setDetails(prev => ({...prev, accountType: val as any}))} required>
                                <SelectTrigger><SelectValue placeholder="Select account type..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current">Current</SelectItem>
                                    <SelectItem value="savings">Savings</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Currency *</Label>
                            <Select value={details.currency || 'INR'} onValueChange={val => setDetails(prev => ({...prev, currency: val}))} required>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">Indian Rupee (INR, ₹)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch id="show-swift" checked={showSwift} onCheckedChange={setShowSwift} />
                            <Label htmlFor="show-swift">Add SWIFT Code</Label>
                        </div>
                        {showSwift && <div className="space-y-2"><Input value={details.swiftCode || ''} onChange={e => setDetails(prev => ({...prev, swiftCode: e.target.value}))} maxLength={20} /></div>}
                        <div className="flex items-center space-x-2">
                            <Switch id="show-iban" checked={showIban} onCheckedChange={setShowIban} />
                            <Label htmlFor="show-iban">Add IBAN Code</Label>
                        </div>
                        {showIban && <div className="space-y-2"><Input value={details.ibanCode || ''} onChange={e => setDetails(prev => ({...prev, ibanCode: e.target.value}))} maxLength={34} /></div>}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSave}>Add Account</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
