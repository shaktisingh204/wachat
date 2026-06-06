'use client';

import React, { useState } from 'react';
import { Card, Button } from '@/components/sabcrm/20ui';
import { Check, Copy } from 'lucide-react';

export function WidgetIntegration({ loyaltyId }: { loyaltyId: string }) {
    const [copied, setCopied] = useState(false);

    const snippet = `<script src="https://sabnode.com/widgets/loyalty.js" data-loyalty-id="${loyaltyId}" defer></script>`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Portal Widget Integration
            </h2>
            <p className="text-[13px] text-[var(--st-text)] mb-4">
                Embed this loyalty portal directly into your website. The widget allows customers to view their point balance, current tier, and redeem rewards.
            </p>
            <div className="relative">
                <pre className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-md p-4 text-[12px] text-[var(--st-text)] overflow-x-auto">
                    <code>{snippet}</code>
                </pre>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 h-7 w-7 p-0" 
                    onClick={copyToClipboard}
                    title="Copy snippet"
                >
                    {copied ? <Check className="h-4 w-4 text-[var(--st-text)]" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </Card>
    );
}
