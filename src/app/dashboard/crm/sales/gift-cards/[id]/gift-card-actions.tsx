'use client';

import * as React from 'react';
import { Button, useZoruToast, Input, Label } from '@/components/zoruui';
import { Mail, PlusCircle, MinusCircle, Printer, Loader2 } from 'lucide-react';
import { addGiftCardFunds, redeemGiftCard, emailGiftCard } from '@/app/actions/crm-gift-cards.actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/zoruui';

export function GiftCardActions({
    id,
    balance,
    email,
}: {
    id: string;
    balance: number;
    email: string | null;
}) {
    const { toast } = useZoruToast();
    const [action, setAction] = React.useState<'add' | 'redeem' | 'email' | null>(null);
    const [amount, setAmount] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [targetEmail, setTargetEmail] = React.useState(email || '');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (action === 'add') {
                const val = parseFloat(amount);
                if (isNaN(val) || val <= 0) {
                    toast({ title: 'Invalid amount', variant: 'destructive' });
                    return;
                }
                const res = await addGiftCardFunds(id, val, notes);
                if (res.success) {
                    toast({ title: 'Success', description: res.message });
                    setAction(null);
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            } else if (action === 'redeem') {
                const val = parseFloat(amount);
                if (isNaN(val) || val <= 0) {
                    toast({ title: 'Invalid amount', variant: 'destructive' });
                    return;
                }
                const res = await redeemGiftCard(id, val, notes);
                if (res.success) {
                    toast({ title: 'Success', description: res.message });
                    setAction(null);
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            } else if (action === 'email') {
                if (!targetEmail) {
                    toast({ title: 'Email required', variant: 'destructive' });
                    return;
                }
                const res = await emailGiftCard(id, targetEmail);
                if (res.success) {
                    toast({ title: 'Success', description: res.message });
                    setAction(null);
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            }
        } finally {
            setIsSubmitting(false);
            setAmount('');
            setNotes('');
        }
    };

    return (
        <div className="flex flex-wrap gap-2 mt-4 print:hidden">
            <Button variant="outline" onClick={() => setAction('add')} disabled={balance === 0}>
                <PlusCircle className="h-4 w-4 mr-2" /> Add Funds
            </Button>
            <Button variant="outline" onClick={() => setAction('redeem')} disabled={balance === 0}>
                <MinusCircle className="h-4 w-4 mr-2" /> Redeem
            </Button>
            <Button variant="outline" onClick={() => setAction('email')}>
                <Mail className="h-4 w-4 mr-2" /> Email Card
            </Button>
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Print
            </Button>

            <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {action === 'add' ? 'Add Funds' : action === 'redeem' ? 'Redeem Funds' : 'Email Gift Card'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {(action === 'add' || action === 'redeem') && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Amount (₹)</Label>
                                    <Input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                    />
                                    {action === 'redeem' && (
                                        <p className="text-xs text-muted-foreground">Max available: {balance}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Notes (Optional)</Label>
                                    <Input
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Reason or reference..."
                                    />
                                </div>
                            </>
                        )}
                        {action === 'email' && (
                            <div className="space-y-1.5">
                                <Label>Recipient Email</Label>
                                <Input
                                    type="email"
                                    value={targetEmail}
                                    onChange={(e) => setTargetEmail(e.target.value)}
                                    placeholder="customer@example.com"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAction(null)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
