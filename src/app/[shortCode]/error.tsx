'use client';

import * as React from 'react';
import { Button } from '@/components/zoruui';
import { EmptyState } from '@/components/zoruui';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function ShortCodeError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <EmptyState
                icon={AlertTriangle}
                title="Oops! Something went wrong"
                description="We couldn't redirect you to the destination. The link might be broken or our servers might be having a moment."
                action={
                    <Button onClick={() => reset()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
