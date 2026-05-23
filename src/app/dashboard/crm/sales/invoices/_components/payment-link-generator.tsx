'use client';

import * as React from 'react';
import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, useZoruToast } from '@/components/zoruui';
import { LinkIcon, CreditCard } from 'lucide-react';

export function PaymentLinkGenerator({ invoiceId, amount, currency }: { invoiceId: string, amount: number, currency: string }) {
    const { toast } = useZoruToast();
    const [link, setLink] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    const handleGenerate = () => {
        setLoading(true);
        // Placeholder logic for Stripe/Razorpay
        setTimeout(() => {
            setLink(`https://pay.stripe.com/test_${invoiceId.slice(-6)}`);
            setLoading(false);
            toast({
                title: 'Payment link generated',
                description: 'Link has been successfully created.',
            });
        }, 1000);
    };

    const handleCopy = () => {
        if (link) {
            navigator.clipboard.writeText(link);
            toast({ title: 'Copied to clipboard' });
        }
    };

    return (
        <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between">
                <ZoruCardTitle>Payment Link</ZoruCardTitle>
                <CreditCard className="h-4 w-4 text-zoru-ink-muted" />
            </ZoruCardHeader>
            <ZoruCardContent>
                {!link ? (
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zoru-surface-2 p-3 rounded-md border border-zoru-line">
                        <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-medium text-zoru-ink">Collect Payment Online</span>
                            <span className="text-[12px] text-zoru-ink-muted">Generate a secure payment link (Stripe/Razorpay) for your customer.</span>
                        </div>
                        <Button size="sm" onClick={handleGenerate} disabled={loading}>
                            {loading ? 'Generating...' : 'Generate Link'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 bg-muted/40 p-2 rounded border border-zoru-line">
                            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <code className="text-[12px] flex-1">{link}</code>
                            <Button size="sm" variant="outline" onClick={handleCopy}>Copy</Button>
                        </div>
                        <p className="text-[11px] text-zoru-ink-muted">Share this link with your customer to collect the payment.</p>
                    </div>
                )}
            </ZoruCardContent>
        </Card>
    );
}
