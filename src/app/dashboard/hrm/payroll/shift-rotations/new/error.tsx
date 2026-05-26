'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function NewShiftRotationError({
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
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-md border border-destructive/20 bg-destructive/10 p-8 text-center text-destructive">
            <AlertCircle className="h-10 w-10" />
            <div className="space-y-1">
                <h3 className="text-lg font-semibold">Failed to load data</h3>
                <p className="text-sm opacity-80">
                    {error.message || 'An unexpected error occurred while loading shifts.'}
                </p>
            </div>
            <Button variant="outline" onClick={() => reset()} className="mt-4">
                Try again
            </Button>
        </div>
    );
}
