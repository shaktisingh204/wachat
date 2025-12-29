
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IndianRupee, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleCreateRazorpayOrder } from '@/app/actions/billing.actions';
import { useProject } from '@/context/project-context';
import type { User, WithId } from '@/lib/definitions';
import Script from 'next/script';

function AddFundsButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
            Add Funds
        </Button>
    )
}

export function WalletCard({ user }: { user: WithId<User> }) {
    const { toast } = useToast();
    const [amount, setAmount] = useState(500);
    const [isPending, startTransition] = useTransition();

    const handleAddFunds = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const result = await handleCreateRazorpayOrder(amount, 'INR');

            if (result.error || !result.success) {
                toast({ title: "Error", description: result.error || 'Failed to create order.', variant: "destructive" });
                return;
            }

            const options = {
                key: result.apiKey,
                amount: result.amount,
                currency: result.currency,
                name: "SabNode",
                description: "Wallet Top-up",
                order_id: result.orderId,
                handler: function (response: any){
                    toast({ title: "Payment Successful!", description: `Payment ID: ${response.razorpay_payment_id}`});
                    // Here you would typically verify the payment on your backend
                    // and then credit the user's wallet upon webhook confirmation.
                    // For now, we rely on the webhook.
                },
                prefill: {
                    name: result.user.name,
                    email: result.user.email,
                },
                theme: {
                    color: "#3399cc"
                }
            };
            
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        });
    }

    const balance = user.wallet?.balance || 0;
    const currency = user.wallet?.currency || 'INR';

    return (
        <>
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IndianRupee className="h-6 w-6"/>
                        Your Wallet
                    </CardTitle>
                    <CardDescription>
                        Your current account balance.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-4xl font-bold">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency }).format(balance / 100)}
                    </div>
                    <form onSubmit={handleAddFunds} className="space-y-3">
                         <div className="space-y-1">
                            <Label htmlFor="amount">Amount to Add (INR)</Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                min="100"
                                step="100"
                            />
                        </div>
                        <AddFundsButton />
                    </form>
                </CardContent>
            </Card>
        </>
    );
}

