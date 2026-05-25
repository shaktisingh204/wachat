'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function EditBankTransactionError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Edit Bank Transaction error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-[var(--zoru-radius-lg)] border border-border border-dashed p-8 text-center bg-background/50">
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-[13px] text-muted-foreground max-w-[400px]">
                {error.message || 'An unexpected error occurred while loading the bank transaction editor.'}
            </p>
            <Button onClick={() => reset()} variant="outline" className="mt-2 h-9">
                Try again
            </Button>
        </div>
    );
}
