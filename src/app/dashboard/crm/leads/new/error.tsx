'use client';

import * as React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        // Log the error to an error reporting service
        console.error('Lead New Form Error:', error);
    }, [error]);

    return (
        <div className="flex h-[60vh] w-full flex-col items-center justify-center">
            <EmptyState
                icon={AlertCircle}
                title="Failed to load lead form"
                description={error.message || 'Something went wrong while loading the new lead form.'}
                action={
                    <Button onClick={() => reset()} variant="default">
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
