'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function EditGrnError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Edit GRN Error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-zoru-line border-dashed p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-2">
                <h2 className="text-[15px] font-semibold text-zoru-ink">
                    Something went wrong!
                </h2>
                <p className="text-[13px] text-zoru-ink-muted">
                    We encountered an error while trying to load the GRN for editing. Please try again.
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline">
                Try again
            </Button>
        </div>
    );
}
