'use client';

import * as React from 'react';
import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import { settleTaxJournalEntries } from '@/app/actions/crm-india-gst.actions';

export function TaxSettlementButton({ period, taxType, amount }: { period: string; taxType: string; amount: number }) {
    const { toast } = useToast();
    const [isSettling, setIsSettling] = React.useState(false);

    const handleSettle = async () => {
        setIsSettling(true);
        try {
            const [year, month] = period.split('-').map(Number);
            const res = await settleTaxJournalEntries({ month, year }, taxType, amount);
            toast({ description: res.message });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Failed to settle tax.' });
        } finally {
            setIsSettling(false);
        }
    };

    if (amount <= 0) return <span className="text-[12px] text-[var(--st-text-secondary)]">Settled</span>;

    return (
        <Button variant="outline" size="sm" onClick={handleSettle} disabled={isSettling} className="h-7 text-[12px]">
            {isSettling ? 'Settling...' : 'Settle'}
        </Button>
    );
}
