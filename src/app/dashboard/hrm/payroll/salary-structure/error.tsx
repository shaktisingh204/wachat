'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function SalaryStructureError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Salary Structure page error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-[var(--st-danger)]/10 p-3 text-[var(--st-danger)]">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
                <h3 className="text-[15px] font-medium text-[var(--st-text)]">Failed to load salary structures</h3>
                <p className="max-w-[400px] text-[13px] text-[var(--st-text-secondary)]">
                    We couldn't load the data. This might be a temporary issue.
                </p>
            </div>
            <Button onClick={reset} variant="outline" className="mt-2">
                Try again
            </Button>
        </div>
    );
}
