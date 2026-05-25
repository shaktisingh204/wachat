'use client';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/zoruui';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <EntityListShell
            title="Stock value report"
            subtitle="Failed to load stock valuation data."
        >
            <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <p className="text-sm text-destructive">{error.message || 'An unexpected error occurred.'}</p>
                <Button variant="outline" onClick={reset}>
                    Try again
                </Button>
            </div>
        </EntityListShell>
    );
}
