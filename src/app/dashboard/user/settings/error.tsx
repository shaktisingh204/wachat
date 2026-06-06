'use client';

import { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Button } from '@/components/sabcrm/20ui';
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
        <div className="flex h-[50vh] items-center justify-center">
            <Card className="max-w-md w-full border-destructive/50">
                <CardHeader>
                    <div className="flex items-center gap-2 text-[var(--st-text)] mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <CardTitle>Something went wrong!</CardTitle>
                    </div>
                    <CardDescription>
                        An error occurred while loading your settings.
                    </CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="p-3 bg-[var(--st-bg-muted)] rounded-md text-sm font-mono text-[var(--st-text-secondary)] break-all">
                        {error.message || 'Unknown error'}
                    </div>
                    <Button onClick={() => reset()} className="w-full">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Try again
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
