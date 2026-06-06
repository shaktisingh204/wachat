'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function Error({
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
        <div className="flex h-full flex-col items-center justify-center p-8">
            <EmptyState
                tone="danger"
                icon={AlertTriangle}
                title="Something went wrong"
                description={error.message}
                action={
                    <Button variant="primary" iconLeft={RotateCcw} onClick={() => reset()}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
