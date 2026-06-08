'use client';

import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function SabvaultError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[sabvault]', error);
    }, [error]);

    return (
        <div className="20ui flex min-h-[400px] items-center justify-center p-8">
            <EmptyState
                icon={ShieldAlert}
                tone="danger"
                title="Something went wrong"
                description={
                    error.message || 'We could not load this vault page. Please try again.'
                }
                action={
                    <Button variant="outline" onClick={() => reset()}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
