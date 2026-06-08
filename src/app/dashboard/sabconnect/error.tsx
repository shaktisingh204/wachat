'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, Card, EmptyState } from '@/components/sabcrm/20ui';

export default function SabConnectError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('SabConnect route error:', error);
    }, [error]);

    return (
        <div className="20ui flex w-full flex-col gap-6 p-4 md:p-6">
            <Card variant="outlined" className="min-h-[280px]">
                <EmptyState
                    icon={AlertTriangle}
                    title="This page could not load"
                    description="Something went wrong while loading Connect. Try again, and if it keeps happening, contact your workspace admin."
                    action={
                        <Button variant="primary" onClick={() => reset()}>
                            Try again
                        </Button>
                    }
                />
            </Card>
        </div>
    );
}
