'use client';

import {
  ZoruCard,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruAlert,
  ZoruAlertDescription,
} from '@/components/zoruui';
import {
  useState,
  useTransition } from 'react';
import { IndianRupee, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createPayuWalletTopup } from '@/app/actions/payu.actions';
import type { User,
  WithId } from '@/lib/definitions';
import { useSearchParams } from 'next/navigation';

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
        <ZoruCard>
            <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center gap-2">
                    <IndianRupee className="h-6 w-6" />
                    Your Wallet
                </ZoruCardTitle>
                <ZoruCardDescription>
                    Your current account balance.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
                {/* Payment result banners */}
                {paymentStatus === 'success' && paymentType === 'wallet' && (
                    <ZoruAlert>
                        <CheckCircle2 className="h-4 w-4" />
                        <ZoruAlertDescription>
                            Wallet topped up successfully! Your balance has been updated.
                        </ZoruAlertDescription>
                    </ZoruAlert>
                )}
                {paymentStatus === 'failed' && (
                    <ZoruAlert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <ZoruAlertDescription>
                            Payment failed. No money was deducted. Please try again.
                        </ZoruAlertDescription>
                    </ZoruAlert>
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
                        <ZoruLabel htmlFor="amount">Amount (INR)</ZoruLabel>
                        <ZoruInput
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
                    <ZoruButton type="submit" className="w-full" disabled={isPending}>
                        {isPending ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <IndianRupee className="mr-2 h-4 w-4" />
                        )}
                        Add ₹{amount.toLocaleString('en-IN')}
                    </ZoruButton>
                    <p className="text-center text-[11px] text-muted-foreground">
                        Secure payment via PayU
                    </p>
                </form>
            </ZoruCardContent>
        </ZoruCard>
    );
}
