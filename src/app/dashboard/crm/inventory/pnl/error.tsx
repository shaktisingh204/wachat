'use client';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function PnlError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <EntityListShell
            title="Product-wise P&L"
            subtitle="Per-product profitability over the trailing six months."
        >
            <Card className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-10 w-10 text-zoru-ink mb-4" />
                <h2 className="text-lg font-semibold">Failed to load P&L Report</h2>
                <p className="text-zoru-ink-muted mt-2 mb-6 text-sm">
                    {error.message || 'An unexpected error occurred while fetching the report.'}
                </p>
                <Button onClick={() => reset()} variant="outline">
                    Try again
                </Button>
            </Card>
        </EntityListShell>
    );
}
