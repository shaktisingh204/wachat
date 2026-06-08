'use client';

import { useEffect } from 'react';
import { EmptyState, Button } from '@/components/sabcrm/20ui';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function SettingsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Settings page error:', error);
    }, [error]);

    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <EmptyState
                icon={AlertTriangle}
                title="Something went wrong"
                description={error.message || 'An error occurred while loading your settings.'}
                action={
                    <Button onClick={() => reset()}>
                        <RefreshCcw size={16} aria-hidden="true" />
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
