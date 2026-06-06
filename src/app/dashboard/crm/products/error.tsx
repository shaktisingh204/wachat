'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { ZoruButton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function ProductsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Products Error:', error);
    }, [error]);

    return (
        <EntityDetailShell
            eyebrow="ERROR"
            title="Products Catalog Error"
            back={{ href: '/dashboard/crm/products', label: 'Back to Products' }}
        >
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 text-center animate-in fade-in-50">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[var(--st-text)]">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">Catalog Error</h3>
                    <p className="text-sm text-[var(--st-text-secondary)] max-w-[400px]">
                        {error.message || 'We encountered a problem loading product details or catalog metrics.'}
                    </p>
                </div>
                <ZoruButton
                    variant="outline"
                    onClick={reset}
                    className="mt-4 gap-2"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Try again
                </ZoruButton>
            </div>
        </EntityDetailShell>
    );
}
