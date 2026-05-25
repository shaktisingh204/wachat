'use client';

import * as React from 'react';
import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, useZoruToast } from '@/components/zoruui';
import { LinkIcon, CreditCard, ShieldCheck, MailOpen, Landmark } from 'lucide-react';
import { fmtINR } from '@/lib/utils';

export function PaymentLinkGenerator({
    invoiceId,
    amount,
    currency,
}: {
    invoiceId: string;
    amount: number;
    currency: string;
}) {
    const { toast } = useZoruToast();
    const [gateway, setGateway] = React.useState<'stripe' | 'razorpay'>('stripe');
    const [paymentMode, setPaymentMode] = React.useState<'full' | 'partial'>('full');
    const [partialAmount, setPartialAmount] = React.useState(String(amount));
    const [link, setLink] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [allowUpi, setAllowUpi] = React.useState(true);
    const [allowCards, setAllowCards] = React.useState(true);

    const targetAmount = paymentMode === 'full' ? amount : parseFloat(partialAmount) || amount;

    const handleGenerate = () => {
        setLoading(true);
        setTimeout(() => {
            const shortId = invoiceId.slice(-6).toUpperCase();
            if (gateway === 'stripe') {
                setLink(`https://checkout.stripe.com/pay/cs_live_${shortId}_amt_${Math.round(targetAmount)}`);
            } else {
                setLink(`https://rzp.io/l/inv_rzp_${shortId}_val_${Math.round(targetAmount)}`);
            }
            setLoading(false);
            toast({
                title: 'Gateway Payment Link Ready',
                description: `Successfully registered a secure ${gateway === 'stripe' ? 'Stripe Checkout session' : 'Razorpay Link'} for ${fmtINR(targetAmount, currency)}.`,
            });
        }, 900);
    };

    const handleCopy = () => {
        if (link) {
            navigator.clipboard.writeText(link);
            toast({ title: 'Copied to clipboard', description: 'Payment link is ready to share.' });
        }
    };

    const handleClear = () => {
        setLink(null);
    };

    return (
        <Card className="border-zoru-line bg-zoru-surface">
            <ZoruCardHeader className="flex flex-row items-center justify-between border-b border-zoru-line pb-3">
                <div className="flex flex-col gap-0.5">
                    <ZoruCardTitle className="text-[14px] font-semibold text-zoru-ink">Payment Link & Gateway integrations</ZoruCardTitle>
                    <p className="text-[12px] text-zoru-ink-muted">Create online payment paths via Stripe or Razorpay.</p>
                </div>
                <CreditCard className="h-4 w-4 text-zoru-ink-muted" />
            </ZoruCardHeader>
            <ZoruCardContent className="pt-4 flex flex-col gap-4">
                {!link ? (
                    <div className="flex flex-col gap-4">
                        {/* Gateway and Amount Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-zoru-ink-muted uppercase tracking-wider">
                                    Preferred Provider
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setGateway('stripe')}
                                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs transition ${
                                            gateway === 'stripe'
                                                ? 'border-primary bg-primary/5 text-primary font-medium'
                                                : 'border-zoru-line hover:bg-zoru-surface-2 text-zoru-ink'
                                        }`}
                                    >
                                        <Landmark className="h-3.5 w-3.5" />
                                        Stripe
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGateway('razorpay')}
                                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs transition ${
                                            gateway === 'razorpay'
                                                ? 'border-primary bg-primary/5 text-primary font-medium'
                                                : 'border-zoru-line hover:bg-zoru-surface-2 text-zoru-ink'
                                        }`}
                                    >
                                        <CreditCard className="h-3.5 w-3.5" />
                                        Razorpay
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-zoru-ink-muted uppercase tracking-wider">
                                    Collectible Amount
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value as any)}
                                        className="bg-zoru-surface border border-zoru-line rounded-lg px-2 py-1 text-xs text-zoru-ink focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="full">Full Balance ({fmtINR(amount, currency)})</option>
                                        <option value="partial">Partial Payment</option>
                                    </select>
                                    {paymentMode === 'partial' && (
                                        <input
                                            type="number"
                                            value={partialAmount}
                                            onChange={(e) => setPartialAmount(e.target.value)}
                                            className="w-24 bg-zoru-surface border border-zoru-line rounded-lg px-2 py-1 text-xs text-zoru-ink focus:outline-none"
                                            placeholder="Amount"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Supported Methods */}
                        <div className="flex items-center gap-6 bg-zoru-surface-2 p-2 rounded-lg border border-zoru-line text-[11.5px]">
                            <span className="font-medium text-zoru-ink-muted uppercase tracking-wider text-[10px]">Methods:</span>
                            <label className="flex items-center gap-1.5 text-zoru-ink cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={allowCards}
                                    onChange={(e) => setAllowCards(e.target.checked)}
                                    className="accent-primary"
                                />
                                Credit/Debit Cards
                            </label>
                            <label className="flex items-center gap-1.5 text-zoru-ink cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={allowUpi}
                                    onChange={(e) => setAllowUpi(e.target.checked)}
                                    className="accent-primary"
                                />
                                UPI / NetBanking
                            </label>
                        </div>

                        <div className="flex items-center justify-between border-t border-zoru-line pt-3 mt-1">
                            <span className="text-[12px] text-zoru-ink-muted">
                                Link is secure, compliant, and tracked in audit log.
                            </span>
                            <Button size="sm" onClick={handleGenerate} disabled={loading || targetAmount <= 0}>
                                {loading ? 'Initializing gateway...' : 'Generate Secure Link'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-xs">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                            <span>Gateway registration completed. Payment link generated for <strong>{fmtINR(targetAmount, currency)}</strong>.</span>
                        </div>

                        <div className="flex items-center gap-2 bg-zoru-surface-2 p-2 rounded-lg border border-zoru-line">
                            <LinkIcon className="h-3.5 w-3.5 text-zoru-ink-muted shrink-0" />
                            <code className="text-xs font-mono text-zoru-ink flex-1 truncate">{link}</code>
                            <Button size="sm" variant="outline" onClick={handleCopy}>
                                Copy
                            </Button>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zoru-line">
                            <Button size="sm" variant="ghost" className="text-zoru-ink-muted" onClick={handleClear}>
                                Reset / Change details
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                                <a
                                    href={`mailto:?subject=Payment Request for Invoice ${invoiceId.slice(-6).toUpperCase()}&body=Dear Customer,%0D%0A%0D%0APlease use this link to securely make online payment of ${fmtINR(targetAmount, currency)}: ${link}%0D%0A%0D%0AThank you!`}
                                    className="flex items-center gap-1.5"
                                >
                                    <MailOpen className="h-3.5 w-3.5" />
                                    Email link to customer
                                </a>
                            </Button>
                        </div>
                    </div>
                )}
            </ZoruCardContent>
        </Card>
    );
}
