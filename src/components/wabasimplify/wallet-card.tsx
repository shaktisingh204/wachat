'use client';

import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IndianRupee, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createPayuWalletTopup } from '@/app/actions/payu.actions';
import type { User, WithId } from '@/lib/definitions';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Submits a PayU checkout payload as a hidden HTML form.
 */
function submitPayuForm(action: string, params: Record<string, string | undefined>) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export function WalletCard({ user }: { user: WithId<User> }) {
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const [amount, setAmount] = useState(500);
    const [isPending, startTransition] = useTransition();

    // Check if we just came back from a payment
    const paymentStatus = searchParams.get('payment');
    const paymentType = searchParams.get('type');

    const handleAddFunds = async (e: React.FormEvent) => {
        e.preventDefault();

        if (amount < 100) {
            toast({ title: 'Minimum ₹100', description: 'Enter at least ₹100.', variant: 'destructive' });
            return;
        }
        if (amount > 100000) {
            toast({ title: 'Maximum ₹1,00,000', description: 'Enter at most ₹1,00,000.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await createPayuWalletTopup(amount);

            if (!result.success || !result.payload) {
                toast({
                    title: 'Error',
                    description: result.error || 'Failed to start checkout.',
                    variant: 'destructive',
                });
                return;
            }

            // Auto-submit to PayU's hosted payment page
            const { action, params } = result.payload;
            submitPayuForm(
                action,
                params as unknown as Record<string, string | undefined>,
            );
        });
    };

    const balance = user.wallet?.balance || 0;
    const currency = user.wallet?.currency || 'INR';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="h-6 w-6" />
                    Your Wallet
                </CardTitle>
                <CardDescription>
                    Your current account balance.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Payment result banners */}
                {paymentStatus === 'success' && paymentType === 'wallet' && (
                    <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                            Wallet topped up successfully! Your balance has been updated.
                        </AlertDescription>
                    </Alert>
                )}
                {paymentStatus === 'failed' && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Payment failed. No money was deducted. Please try again.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="text-4xl font-bold">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(balance / 100)}
                </div>

                {/* Quick amount pills */}
                <div className="flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((a) => (
                        <button
                            key={a}
                            type="button"
                            onClick={() => setAmount(a)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                amount === a
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border hover:border-primary/60'
                            }`}
                        >
                            ₹{a.toLocaleString('en-IN')}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleAddFunds} className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="amount">Amount (INR)</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            min="100"
                            max="100000"
                            step="100"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <IndianRupee className="mr-2 h-4 w-4" />
                        )}
                        Add ₹{amount.toLocaleString('en-IN')}
                    </Button>
                    <p className="text-center text-[11px] text-muted-foreground">
                        Secure payment via PayU
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}
