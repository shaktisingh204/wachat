'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabmonitorError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.JSX.Element {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="20ui flex min-h-[400px] items-center justify-center p-8">
            <EmptyState
                icon={AlertTriangle}
                tone="danger"
                title="Couldn't load monitoring data"
                description={
                    error.message ||
                    'The monitoring backend did not respond. Check the probe service and try again.'
                }
                action={
                    <Button variant="primary" onClick={() => reset()}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
