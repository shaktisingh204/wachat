'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StateCard } from '@/components/crm/state-card';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function StockAdjustmentError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <EntityDetailShell eyebrow="ERROR" title="Failed to load adjustment">
            <StateCard
                icon={AlertCircle}
                title="Something went wrong!"
                description={
                    error.message ||
                    'We encountered an error loading this stock adjustment. Please try again.'
                }
                action={{
                    label: 'Try again',
                    onClick: () => reset(),
                }}
            />
        </EntityDetailShell>
    );
}
