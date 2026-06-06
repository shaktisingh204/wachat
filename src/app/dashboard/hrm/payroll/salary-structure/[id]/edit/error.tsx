'use client';

import { useEffect } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EditSalaryStructureError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
        toast.error('Failed to load salary structure data. Please try again.');
    }, [error]);

    return (
        <EntityListShell
            title="Error · Salary Structure"
            subtitle="Could not load the requested data."
        >
            <div className="flex h-[300px] flex-col items-center justify-center space-y-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6 shadow-sm text-center">
                <AlertCircle className="h-10 w-10 text-[var(--st-text)]" />
                <div>
                    <h3 className="text-lg font-medium">Something went wrong!</h3>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1 max-w-sm mx-auto">
                        There was a problem fetching the salary structure data. This could be due to a network issue or the record might not exist.
                    </p>
                </div>
                <Button onClick={() => reset()} variant="default" className="mt-4">
                    Try again
                </Button>
            </div>
        </EntityListShell>
    );
}
