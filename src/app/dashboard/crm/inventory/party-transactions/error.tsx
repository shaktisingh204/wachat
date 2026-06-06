'use client';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function PartyTransactionsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <EntityListShell
            title="Party transactions"
            subtitle="Inventory + receivable exposure for every customer and vendor."
        >
            <Card className="mt-4 flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="mb-4 h-12 w-12 text-[var(--st-text)]" />
                <h2 className="text-xl font-semibold">Something went wrong!</h2>
                <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                    {error.message || 'Failed to load party transactions data.'}
                </p>
                <Button onClick={reset} variant="outline" className="mt-6">
                    Try again
                </Button>
            </Card>
        </EntityListShell>
    );
}
