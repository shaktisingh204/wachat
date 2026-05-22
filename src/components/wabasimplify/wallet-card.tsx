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
} from '@/components/zoruui';
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
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-zoru-primary to-zoru-primary-active text-zoru-on-primary">
            {/* Glossy decorative background element */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-white opacity-5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-zoru-info opacity-10 blur-3xl pointer-events-none" />

            <ZoruCardHeader className="relative z-10 pb-2">
                <div className="flex items-center justify-between">
                    <ZoruCardTitle className="flex items-center gap-2 text-zoru-on-primary font-medium text-lg tracking-tight">
                        <IndianRupee className="h-5 w-5 opacity-80" />
                        Wallet Balance
                    </ZoruCardTitle>
                    <div className="h-2 w-2 rounded-full bg-zoru-success shadow-[0_0_8px_hsl(var(--zoru-success))] animate-pulse" />
                </div>
            </ZoruCardHeader>
            <ZoruCardContent className="relative z-10 space-y-6">
                {/* Payment result banners */}
                {paymentStatus === 'success' && paymentType === 'wallet' && (
                    <div className="flex items-center gap-2 rounded-lg bg-zoru-success/20 p-3 text-sm text-zoru-success-soft border border-zoru-success/30 backdrop-blur-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        Wallet topped up successfully!
                    </div>
                )}
                {paymentStatus === 'failed' && (
                    <div className="flex items-center gap-2 rounded-lg bg-zoru-danger/20 p-3 text-sm text-zoru-danger-soft border border-zoru-danger/30 backdrop-blur-sm">
                        <AlertCircle className="h-4 w-4" />
                        Payment failed. Please try again.
                    </div>
                )}

                <div className="flex flex-col">
                    <div className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white drop-shadow-md">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(balance / 100)}
                    </div>
                    <p className="text-xs text-white/60 mt-1 uppercase tracking-wider font-medium">Available Funds</p>
                </div>

                <div className="rounded-xl bg-black/20 p-4 backdrop-blur-md border border-white/10 shadow-inner">
                    <form onSubmit={handleAddFunds} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-white/80 text-xs uppercase tracking-wider">Quick Top-Up</Label>
                            {/* Quick amount pills */}
                            <div className="flex flex-wrap gap-2">
                                {QUICK_AMOUNTS.map((a) => (
                                    <button
                                        key={a}
                                        type="button"
                                        onClick={() => setAmount(a)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                                            amount === a
                                                ? 'bg-white text-zoru-primary shadow-lg scale-105'
                                                : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                                        }`}
                                    >
                                        ₹{a.toLocaleString('en-IN')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 font-medium">₹</span>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    min="100"
                                    max="100000"
                                    step="100"
                                    className="pl-7 bg-black/20 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30 focus-visible:border-white/50 rounded-lg h-10"
                                />
                            </div>
                            <Button 
                                type="submit" 
                                disabled={isPending}
                                className="bg-white text-zoru-primary hover:bg-white/90 shadow-glow rounded-lg h-10 px-6 font-bold"
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
                
                <p className="text-center text-[10px] text-white/40 uppercase tracking-widest font-medium flex items-center justify-center gap-1.5">
                    <Lock className="h-3 w-3" /> Secure payment via PayU
                </p>
            </ZoruCardContent>
        </Card>
    );
}
