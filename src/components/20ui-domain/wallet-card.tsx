'use client';

import { Card, CardHeader, CardTitle, CardBody, Button, Input, Field, Alert } from '@/components/sabcrm/20ui';
import {
  useState,
  useTransition } from 'react';
import { IndianRupee, Lock } from 'lucide-react';
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
        <Card className="relative overflow-hidden">
            <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
                    <IndianRupee className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    Wallet Balance
                </CardTitle>
                <span className="h-2 w-2 rounded-full bg-[var(--st-status-ok)] animate-pulse" aria-hidden="true" />
            </CardHeader>
            <CardBody className="space-y-6 pt-6">
                {paymentStatus === 'success' && paymentType === 'wallet' && (
                    <Alert tone="success">Wallet topped up successfully.</Alert>
                )}
                {paymentStatus === 'failed' && (
                    <Alert tone="danger">Payment failed. Please try again.</Alert>
                )}

                <div className="flex flex-col">
                    <div className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[var(--st-text)]">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(balance / 100)}
                    </div>
                    <p className="text-xs text-[var(--st-text-secondary)] mt-1 uppercase tracking-wider font-medium">Available Funds</p>
                </div>

                <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-4 border border-[var(--st-border)]">
                    <form onSubmit={handleAddFunds} className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wider font-medium">Quick Top-Up</p>
                            <div className="flex flex-wrap gap-2">
                                {QUICK_AMOUNTS.map((a) => (
                                    <Button
                                        key={a}
                                        size="sm"
                                        variant={amount === a ? 'primary' : 'secondary'}
                                        aria-pressed={amount === a}
                                        onClick={() => setAmount(a)}
                                    >
                                        ₹{a.toLocaleString('en-IN')}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-end gap-2">
                            <Field label="Amount" className="flex-1">
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    min="100"
                                    max="100000"
                                    step="100"
                                    prefix="₹"
                                />
                            </Field>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={isPending}
                            >
                                Add Funds
                            </Button>
                        </div>
                    </form>
                </div>

                <p className="text-center text-[10px] text-[var(--st-text-tertiary)] uppercase tracking-widest font-medium flex items-center justify-center gap-1.5">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Secure payment via PayU
                </p>
            </CardBody>
        </Card>
    );
}
