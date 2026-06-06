import { LoaderCircle } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function AllTransactionsLoading() {
    return (
        <EntityListShell
            title="All inventory transactions"
            subtitle="Every stock movement across sales, returns, and adjustments."
        >
            <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
                <h2 className="mt-4 text-lg font-semibold">Loading transactions...</h2>
                <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                    Please wait while we fetch the transaction data.
                </p>
            </div>
        </EntityListShell>
    );
}
