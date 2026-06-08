'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabFilesError({
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
        <div className="flex min-h-[400px] items-center justify-center p-8">
            <EmptyState
                icon={AlertCircle}
                tone="danger"
                title="Couldn't load your files"
                description={error.message || 'An unexpected error occurred while loading SabFiles.'}
                action={
                    <Button variant="secondary" onClick={() => reset()}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
