'use client';

import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  ZoruCardDescription,
  Button,
  Input,
  Label,
  Alert,
  ZoruAlertDescription,
} from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useTransition } from 'react';
import { IndianRupee, LoaderCircle, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
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
        <Card className="relative overflow-hidden bg-[var(--st-bg)] border border-[var(--st-border)] shadow-md text-[var(--st-text)]">
            <ZoruCardHeader className="pb-2 bg-[var(--st-bg-muted)] border-b border-[var(--st-border)]">
                <div className="flex items-center justify-between">
                    <ZoruCardTitle className="flex items-center gap-2 text-[var(--st-text)] text-lg tracking-tight">
                        <IndianRupee className="h-5 w-5 text-[var(--st-text-secondary)]" />
                        Wallet Balance
                    </ZoruCardTitle>
                    <div className="h-2 w-2 rounded-full bg-[var(--st-status-ok)] animate-pulse" />
                </div>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-6 pt-6">
                {paymentStatus === 'success' && paymentType === 'wallet' && (
                    <div className="flex items-center gap-2 rounded-lg bg-[var(--st-status-ok)]/10 p-3 text-sm text-[var(--st-status-ok)] border border-[var(--st-status-ok)]/30">
                        <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" />
                        Wallet topped up successfully!
                    </div>
                )}
                {paymentStatus === 'failed' && (
                    <div className="flex items-center gap-2 rounded-lg bg-[var(--st-danger)]/10 p-3 text-sm text-[var(--st-danger)] border border-[var(--st-danger)]/30">
                        <AlertCircle className="h-4 w-4 text-[var(--st-danger)]" />
                        Payment failed. Please try again.
                    </div>
                )}

                <div className="flex flex-col">
                    <div className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[var(--st-text)]">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(balance / 100)}
                    </div>
                    <p className="text-xs text-[var(--st-text-secondary)] mt-1 uppercase tracking-wider font-medium">Available Funds</p>
                </div>

                <div className="rounded-xl bg-[var(--st-bg-muted)] p-4 border border-[var(--st-border)]">
                    <form onSubmit={handleAddFunds} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wider">Quick Top-Up</Label>
                            <div className="flex flex-wrap gap-2">
                                {QUICK_AMOUNTS.map((a) => (
                                    <button
                                        key={a}
                                        type="button"
                                        onClick={() => setAmount(a)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                                            amount === a
                                                ? 'bg-[var(--st-text)] text-[var(--st-text-inverted)] shadow-sm'
                                                : 'bg-[var(--st-bg)] text-[var(--st-text)] border border-[var(--st-border)] hover:border-[var(--st-border-strong)]'
                                        }`}
                                    >
                                        ₹{a.toLocaleString('en-IN')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-text-secondary)] font-medium z-10">₹</span>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    min="100"
                                    max="100000"
                                    step="100"
                                    className="pl-7 bg-[var(--st-bg)] border-[var(--st-border)] text-[var(--st-text)] rounded-lg h-10"
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="bg-[var(--st-text)] text-[var(--st-text-inverted)] hover:bg-[var(--st-text)] rounded-lg h-10 px-6 font-bold"
                            >
                                {isPending ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Add Funds'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                <p className="text-center text-[10px] text-[var(--st-text-tertiary)] uppercase tracking-widest font-medium flex items-center justify-center gap-1.5">
                    <Lock className="h-3 w-3" /> Secure payment via PayU
                </p>
            </ZoruCardContent>
        </Card>
    );
}
