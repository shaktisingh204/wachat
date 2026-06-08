'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabshowError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[sabshow]', error);
    }, [error]);

    return (
        <div className="20ui flex min-h-[60vh] items-center justify-center p-6">
            <EmptyState
                tone="danger"
                icon={AlertTriangle}
                title="Could not load this deck"
                description={
                    error?.message
                        ? `${error.message}${error.digest ? ` (ref: ${error.digest})` : ''}`
                        : 'Something went wrong while loading SabShow. Try again, or contact support if it keeps happening.'
                }
                action={
                    <Button iconLeft={RefreshCw} onClick={() => reset()}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
