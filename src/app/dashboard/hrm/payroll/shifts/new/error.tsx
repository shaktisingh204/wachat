'use client';

import * as React from 'react';
import { Button, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription } from '@/components/zoruui';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        console.error('Error in new shift workspace:', error);
    }, [error]);

    return (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <ZoruPageHeading className="mb-2 justify-center">
                <ZoruPageTitle>Something went wrong</ZoruPageTitle>
            </ZoruPageHeading>
            <ZoruPageDescription className="mb-6">
                An unexpected error occurred in the shift creation workspace.
                <br />
                {error.message}
            </ZoruPageDescription>
            <Button onClick={() => reset()}>Try again</Button>
        </div>
    );
}
